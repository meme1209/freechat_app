const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// ✅ Serve static files from /client
app.use(express.static(path.join(__dirname, 'client')));

// ✅ Root route explicitly serves index.html
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'client', 'index.html'));
});

// --- Persistent storage ---
const DATA_PATH = path.join(__dirname, 'data.json');

function saveData() {
  fs.writeFileSync(DATA_PATH, JSON.stringify({ chatHistory, dmHistory, roomHistory }, null, 2));
}

function loadData() {
  if (fs.existsSync(DATA_PATH)) {
    const data = JSON.parse(fs.readFileSync(DATA_PATH));
    chatHistory = data.chatHistory || [];
    dmHistory = data.dmHistory || {};
    roomHistory = data.roomHistory || {};
  }
}

// --- In-memory storage ---
let chatHistory = [];
let users = {};                // socket.id → username
let dmHistory = {};
let roomHistory = {};
let roomMembers = {};          // roomName → Set of usernames

loadData();

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
    saveData();
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
      saveData();

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
    const username = users[socket.id];

    if (!roomMembers[roomName]) roomMembers[roomName] = new Set();
    roomMembers[roomName].add(username);

    socket.emit('room_history', roomHistory[roomName] || []);
    io.to(roomName).emit('room_members', Array.from(roomMembers[roomName]));
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
    saveData();

    io.to(room).emit('room_message', message);
  });

  // ✅ Admin/moderator kick control
  socket.on('kick_user', ({ room, target }) => {
    const targetId = Object.keys(users).find(id => users[id] === target);
    if (targetId) {
      io.sockets.sockets.get(targetId)?.leave(room);
      roomMembers[room]?.delete(target);
      io.to(room).emit('room_members', Array.from(roomMembers[room]));
      io.to(targetId).emit('kicked', room);
    }
  });

  // Handle disconnect
  socket.on('disconnect', () => {
    const username = users[socket.id];
    for (const room in roomMembers) {
      roomMembers[room].delete(username);
      io.to(room).emit('room_members', Array.from(roomMembers[room]));
    }
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