const socket = io();
let currentUser = localStorage.getItem('chat_username') || '';
let currentRoom = null;

// Screens
const loginScreen = document.getElementById('login-screen');
const lobbyScreen = document.getElementById('lobby-screen');
const chatScreen = document.getElementById('chat-screen');

if (currentUser) showLobby();

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  currentUser = document.getElementById('username-input').value.trim();
  if (!currentUser) return;
  localStorage.setItem('chat_username', currentUser);
  showLobby();
});

function showLobby() {
  loginScreen.classList.add('hidden');
  lobbyScreen.classList.remove('hidden');
  chatScreen.classList.add('hidden');
  document.getElementById('display-username').textContent = currentUser;
  loadRooms();
}

function logout() {
  localStorage.removeItem('chat_username');
  currentUser = '';
  location.reload();
}

async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    const container = document.getElementById('rooms-container');
    
    if (rooms.length === 0) {
      container.innerHTML = '<p style="color:#666">Belum ada skun. Buat dulu!</p>';
      return;
    }
    
    container.innerHTML = rooms.map(room => `
      <div class="room-item" onclick="enterRoom('${room._id}', '${room.name}', '${room.code}')">
        <span class="room-name">${room.name}</span>
        <span class="room-code">${room.code}</span>
      </div>
    `).join('');
  } catch (err) {
    console.error(err);
  }
}

document.getElementById('create-room-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const name = document.getElementById('room-name').value.trim();
  if (!name) return;
  
  try {
    await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    document.getElementById('room-name').value = '';
    loadRooms();
  } catch (err) {
    console.error(err);
  }
});

function joinByCode() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  fetch('/api/rooms')
    .then(res => res.json())
    .then(rooms => {
      const room = rooms.find(r => r.code === code);
      if (room) {
        enterRoom(room._id, room.name, room.code);
        document.getElementById('join-code').value = '';
      } else {
        alert('Kode skun gak ketemu!');
      }
    });
}

function enterRoom(roomId, name, code) {
  currentRoom = roomId;
  lobbyScreen.classList.add('hidden');
  chatScreen.classList.remove('hidden');
  document.getElementById('room-title').textContent = name;
  document.getElementById('room-code').textContent = `Kode: ${code}`;
  document.getElementById('messages').innerHTML = '';
  
  socket.emit('join-room', roomId);
}

function leaveRoom() {
  if (currentRoom) socket.emit('leave-room', currentRoom);
  currentRoom = null;
  showLobby();
}

// Socket Events
socket.on('load-messages', (messages) => {
  messages.forEach(msg => appendMessage(msg));
});

socket.on('new-message', (msg) => {
  appendMessage(msg);
});

function appendMessage(msg) {
  const div = document.createElement('div');
  div.className = `message ${msg.username === currentUser ? 'own' : 'other'}`;
  div.innerHTML = `
    <small>${msg.username}</small>
    <p>${escapeHtml(msg.text)}</p>
    <small>${new Date(msg.createdAt).toLocaleTimeString('id-ID')}</small>
  `;
  const container = document.getElementById('messages');
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

document.getElementById('chat-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('message-input');
  const text = input.value.trim();
  if (!text || !currentRoom) return;
  
  socket.emit('send-message', {
    roomId: currentRoom,
    username: currentUser,
    text: text
  });
  
  input.value = '';
});

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
