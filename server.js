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
  createdBy: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now },
  lastActive: { type: Date, default: Date.now }
}));

const Message = mongoose.model('Message', new mongoose.Schema({
  roomId: { type: String, required: true },
  username: { type: String, required: true },
  text: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}));

// Track online users per room
const roomUsers = new Map();

// REST API
app.get('/api/rooms', async (req, res) => {
  const rooms = await Room.find().sort({ lastActive: -1 });
  res.json(rooms);
});

app.post('/api/rooms', async (req, res) => {
  const { name, createdBy } = req.body;
  const code = Math.random().toString(36).substring(2, 8).toUpperCase();
  const room = await Room.create({ name, code, createdBy, lastActive: new Date() });
  res.json(room);
});

app.get('/api/rooms/:roomId', async (req, res) => {
  const room = await Room.findById(req.params.roomId);
  if (!room) return res.status(404).json({ error: 'Not found' });
  res.json(room);
});

app.delete('/api/rooms/:roomId', async (req, res) => {
  const { roomId } = req.params;
  await Room.findByIdAndDelete(roomId);
  await Message.deleteMany({ roomId });
  res.json({ success: true });
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
    
    // Track user
    if (!roomUsers.has(roomId)) roomUsers.set(roomId, new Set());
    roomUsers.get(roomId).add(socket.id);
    
    // Update last active
    await Room.findByIdAndUpdate(roomId, { lastActive: new Date() });
    
    // Load messages
    const messages = await Message.find({ roomId }).sort({ createdAt: 1 }).limit(100);
    socket.emit('load-messages', messages);
    
    // Notify others
    const count = roomUsers.get(roomId).size;
    socket.to(roomId).emit('user-joined', { count, message: 'Someone joined' });
    io.to(roomId).emit('update-count', count);
    
    console.log(`👤 User joined room: ${roomId} (${count} online)`);
  });

  socket.on('send-message', async (data) => {
    const { roomId, username, text } = data;
    const message = await Message.create({ roomId, username, text });
    io.to(roomId).emit('new-message', message);
    
    // Update last active
    await Room.findByIdAndUpdate(roomId, { lastActive: new Date() });
  });

  socket.on('leave-room', (roomId) => {
    socket.leave(roomId);
    if (roomUsers.has(roomId)) {
      roomUsers.get(roomId).delete(socket.id);
      const count = roomUsers.get(roomId).size;
      io.to(roomId).emit('update-count', count);
      
      // Auto-delete if empty
      if (count === 0) {
        roomUsers.delete(roomId);
        // Optional: delete room after 5 min of being empty
        setTimeout(async () => {
          if (!roomUsers.has(roomId)) {
            await Room.findByIdAndDelete(roomId);
            await Message.deleteMany({ roomId });
            io.emit('room-deleted', roomId);
            console.log(`🗑️ Auto-deleted empty room: ${roomId}`);
          }
        }, 5 * 60 * 1000); // 5 minutes
      }
    }
  });

  socket.on('disconnect', () => {
    // Remove from all rooms
    roomUsers.forEach((users, roomId) => {
      if (users.has(socket.id)) {
        users.delete(socket.id);
        const count = users.size;
        io.to(roomId).emit('update-count', count);
        
        if (count === 0) {
          roomUsers.delete(roomId);
          setTimeout(async () => {
            if (!roomUsers.has(roomId)) {
              await Room.findByIdAndDelete(roomId);
              await Message.deleteMany({ roomId });
              io.emit('room-deleted', roomId);
            }
          }, 5 * 60 * 1000);
        }
      }
    });
    console.log('❌ User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));
