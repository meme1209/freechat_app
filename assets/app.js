
// Lightweight client-side app script
// WARNING: This is a client-side implementation (no server). Storing credentials in code and localStorage is insecure.
// You requested an embedded admin account; the admin username and password are included here (password hash).
const EMBEDDED_ADMIN = {
  username: "owner",
  password_hash: "4832740d097b0d8ef454ec9f80033811af7200da3e9c705d72774f527d853c04"
};

// Utility: sha-256 hashing using SubtleCrypto
async function sha256hex(str) {
  const enc = new TextEncoder();
  const data = enc.encode(str);
  const hash = await crypto.subtle.digest('SHA-256', data);
  const hex = Array.from(new Uint8Array(hash)).map(b => b.toString(16).padStart(2,'0')).join('');
  return hex;
}

// LocalStorage helpers
const DB = {
  usersKey: 'fc_users_v1',
  sessionsKey: 'fc_session_v1',
  roomsKey: 'fc_rooms_v1'
};

function loadUsers() {
  const raw = localStorage.getItem(DB.usersKey);
  return raw ? JSON.parse(raw) : {};
}
function saveUsers(u) { localStorage.setItem(DB.usersKey, JSON.stringify(u)); }

function loadRooms() {
  const raw = localStorage.getItem(DB.roomsKey);
  if (raw) return JSON.parse(raw);
  // create sample rooms
  const rooms = {
    'general': {id:'general', name:'General'},
    'random': {id:'random', name:'Random'},
    'support': {id:'support', name:'Support'}
  };
  localStorage.setItem(DB.roomsKey, JSON.stringify(rooms));
  return rooms;
}

async function signup(username, password) {
  username = username.trim();
  if (!username || !password) throw new Error('Missing username or password');
  const users = loadUsers();
  if (users[username]) throw new Error('Username already exists');
  const phash = await sha256hex(password);
  users[username] = { username, password_hash: phash, friends: [], isAdmin: false };
  saveUsers(users);
  return true;
}

async function login(username, password) {
  username = username.trim();
  const users = loadUsers();
  const phash = await sha256hex(password);

  // Check embedded admin first
  if (username === EMBEDDED_ADMIN.username && phash === EMBEDDED_ADMIN.password_hash) {
    // ensure admin user exists in users DB with isAdmin true
    users[username] = users[username] || {username, password_hash: phash, friends: [], isAdmin: true};
    users[username].isAdmin = true;
    saveUsers(users);
    localStorage.setItem(DB.sessionsKey, JSON.stringify({ username }));
    return { username, isAdmin: true };
  }

  if (!users[username]) throw new Error('No such user');
  if (users[username].password_hash !== phash) throw new Error('Incorrect password');
  localStorage.setItem(DB.sessionsKey, JSON.stringify({ username }));
  return { username, isAdmin: !!users[username].isAdmin };
}

function logout() {
  localStorage.removeItem(DB.sessionsKey);
}

function currentUser() {
  const s = localStorage.getItem(DB.sessionsKey);
  if (!s) return null;
  const session = JSON.parse(s);
  const users = loadUsers();
  if (!users[session.username]) return null;
  return users[session.username];
}

// Friends
function addFriend(forUser, friendUsername) {
  const users = loadUsers();
  if (!users[forUser] || !users[friendUsername]) throw new Error('User not found');
  if (!users[forUser].friends.includes(friendUsername)) {
    users[forUser].friends.push(friendUsername);
    saveUsers(users);
  }
}
function removeFriend(forUser, friendUsername) {
  const users = loadUsers();
  if (!users[forUser]) throw new Error('User not found');
  users[forUser].friends = users[forUser].friends.filter(f => f !== friendUsername);
  saveUsers(users);
}

// Simple navigation helpers
function goTo(page, params) {
  const url = new URL(window.location.href);
  url.pathname = page;
  if (params) {
    Object.keys(params).forEach(k => url.searchParams.set(k, params[k]));
  }
  window.location.href = url.toString();
}

// Exported for pages
window.FCA = {
  signup, login, logout, currentUser, loadRooms, addFriend, removeFriend, goTo, sha256hex
};
