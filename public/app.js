const socket = io();
let currentUser = localStorage.getItem('chat_username') || '';
let currentRoom = null;
const messagesEndRef = { current: null };

// Avatar color generator
function getAvatarColor(name) {
  const colors = [
    '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
    '#f97316', '#eab308', '#10b981', '#06b6d4',
    '#3b82f6', '#d946ef', '#84cc16', '#14b8a6'
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

function getInitials(name) {
  return name.substring(0, 2).toUpperCase();
}

function createAvatarHTML(name, size = 'md') {
  const color = getAvatarColor(name);
  const initials = getInitials(name);
  const sizeClass = size === 'sm' ? 'message-avatar' : 'avatar';
  return `<div class="${sizeClass}" style="background: ${color}">${initials}</div>`;
}

// Toast
function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 2500);
}

// Screens
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// Login
if (currentUser) showLobby();

document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  currentUser = document.getElementById('username-input').value.trim();
  if (!currentUser) return;
  localStorage.setItem('chat_username', currentUser);
  showLobby();
});

function showLobby() {
  showScreen('lobby-screen');
  document.getElementById('display-username').textContent = currentUser;
  document.getElementById('user-avatar').outerHTML = createAvatarHTML(currentUser);
  loadRooms();
}

function logout() {
  localStorage.removeItem('chat_username');
  currentUser = '';
  location.reload();
}

// Rooms
async function loadRooms() {
  try {
    const res = await fetch('/api/rooms');
    const rooms = await res.json();
    document.getElementById('room-count').textContent = rooms.length;
    const container = document.getElementById('rooms-container');

    if (rooms.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">💭</div>
          <p>Belum ada skun. Buat dulu!</p>
        </div>`;
      return;
    }

    container.innerHTML = rooms.map(room => `
      <div class="room-card" onclick="enterRoom('${room._id}', '${room.name}', '${room.code}')">
        <div class="room-card-header">
          <span class="room-name">${escapeHtml(room.name)}</span>
          <span class="room-code">${room.code}</span>
        </div>
        <div class="room-meta">Klik untuk masuk ke grup</div>
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
    const res = await fetch('/api/rooms', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    const room = await res.json();
    document.getElementById('room-name').value = '';
    showToast(`Skun "${room.name}" berhasil dibuat!`);
    enterRoom(room._id, room.name, room.code);
  } catch (err) {
    console.error(err);
    showToast('Gagal bikin skun');
  }
});

function joinByCode() {
  const code = document.getElementById('join-code').value.trim().toUpperCase();
  if (!code) return;
  fetch('/api/rooms')
    .then(res => res.json())
    .then(rooms => {
      const room = rooms.find(r => r.code === code);
      if (room) {
        enterRoom(room._id, room.name, room.code);
        document.getElementById('join-code').value = '';
      } else {
        showToast('Kode skun gak ketemu!');
      }
    });
}

function enterRoom(roomId, name, code) {
  currentRoom = roomId;
  showScreen('chat-screen');
  document.getElementById('room-title').textContent = name;
  document.getElementById('room-code').textContent = code;
  document.getElementById('messages').innerHTML = '';
  socket.emit('join-room', roomId);
}

function leaveRoom() {
  if (currentRoom) socket.emit('leave-room', currentRoom);
  currentRoom = null;
  showLobby();
}

function copyCode() {
  const code = document.getElementById('room-code').textContent;
  navigator.clipboard.writeText(code).then(() => {
    showToast('Kode berhasil dicopy!');
  });
}

// Socket Events
socket.on('load-messages', (messages) => {
  const container = document.getElementById('messages');
  container.innerHTML = '';
  messages.forEach(msg => appendMessage(msg));
  scrollToBottom();
});

socket.on('new-message', (msg) => {
  appendMessage(msg);
  scrollToBottom();
});

function appendMessage(msg) {
  const isOwn = msg.username === currentUser;
  const container = document.getElementById('messages');
  const div = document.createElement('div');
  div.className = `message ${isOwn ? 'own' : 'other'}`;
  div.innerHTML = `
    ${createAvatarHTML(msg.username, 'sm')}
    <div class="message-content">
      <div class="message-author">${escapeHtml(msg.username)}</div>
      <div class="message-bubble">${escapeHtml(msg.text)}</div>
      <div class="message-time">${formatTime(msg.createdAt)}</div>
    </div>
  `;
  container.appendChild(div);
}

function scrollToBottom() {
  const container = document.getElementById('messages');
  container.scrollTop = container.scrollHeight;
}

// Chat Form
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

// Helpers
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function formatTime(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
}
