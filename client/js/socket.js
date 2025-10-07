const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const usersEl = document.getElementById('users');
const clearDMAlertsBtn = document.getElementById('clear-dm-alerts');

// --- Username setup ---
let myUsername = null;
while (!myUsername) {
  myUsername = prompt("Enter your name:");
}
socket.emit('set_username', myUsername);

// --- State ---
const incomingDMs = new Set(); // track who messaged you
const dmPanels = {};           // username → panel DOM

// --- Public Chat Helpers ---
function addMessage(msg, isOwn = false) {
  const li = document.createElement('li');
  li.textContent = `[${msg.sender}] ${msg.text}`;
  li.className = isOwn ? 'my-message' : 'other-message';
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

// --- DM Helpers ---
function createDMPanel(username) {
  if (dmPanels[username]) return;

  const panel = document.createElement('div');
  panel.className = 'dm-box';
  panel.style.display = 'flex';
  panel.style.zIndex = 1000;

  panel.innerHTML = `
    <div class="dm-header">
      <span class="dm-title">Direct message with ${username}</span>
      <button class="dm-close">✕</button>
    </div>
    <ul class="dm-messages"></ul>
    <div class="composer">
      <input class="dm-input" placeholder="Type a private message..." autocomplete="off" />
      <button class="dm-send-btn">Send</button>
    </div>
    <div class="dm-typing" style="font-size:12px; padding:4px 8px; color:#93c5fd;"></div>
  `;

  document.body.appendChild(panel);
  dmPanels[username] = panel;

  const closeBtn = panel.querySelector('.dm-close');
  closeBtn.addEventListener('click', () => {
    panel.remove();
    delete dmPanels[username];
  });

  const input = panel.querySelector('.dm-input');
  const sendBtn = panel.querySelector('.dm-send-btn');
  const messagesEl = panel.querySelector('.dm-messages');

  input.addEventListener('input', () => {
    socket.emit('dm_typing', { to: username });
  });

  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') sendDM(username, input, messagesEl);
  });

  sendBtn.addEventListener('click', () => {
    sendDM(username, input, messagesEl);
  });

  socket.emit('request_dm_history', username);
  incomingDMs.delete(username);
  updateUserHighlights();
}

function sendDM(to, inputEl, messagesEl) {
  const text = inputEl.value.trim();
  if (!text) return;
  socket.emit('private_message', { to, text });
  inputEl.value = '';
}

function addDMMessage(msg) {
  const panel = dmPanels[msg.from === myUsername ? msg.to : msg.from];
  if (!panel) return;

  const messagesEl = panel.querySelector('.dm-messages');
  const li = document.createElement('li');
  li.textContent = msg.from === myUsername
    ? `(You → ${msg.to}) ${msg.text}`
    : `(DM from ${msg.from}) ${msg.text}`;
  li.className = 'private-message';
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateUserHighlights() {
  Array.from(usersEl.children).forEach((li) => {
    const name = li.textContent;
    if (incomingDMs.has(name)) {
      li.classList.add('user-highlight');
    } else {
      li.classList.remove('user-highlight');
    }
  });
}

// --- Socket Listeners ---

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
      createDMPanel(name);
    });

    usersEl.appendChild(li);
  });

  updateUserHighlights();
});

socket.on('private_message', (msg) => {
  const target = msg.from === myUsername ? msg.to : msg.from;
  if (!dmPanels[target]) createDMPanel(target);
  addDMMessage(msg);

  if (msg.from !== myUsername) {
    incomingDMs.add(msg.from);
    updateUserHighlights();
  }
});

socket.on('dm_history', (messages) => {
  messages.forEach((msg) => {
    addDMMessage(msg);
  });
});

socket.on('dm_typing', (fromUser) => {
  const panel = dmPanels[fromUser];
  if (!panel) return;
  const typingEl = panel.querySelector('.dm-typing');
  typingEl.textContent = `${fromUser} is typing...`;
  setTimeout(() => {
    typingEl.textContent = '';
  }, 2000);
});

// --- Public Message Sending ---
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

// --- Clear DM Alerts Button ---
clearDMAlertsBtn.addEventListener('click', () => {
  incomingDMs.clear();
  updateUserHighlights();
});