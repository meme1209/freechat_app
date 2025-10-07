// client/js/socket.js
const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const usersEl = document.getElementById('users'); // you'll add a <ul id="users"> in index.html

// --- Username setup ---
let myUsername = null;
while (!myUsername) {
  myUsername = prompt("Enter your name:");
}
socket.emit('set_username', myUsername);

// --- Helpers ---
function addMessage(msg, isOwn = false) {
  const li = document.createElement('li');
  li.textContent = `[${msg.sender}] ${msg.text}`;
  li.className = isOwn ? 'my-message' : 'other-message';
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- Socket listeners ---

// Chat history on join
socket.on('chat_history', (history) => {
  messagesEl.innerHTML = ''; // clear
  history.forEach((msg) => {
    addMessage(msg, msg.sender === myUsername);
  });
});

// New chat message
socket.on('chat_message', (msg) => {
  addMessage(msg, msg.sender === myUsername);
});

// User list updates
socket.on('user_list', (usernames) => {
  usersEl.innerHTML = '';
  usernames.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;
    usersEl.appendChild(li);
  });
});

// --- Sending messages ---
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