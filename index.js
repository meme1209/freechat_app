const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Serve static files from /client
app.use(express.static(path.join(__dirname, 'client')));

// ✅ Root route explicitly serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// --- In-memory storage ---
let chatHistory = [];          // stores { sender, text, timestamp }
let users = {};                // socket.id -> username
let dmHistory = {};            // stores { 'Alice|Bob': [ { from, to, text, timestamp } ] }
let roomHistory = {};          // stores { roomName: [ { sender, text, timestamp } ] }

// 🔌 Socket.IO logic
io.on('connection', (socket) => {
  console.log('a user connected:', socket.id);

  // Send public chat history
  socket.emit('chat_history', chatHistory);

  // Handle username set
  socket.on('set_username', (username) => {
    users[socket.id] = username;
    console.log(`${username} joined`);
    io.emit('user_list', Object.values(users));
  });

  // Handle public chat messages
  socket.on('chat_message', (msg) => {
    const message = {
      sender: users[socket.id] || 'Anonymous',
      text: msg,
      timestamp: new Date().toISOString()
    };
    chatHistory.push(message);
    if (chatHistory.length > 100) chatHistory.shift();
    io.emit('chat_message', message);
  });

  // ✅ Handle private messages with history
  socket.on('private_message', ({ to, text }) => {
    const fromUser = users[socket.id];
    const targetId = Object.keys(users).find(id => users[id] === to);
    if (targetId) {
      const message = {
        from: fromUser,
        to,
        text,
        timestamp: new Date().toISOString()
      };

      const key = [fromUser, to].sort().join('|');
      if (!dmHistory[key]) dmHistory[key] = [];
      dmHistory[key].push(message);
      if (dmHistory[key].length > 100) dmHistory[key].shift();

      io.to(targetId).emit('private_message', message);
      socket.emit('private_message', message);
    }
  });

  // ✅ Handle DM history request
  socket.on('request_dm_history', (targetUser) => {
    const fromUser = users[socket.id];
    const key = [fromUser, targetUser].sort().join('|');
    socket.emit('dm_history', dmHistory[key] || []);
  });

  // ✅ Handle DM typing indicator
  socket.on('dm_typing', ({ to }) => {
    const fromUser = users[socket.id];
    const targetId = Object.keys(users).find(id => users[id] === to);
    if (targetId) {
      io.to(targetId).emit('dm_typing', fromUser);
    }
  });

  // ✅ Handle group room join and history
  socket.on('join_room', (roomName) => {
    socket.join(roomName);
    socket.emit('room_history', roomHistory[roomName] || []);
  });

  // ✅ Handle group room messages
  socket.on('room_message', ({ room, text }) => {
    const sender = users[socket.id];
    const message = {
      sender,
      text,
      timestamp: new Date().toISOString()
    };

    if (!roomHistory[room]) roomHistory[room] = [];
    roomHistory[room].push(message);
    if (roomHistory[room].length > 100) roomHistory[room].shift();

    io.to(room).emit('room_message', message);
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const username = users[socket.id];
    delete users[socket.id];
    console.log(`${username || 'Anonymous'} disconnected`);
    io.emit('user_list', Object.values(users));
  });
});

// 🚀 Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});