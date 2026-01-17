// DOM Elements
const playerNameInput = document.getElementById('playerName');
const createRoomBtn = document.getElementById('createRoomBtn');
const roomCreatedDiv = document.getElementById('roomCreated');
const roomIdDisplay = document.getElementById('roomIdDisplay');
const copyRoomIdBtn = document.getElementById('copyRoomId');
const joinRoomBtn = document.getElementById('joinRoomBtn');

const joinPlayerNameInput = document.getElementById('joinPlayerName');
const roomIdInput = document.getElementById('roomIdInput');
const joinExistingRoomBtn = document.getElementById('joinExistingRoomBtn');
const joinErrorDiv = document.getElementById('joinError');

// Socket connection
let socket;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    // Connect to server
    socket = io();
    
    // Create room button
    createRoomBtn.addEventListener('click', createRoom);
    
    // Join room button
    joinExistingRoomBtn.addEventListener('click', joinRoom);
    
    // Copy room ID button
    copyRoomIdBtn.addEventListener('click', copyRoomId);
    
    // Join created room button
    joinRoomBtn.addEventListener('click', joinCreatedRoom);
    
    // Enter key handlers
    playerNameInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') createRoom();
    });
    
    roomIdInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') joinRoom();
    });
});

// Create new room
async function createRoom() {
    const playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        alert('Masukkan nama pemain terlebih dahulu!');
        playerNameInput.focus();
        return;
    }
    
    if (playerName.length < 2) {
        alert('Nama pemain minimal 2 karakter!');
        playerNameInput.focus();
        return;
    }
    
    try {
        const response = await fetch('/api/create-room', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ playerName })
        });
        
        const data = await response.json();
        
        if (data.success) {
            // Show room created section
            roomIdDisplay.textContent = data.roomId;
            roomCreatedDiv.classList.remove('hidden');
            
            // Set player name in join form
            joinPlayerNameInput.value = playerName;
            
            // Scroll to room created section
            roomCreatedDiv.scrollIntoView({ behavior: 'smooth' });
        } else {
            alert('Gagal membuat room. Silakan coba lagi.');
        }
    } catch (error) {
        console.error('Error creating room:', error);
        alert('Terjadi kesalahan. Silakan coba lagi.');
    }
}

// Join existing room
async function joinRoom() {
    const playerName = joinPlayerNameInput.value.trim();
    const roomId = roomIdInput.value.trim();
    
    if (!playerName) {
        alert('Masukkan nama pemain terlebih dahulu!');
        joinPlayerNameInput.focus();
        return;
    }
    
    if (!roomId || roomId.length !== 6 || !/^\d+$/.test(roomId)) {
        alert('ID Room harus 6 digit angka!');
        roomIdInput.focus();
        return;
    }
    
    // Check if room exists
    try {
        const response = await fetch(`/api/room/${roomId}`);
        const data = await response.json();
        
        if (data.success) {
            // Room exists, join it
            window.location.href = `/game/${roomId}?playerName=${encodeURIComponent(playerName)}`;
        } else {
            showJoinError('Room tidak ditemukan. Pastikan ID Room benar.');
        }
    } catch (error) {
        console.error('Error joining room:', error);
        showJoinError('Terjadi kesalahan. Silakan coba lagi.');
    }
}

// Join the just created room
function joinCreatedRoom() {
    const playerName = playerNameInput.value.trim();
    const roomId = roomIdDisplay.textContent;
    
    if (!playerName) {
        alert('Masukkan nama pemain terlebih dahulu!');
        return;
    }
    
    window.location.href = `/game/${roomId}?playerName=${encodeURIComponent(playerName)}`;
}

// Copy room ID to clipboard
function copyRoomId() {
    const roomId = roomIdDisplay.textContent;
    
    navigator.clipboard.writeText(roomId)
        .then(() => {
            // Show success feedback
            const originalText = copyRoomIdBtn.innerHTML;
            copyRoomIdBtn.innerHTML = '<i class="fas fa-check"></i> Tersalin!';
            
            setTimeout(() => {
                copyRoomIdBtn.innerHTML = originalText;
            }, 2000);
        })
        .catch(err => {
            console.error('Failed to copy:', err);
            alert('Gagal menyalin ID Room. Silakan salin manual.');
        });
}

// Show join error
function showJoinError(message) {
    joinErrorDiv.textContent = message;
    joinErrorDiv.classList.remove('hidden');
    
    setTimeout(() => {
        joinErrorDiv.classList.add('hidden');
    }, 5000);
                                 }
