// client/js/socket.js
const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const usersEl = document.getElementById('users');

const dmBox = document.getElementById('dm-box');
const dmHeader = document.getElementById('dm-header');
const dmMessages = document.getElementById('dm-messages');
const dmInput = document.getElementById('dm-input');
const dmSendBtn = document.getElementById('dm-send-btn');

// --- Username setup ---
let myUsername = null;
while (!myUsername) {
  myUsername = prompt("Enter your name:");
}
socket.emit('set_username', myUsername);

// --- State ---
let activeDM = null;

// --- Helpers ---
function addMessage(msg, isOwn = false) {
  const li = document.createElement('li');
  li.textContent = `[${msg.sender}] ${msg.text}`;
  li.className = isOwn ? 'my-message' : 'other-message';
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function addDMMessage(msg, isOwn = false) {
  const li = document.createElement('li');
  li.textContent = isOwn
    ? `(You → ${msg.to}) ${msg.text}`
    : `(DM from ${msg.from}) ${msg.text}`;
  li.className = 'private-message';
  dmMessages.appendChild(li);
  dmMessages.scrollTop = dmMessages.scrollHeight;
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

    // Click to open DM panel
    li.addEventListener('click', () => {
      if (name === myUsername) return; // can't DM yourself
      activeDM = name;
      dmHeader.textContent = `Direct message with ${name}`;
      dmMessages.innerHTML = ''; // clear old DM messages
      dmBox.style.display = 'flex';
    });

    usersEl.appendChild(li);
  });
});

// Private messages
socket.on('private_message', (msg) => {
  const isOwn = msg.from === myUsername;
  addDMMessage(msg, isOwn);
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

// --- Sending DMs ---
function sendDM() {
  const text = dmInput.value.trim();
  if (!text || !activeDM) return;
  socket.emit('private_message', { to: activeDM, text });
  dmInput.value = '';
}

dmSendBtn.addEventListener('click', sendDM);
dmInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') sendDM();
});