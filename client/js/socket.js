const socket = io();

// Elements
const messagesEl = document.getElementById('messages');
const inputEl = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const usersEl = document.getElementById('users');
const clearDMAlertsBtn = document.getElementById('clear-dm-alerts');

const roomInput = document.getElementById('room-input');
const roomJoinBtn = document.getElementById('room-join-btn');
const roomMessages = document.getElementById('room-messages');
const roomTextInput = document.getElementById('room-text-input');
const roomSendBtn = document.getElementById('room-send-btn');
const roomMembersEl = document.getElementById('room-members');

// --- Username setup ---
let myUsername = null;
while (!myUsername) {
  myUsername = prompt("Enter your name:");
}
socket.emit('set_username', myUsername);

// --- State ---
const incomingDMs = new Map(); // username → unread count
const dmPanels = {};           // username → panel DOM

// --- Helpers ---
function formatTime(iso) {
  const date = new Date(iso);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// --- Public Chat Helpers ---
function addMessage(msg, isOwn = false) {
  const li = document.createElement('li');
  li.className = isOwn ? 'my-message' : 'other-message';

  const span = document.createElement('span');
  span.textContent = `[${msg.sender}] ${msg.text}`;

  const time = document.createElement('span');
  time.className = 'message-timestamp';
  time.textContent = formatTime(msg.timestamp);

  li.appendChild(span);
  li.appendChild(time);
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
    <div class="dm-typing"></div>
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
  li.className = 'private-message';

  const span = document.createElement('span');
  span.textContent = msg.from === myUsername
    ? `(You → ${msg.to}) ${msg.text}`
    : `(DM from ${msg.from}) ${msg.text}`;

  const time = document.createElement('span');
  time.className = 'message-timestamp';
  time.textContent = formatTime(msg.timestamp);

  li.appendChild(span);
  li.appendChild(time);
  messagesEl.appendChild(li);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}

function updateUserHighlights() {
  Array.from(usersEl.children).forEach((li) => {
    const name = li.dataset.username;
    const count = incomingDMs.get(name);
    li.textContent = count ? `${name} (${count})` : name;
    li.classList.toggle('user-highlight', count > 0);
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
    li.dataset.username = name;

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
    const count = incomingDMs.get(msg.from) || 0;
    incomingDMs.set(msg.from, count + 1);
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

// --- Group Chat Room ---
roomJoinBtn.addEventListener('click', () => {
  const room = roomInput.value.trim();
  if (!room) return;
  roomMessages.innerHTML = '';
  socket.emit('join_room', room);
});

roomSendBtn.addEventListener('click', () => {
  const room = roomInput.value.trim();
  const text = roomTextInput.value.trim();
  if (!room || !text) return;
  socket.emit('room_message', { room, text });
  roomTextInput.value = '';
});

socket.on('room_history', (messages) => {
  messages.forEach((msg) => {
    addRoomMessage(msg);
  });
});

socket.on('room_message', (msg) => {
  addRoomMessage(msg);
});

function addRoomMessage(msg) {
  const li = document.createElement('li');

  const span = document.createElement('span');
  span.textContent = `[${msg.sender}] ${msg.text}`;

  const time = document.createElement('span');
  time.className = 'message-timestamp';
  time.textContent = formatTime(msg.timestamp);

  li.appendChild(span);
  li.appendChild(time);
  roomMessages.appendChild(li);
  roomMessages.scrollTop = roomMessages.scrollHeight;
}

// --- Room Members + Kick ---
socket.on('room_members', (members) => {
  roomMembersEl.innerHTML = '';
  const currentRoom = roomInput.value.trim();

  members.forEach((name) => {
    const li = document.createElement('li');
    li.textContent = name;

    if (name !== myUsername) {
      const kickBtn = document.createElement('button');
      kickBtn.className = 'kick-btn';
      kickBtn.textContent = 'Kick';
      kickBtn.addEventListener('click', () => {
        socket.emit('kick_user', { room: currentRoom, target: name });
      });
      li.appendChild(kickBtn);
    }

    roomMembersEl.appendChild(li);
  });
});

socket.on('kicked', (room) => {
  alert(`You were removed from room: ${room}`);
  roomMessages.innerHTML = '';
  roomMembersEl.innerHTML = '';
});