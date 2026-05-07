require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { 
  cors: { origin: '*' },
  transports: ['websocket', 'polling'] 
});

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// MongoDB Connection
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('✅ MongoDB Connected'))
  .catch(err => console.error('❌ MongoDB Error:', err));

// Schemas
const Room = mongoose.model('Room', new mongoose.Schema({
  name: { type: String, required: true },
  code: { type: String, required: true, unique: true },
  createdAt: { type: Date, default: Date.now }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  roomId: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}));

// REST API
app.get('/api/rooms', async (req, res) => {
  const rooms = await Room.find().sort({ createdAt: -1 });
  res.json(rooms);
});

app.post('/api/rooms', async (req, res) => {
  const { name } = req.body;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = await Room.create({ name, code });
  res.json(room);
});

app.get('/api/rooms/:roomId', async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json(room);
});

app.get('/api/rooms/:roomId/messages', async (req, res) => {
  const messages = await Message.find({ roomId: req.params.roomId }).sort({ createdAt: 1 });
  res.json(messages);
});

// Socket.io Real-time
io.on('connection', (socket) => {
  console.log('🔌 User connected:', socket.id);

  socket.on('join-room', async (roomId) => {
    socket.join(roomId);
    const messages = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(100);
    socket.emit('load-messages', messages);
    console.log(`👤 User joined room: ${roomId}`);
  });

  socket.on('send-message', async (data) => {
    const { roomId, username, text } = data;
    const message = await Message.create({ roomId, username, text });
    io.to(roomId).emit('new-message', message);
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
  });

  socket.on('disconnect', () => {
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
