// server/server.js
const path = require('path');
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve the client folder (your HTML, CSS, JS)
app.use(express.static(path.join(__dirname, '..', 'client')));

// Socket.IO connection
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Listen for chat messages
  socket.on('chat_message', (msg) => {
    // Broadcast to everyone
    io.emit('chat_message', msg);
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
  });
});

// Start the server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`FreeChat running at http://localhost:${PORT}`);
});