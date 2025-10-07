// client/js/socket.js
const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');

// Add a message to the list
function addMessage(msg) {
  const li = document.createElement('li');
  li.textContent = msg;
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// Listen for messages from server
socket.on('chat_message', (msg) => {
  addMessage(msg);
});

// Send message
function sendMessage() {
  const text = inputEl.value.trim();
  if (!text) return;
  socket.emit('chat_message', text);
  inputEl.value = '';
}

sendBtn.addEventListener('click', sendMessage);
inputEl.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendMessage();
});