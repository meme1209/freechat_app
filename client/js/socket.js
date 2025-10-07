const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const usersEl = document.getElementById('users');

const dmBox = document.getElementById('dm-box');
const dmHeader = document.getElementById('dm-header');
const dmTitle = document.getElementById('dm-title');
const dmCloseBtn = document.getElementById('dm-close');
const dmMessages = document.getElementById('dm-messages');
const dmInput = document.getElementById('dm-input');
const dmSendBtn = document.getElementById('dm-send-btn');
const clearDMAlertsBtn = document.getElementById('clear-dm-alerts'); // ✅ NEW

// --- Username setup ---
let myUsername = null;
while (!myUsername) {
  myUsername = prompt("Enter your name:");
}
socket.emit('set_username', myUsername);

// --- State ---
let activeDM = null;
const incomingDMs = new Set(); // track who messaged you

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

function updateUserHighlights() {
  Array.from(usersEl.children).forEach((li) => {
    const name = li.textContent;
    if (incomingDMs.has(name)) {
      li.classList.add('user-highlight'); // ✅ use class instead of inline styles
    } else {
      li.classList.remove('user-highlight');
    }
  });
}

// --- Socket listeners ---

socket.on('chat_history', (history) => {
  messagesEl.innerHTML = '';
  history.forEach((msg) => {
    addMessage(msg, msg.sender === myUsername);
  });
});

socket.on('chat_message', (msg) => {
  addMessage(msg, msg.sender === myUsername);
});

socket.on('user_list', (usernames) => {
  usersEl.innerHTML = '';
  usernames.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;

    li.addEventListener('click', () => {
      if (name === myUsername) return;
      activeDM = name;
      dmTitle.textContent = `Direct message with ${name}`;
      dmMessages.innerHTML = '';
      dmBox.style.display = 'flex';
      socket.emit('request_dm_history', name);
      incomingDMs.delete(name); // clear highlight
      updateUserHighlights();
    });

    usersEl.appendChild(li);
  });

  updateUserHighlights(); // refresh highlights after list update
});

socket.on('private_message', (msg) => {
  const isOwn = msg.from === myUsername;
  addDMMessage(msg, isOwn);

  if (!isOwn) {
    incomingDMs.add(msg.from);
    updateUserHighlights();
  }
});

socket.on('dm_history', (messages) => {
  messages.forEach((msg) => {
    const isOwn = msg.from === myUsername;
    addDMMessage(msg, isOwn);
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

// --- DM Panel Close ---
dmCloseBtn.addEventListener('click', () => {
  dmBox.style.display = 'none';
  activeDM = null;
});

// --- DM Panel Drag ---
let isDragging = false;
let offsetX = 0;
let offsetY = 0;

dmHeader.addEventListener('mousedown', (e) => {
  isDragging = true;
  offsetX = e.clientX - dmBox.offsetLeft;
  offsetY = e.clientY - dmBox.offsetTop;
});

document.addEventListener('mousemove', (e) => {
  if (isDragging) {
    dmBox.style.left = `${e.clientX - offsetX}px`;
    dmBox.style.top = `${e.clientY - offsetY}px`;
    dmBox.style.right = 'auto';
    dmBox.style.bottom = 'auto';
  }
});

document.addEventListener('mouseup', () => {
  isDragging = false;
});

// --- Clear DM Alerts Button ---
clearDMAlertsBtn.addEventListener('click', () => {
  incomingDMs.clear();
  updateUserHighlights();
});