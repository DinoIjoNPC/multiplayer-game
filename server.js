const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.PORT || 3000;

// Database sederhana untuk menyimpan room
const rooms = new Map();
const players = new Map();

// Generate ID acak 6 digit
function generateRoomId() {
  let id;
  do {
    id = Math.floor(100000 + Math.random() * 900000).toString();
  } while (rooms.has(id));
  return id;
}

// Middleware
app.use(express.static(path.join(__dirname, '../frontend')));
app.use(express.json());

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.get('/game/:roomId', (req, res) => {
  res.sendFile(path.join(__dirname, '../frontend/game.html'));
});

app.post('/api/create-room', (req, res) => {
  const { playerName } = req.body;
  const roomId = generateRoomId();
  
  const room = {
    id: roomId,
    players: [],
    maxPlayers: 4,
    gameState: 'waiting',
    creator: playerName,
    createdAt: new Date(),
    gameData: null
  };
  
  rooms.set(roomId, room);
  res.json({ roomId, success: true });
});

app.get('/api/room/:roomId', (req, res) => {
  const room = rooms.get(req.params.roomId);
  if (room) {
    res.json({ success: true, room });
  } else {
    res.json({ success: false, message: 'Room tidak ditemukan' });
  }
});

// Socket.IO Connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  
  // Join room
  socket.on('join-room', ({ roomId, playerName }) => {
    const room = rooms.get(roomId);
    
    if (!room) {
      socket.emit('error', { message: 'Room tidak ditemukan' });
      return;
    }
    
    if (room.players.length >= room.maxPlayers) {
      socket.emit('error', { message: 'Room penuh' });
      return;
    }
    
    // Add player to room
    const player = {
      id: socket.id,
      name: playerName,
      score: 0,
      isReady: false,
      isHost: room.players.length === 0
    };
    
    socket.join(roomId);
    players.set(socket.id, { roomId, playerName });
    room.players.push(player);
    
    // Update room
    socket.emit('room-joined', { 
      room, 
      playerId: socket.id,
      isHost: player.isHost 
    });
    
    // Notify other players
    socket.to(roomId).emit('player-joined', player);
    
    console.log(`${playerName} joined room ${roomId}`);
  });
  
  // Ready status
  socket.on('player-ready', ({ roomId, playerId }) => {
    const room = rooms.get(roomId);
    if (room) {
      const player = room.players.find(p => p.id === playerId);
      if (player) {
        player.isReady = true;
        
        // Check if all players are ready
        const allReady = room.players.every(p => p.isReady);
        
        io.to(roomId).emit('player-ready-update', { 
          playerId, 
          allReady 
        });
        
        if (allReady && room.players.length >= 2) {
          // Start game
          room.gameState = 'playing';
          room.gameData = initializeGame(room.players);
          
          io.to(roomId).emit('game-started', room.gameData);
        }
      }
    }
  });
  
  // Game actions
  socket.on('game-action', ({ roomId, action, data }) => {
    const room = rooms.get(roomId);
    if (room && room.gameState === 'playing') {
      // Process game logic
      const gameUpdate = processGameAction(room, action, data, socket.id);
      
      if (gameUpdate) {
        io.to(roomId).emit('game-update', gameUpdate);
        
        // Check for game end
        if (gameUpdate.gameState === 'finished') {
          room.gameState = 'finished';
          setTimeout(() => {
            room.gameState = 'waiting';
            room.players.forEach(p => p.isReady = false);
            io.to(roomId).emit('game-reset');
          }, 10000);
        }
      }
    }
  });
  
  // Chat message
  socket.on('send-message', ({ roomId, message, playerName }) => {
    io.to(roomId).emit('new-message', {
      playerName,
      message,
      timestamp: new Date().toLocaleTimeString()
    });
  });
  
  // Leave room
  socket.on('leave-room', ({ roomId }) => {
    const room = rooms.get(roomId);
    if (room) {
      room.players = room.players.filter(p => p.id !== socket.id);
      socket.leave(roomId);
      players.delete(socket.id);
      
      io.to(roomId).emit('player-left', socket.id);
      
      // If room is empty, delete it after 5 minutes
      if (room.players.length === 0) {
        setTimeout(() => {
          if (rooms.get(roomId)?.players.length === 0) {
            rooms.delete(roomId);
          }
        }, 300000);
      }
    }
  });
  
  // Disconnect
  socket.on('disconnect', () => {
    const player = players.get(socket.id);
    if (player) {
      const room = rooms.get(player.roomId);
      if (room) {
        room.players = room.players.filter(p => p.id !== socket.id);
        io.to(player.roomId).emit('player-left', socket.id);
      }
      players.delete(socket.id);
    }
    console.log('User disconnected:', socket.id);
  });
});

// Game logic functions
function initializeGame(players) {
  return {
    turn: players[0].id,
    round: 1,
    scores: players.reduce((acc, player) => {
      acc[player.id] = 0;
      return acc;
    }, {}),
    board: Array(9).fill(null), // Contoh untuk game tic-tac-toe
    gameType: 'tic-tac-toe',
    winner: null
  };
}

function processGameAction(room, action, data, playerId) {
  const gameData = room.gameData;
  
  if (action === 'move') {
    // Contoh: tic-tac-toe move
    if (gameData.turn !== playerId) return null;
    
    const { position } = data;
    if (gameData.board[position] !== null) return null;
    
    const playerIndex = room.players.findIndex(p => p.id === playerId);
    gameData.board[position] = playerIndex === 0 ? 'X' : 'O';
    
    // Check win condition
    const winner = checkWin(gameData.board);
    if (winner) {
      gameData.winner = playerId;
      gameData.scores[playerId] += 1;
      gameData.gameState = 'finished';
    } else if (gameData.board.every(cell => cell !== null)) {
      // Draw
      gameData.gameState = 'finished';
    } else {
      // Switch turn
      const currentPlayerIndex = room.players.findIndex(p => p.id === playerId);
      const nextPlayerIndex = (currentPlayerIndex + 1) % room.players.length;
      gameData.turn = room.players[nextPlayerIndex].id;
      gameData.round += 1;
    }
    
    return gameData;
  }
  
  return null;
}

function checkWin(board) {
  const winPatterns = [
    [0,1,2], [3,4,5], [6,7,8], // Rows
    [0,3,6], [1,4,7], [2,5,8], // Columns
    [0,4,8], [2,4,6] // Diagonals
  ];
  
  for (let pattern of winPatterns) {
    const [a,b,c] = pattern;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
