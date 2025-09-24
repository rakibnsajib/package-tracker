let token = null;
let currentUser = null;
const chat = document.getElementById('chat');
const input = document.getElementById('msg');
const sendBtn = document.getElementById('send');
const loginBtn = document.getElementById('loginBtn');
const chatLoginBtn = document.getElementById('chatLoginBtn');
const chatSignupBtn = document.getElementById('chatSignupBtn');
const homeLoginBtn = document.getElementById('homeLoginBtn');
const homeSignupBtn = document.getElementById('homeSignupBtn');
const homeAuthActions = document.getElementById('homeAuthActions');
const chatAuthActions = document.getElementById('chatAuthActions');
const loginModal = document.getElementById('loginModal');
const loginForm = document.getElementById('loginForm');
const loginCancel = document.getElementById('loginCancel');
const startBtn = document.getElementById('startTrackingBtn');
const homePage = document.getElementById('homePage');
const chatPage = document.getElementById('chatPage');
const heroArt = document.getElementById('heroArt');
const mapCloseBtn = document.getElementById('mapCloseBtn');
const loginEye = document.getElementById('loginEye');
const sidebarEl = document.getElementById('sidebar');
const pkgListEl = document.getElementById('pkgList');
const pkgEmptyEl = document.getElementById('pkgEmpty');
const historyListEl = document.getElementById('historyList');
const historyEmptyEl = document.getElementById('historyEmpty');
const historyNewBtn = document.getElementById('historyNew');
const historyClearBtn = document.getElementById('historyClear');
const confirmModal = document.getElementById('confirmModal');
const confirmText = document.getElementById('confirmText');
const confirmOk = document.getElementById('confirmOk');
const confirmCancel = document.getElementById('confirmCancel');
// Session-based chat history
let sessions = [];
let activeSessionId = null;

if (startBtn) {
  startBtn.addEventListener('click', () => {
    homePage.style.display = 'none';
    chatPage.style.display = 'block';
    setTimeout(() => {
      if (input) input.focus();
      showWelcome();
    }, 50);
  });
}

// Close map button
if (mapCloseBtn) mapCloseBtn.addEventListener('click', () => hideMap());
if (historyNewBtn) historyNewBtn.addEventListener('click', newChatSession);
if (historyClearBtn) historyClearBtn.addEventListener('click', () => clearAllSessions());
if (loginEye) loginEye.addEventListener('click', () => toggleEye('loginPass', 'loginEye'));

// Top-right actions (home): keep simple behavior
if (homeLoginBtn) homeLoginBtn.addEventListener('click', () => openLogin());
if (homeSignupBtn) homeSignupBtn.addEventListener('click', () => window.location.href = '/signup.html');
if (loginBtn) loginBtn.addEventListener('click', () => openLogin());
if (chatLoginBtn) chatLoginBtn.addEventListener('click', () => openLogin());
if (chatSignupBtn) chatSignupBtn.addEventListener('click', () => window.location.href = '/signup.html');

function openLogin() {
  if (!loginModal) return login();
  loginModal.style.display = 'block';
  document.getElementById('loginUser').focus();
}
function closeLogin() { if (loginModal) loginModal.style.display = 'none'; }
if (loginCancel) loginCancel.addEventListener('click', closeLogin);
if (loginModal) loginModal.addEventListener('click', (e) => { if (e.target.dataset.close) closeLogin(); });

if (loginForm) {
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('loginUser').value.trim();
    const password = document.getElementById('loginPass').value;
    const res = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username, password }) });
    const data = await res.json();
    if (!res.ok) { alert(data.error || 'Login failed'); return; }
    token = data.token; localStorage.setItem('token', token);
    currentUser = data.user || null;
    renderAuthUI(currentUser);
    closeLogin();
  });
}

// If hero image fails to load (wrong path or missing), hide it gracefully
if (heroArt) {
  heroArt.addEventListener('error', () => {
    console.warn('Hero SVG not found at /rider.svg');
    heroArt.style.display = 'none';
  });
}

function appendMsgUI(text, who = 'bot') {
  const row = document.createElement('div');
  row.className = `msg ${who}`;
  const bubble = document.createElement('div');
  bubble.className = 'bubble';
  bubble.textContent = text;
  row.appendChild(bubble);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
}

function appendMapUI(lat, lng, label = '') {
  const row = document.createElement('div');
  row.className = 'msg bot full';
  const bubble = document.createElement('div');
  bubble.className = 'bubble map';
  const mapDiv = document.createElement('div');
  mapDiv.className = 'map-embed';
  // Build an OpenStreetMap embed iframe for robust rendering
  const iframe = document.createElement('iframe');
  const delta = 0.05; // ~small bbox around the point
  const south = (lat - delta).toFixed(6);
  const north = (lat + delta).toFixed(6);
  const west = (lng - delta).toFixed(6);
  const east = (lng + delta).toFixed(6);
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${lat}%2C${lng}`;
  iframe.src = src;
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  mapDiv.appendChild(iframe);
  bubble.appendChild(mapDiv);
  row.appendChild(bubble);
  chat.appendChild(row);
  chat.scrollTop = chat.scrollHeight;
  // init Leaflet after it's in DOM
  // Also enable click to open a larger view

  // Click to open fullscreen map modal
  bubble.style.cursor = 'pointer';
  bubble.title = 'Click to view full map';
  bubble.addEventListener('click', () => openMapModal(lat, lng, label));
}

function addMsg(text, who = 'bot', opts = {}) {
  appendMsgUI(text, who);
  if (opts.record && activeSessionId) {
    const s = sessions.find(s => s.id === activeSessionId);
    if (s) { s.messages.push({ type: 'text', who, text }); saveSessions(); renderHistorySidebar(); }
  }
}

function addMapMessage(lat, lng, label = '', opts = {}) {
  appendMapUI(lat, lng, label);
  if (opts.record && activeSessionId) {
    const s = sessions.find(s => s.id === activeSessionId);
    if (s) { s.messages.push({ type: 'map', lat, lng, label }); saveSessions(); renderHistorySidebar(); }
  }
}

function openMapModal(lat, lng, label='') {
  const modal = document.getElementById('mapModal');
  const closeBtn = document.getElementById('mapClose');
  const modalMapDiv = document.getElementById('modalMap');
  if (!modal) return;
  modal.style.display = 'block';
  const setup = () => {
    modalMapDiv.innerHTML = '';
    const delta = 0.03;
    const south = (lat - delta).toFixed(6);
    const north = (lat + delta).toFixed(6);
    const west = (lng - delta).toFixed(6);
    const east = (lng + delta).toFixed(6);
    const src = `https://www.openstreetmap.org/export/embed.html?bbox=${west}%2C${south}%2C${east}%2C${north}&layer=mapnik&marker=${lat}%2C${lng}`;
    const iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.width = '100%';
    iframe.style.height = '100%';
    iframe.style.border = '0';
    iframe.referrerPolicy = 'no-referrer-when-downgrade';
    modalMapDiv.appendChild(iframe);
  };
  setTimeout(setup, 10);
  const close = () => { modal.style.display = 'none'; modalMapDiv.innerHTML = ''; };
  closeBtn.onclick = close;
  modal.addEventListener('click', (e) => { if (e.target.dataset.close) close(); });
}

async function login() {
  const name = prompt('Enter a display name', 'demo-user') || 'demo-user';
  const res = await fetch('/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ provider: 'mock', code: 'mock', name }) });
  const data = await res.json();
  if (data.token) {
    token = data.token;
    currentUser = data.user || null;
    addMsg(`Logged in as ${currentUser?.name || 'user'}`);
    renderAuthUI(currentUser);
  } else {
    addMsg('Login failed.');
  }
}

function parseCommand(text) {
  const t = text.trim().toUpperCase();
  if (t.startsWith('TRACK ')) return { cmd: 'track', tn: t.slice(6).trim() };
  if (t.startsWith('WHERE ')) return { cmd: 'where', tn: t.slice(6).trim() };
  if (/^[A-Z0-9]{8,20}$/.test(t)) return { cmd: 'track', tn: t };
  if (t.startsWith('HELP')) return { cmd: 'help' };
  return { cmd: 'unknown', raw: text };
}

function findSessionByTitle(title){ return sessions.find(s => (s.title||'').toUpperCase() === String(title||'').toUpperCase()); }

async function doTrack(tn, opts = { record: true, sessionTitle: undefined, dedup: true, clearView: false }) {
  const res = await fetch(`/api/track/${tn}`);
  if (!res.ok) {
    addMsg(`No package found for ${tn}`);
    return;
  }
  const pkg = await res.json();
  const when = new Date(pkg.lastUpdated).toLocaleString();
  const hasLoc = pkg.lastLocationLat != null && pkg.lastLocationLng != null;
  const loc = hasLoc ? `${Number(pkg.lastLocationLat).toFixed(4)}, ${Number(pkg.lastLocationLng).toFixed(4)}` : 'Unknown';
  const message = [
    `📦 Tracking: ${tn}`,
    `🚚 Carrier: ${pkg.carrier || 'Unknown'}`,
    `🧭 Status: ${pkg.status || 'Unknown'}`,
    `⏱️ Updated: ${when}`,
    `📍 Location: ${loc}`
  ].join('\n');
  if (opts.record) {
    // Use or create a session based on sessionTitle (e.g., the package number)
    const title = (opts.sessionTitle || tn);
    // Always de-duplicate to keep unique by tracking number
    const existing = findSessionByTitle(title);
    if (existing) sessions = sessions.filter(s => s.id !== existing.id);
    const session = { id: Date.now(), title, createdAt: Date.now(), messages: [] };
    sessions.push(session);
    activeSessionId = session.id; saveSessions(); renderHistorySidebar();
    // For package selection (or when requested), show only this session's messages
    if (opts.clearView) { clearChatUI(); hideMap(); }
    addMsg(message, 'bot', { record: true });
    if (hasLoc) addMapMessage(pkg.lastLocationLat, pkg.lastLocationLng, `Tracking ${tn}`, { record: true });
  } else {
    appendMsgUI(message, 'bot');
    if (hasLoc) appendMapUI(pkg.lastLocationLat, pkg.lastLocationLng, `Tracking ${tn}`);
  }
  if (hasLoc) maybeShowMap(pkg); else hideMap();
}

// Bring back dedicated full-width map below messages
let mapInstance = null, marker = null;
function hideMap(){
  const mapEl = document.getElementById('map');
  if (mapEl) mapEl.style.display = 'none';
}
function maybeShowMap(pkg) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  const lat = pkg.lastLocationLat, lng = pkg.lastLocationLng;
  setMapAt(lat, lng);
}

function setMapAt(lat, lng) {
  const mapEl = document.getElementById('map');
  if (!mapEl) return;
  if (lat == null || lng == null) { mapEl.style.display = 'none'; return; }
  mapEl.style.display = 'block';
  setTimeout(() => {
    if (!mapInstance) {
      mapInstance = L.map('map').setView([lat, lng], 11);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(mapInstance);
    }
    if (marker) marker.remove();
    marker = L.marker([lat, lng]).addTo(mapInstance);
    mapInstance.setView([lat, lng], 11);
    setTimeout(() => mapInstance.invalidateSize(), 50);
  }, 20);
}

function help() {
  addMsg('Try: \n- Enter a tracking number (e.g., PKG12345678)\n- track PKG12345678\n- where PKG12345678\nUse Login for create/update/delete via APIs.');
}

async function onSend() {
  const text = input.value.trim();
  if (!text) return;
  input.value = '';
  appendMsgUI(text, 'user');
  const cmd = parseCommand(text);
  if (cmd.cmd === 'track') return doTrack(cmd.tn);
  if (cmd.cmd === 'where') return doTrack(cmd.tn);
  if (cmd.cmd === 'help') return help();
  addMsg("I didn't understand. Type 'help'.");
}

sendBtn.addEventListener('click', onSend);
input.addEventListener('keydown', (e) => { if (e.key === 'Enter') onSend(); });

function renderAuthUI(user) {
  const avatar = (user && user.avatar) ? user.avatar : '/default-avatar.svg';
  const el = (label) => {
    const wrap = document.createElement('div');
    wrap.className = 'auth-user';
    const img = document.createElement('img'); img.src = avatar; img.alt = 'user';
    const btn = document.createElement('button'); btn.className = 'btn ghost'; btn.textContent = 'Logout';
    btn.onclick = () => { localStorage.removeItem('token'); token = null; window.location.reload(); };
    wrap.appendChild(img); wrap.appendChild(btn); return wrap;
  };
  if (homeAuthActions) { homeAuthActions.innerHTML = ''; homeAuthActions.appendChild(el('home')); }
  if (chatAuthActions) { chatAuthActions.innerHTML = ''; chatAuthActions.appendChild(el('chat')); }

  // Enable sidebar for logged-in users
  if (sidebarEl) sidebarEl.style.display = user ? 'flex' : 'none';
  if (user) {
    document.querySelector('.chat-layout').style.gap = '12px';
    loadSessions();
    refreshPackages();
  }
}

// Restore auth + sessions on load
const savedToken = localStorage.getItem('token');
if (savedToken) {
  token = savedToken;
  fetch('/auth/me', { headers: { Authorization: 'Bearer ' + token } }).then(async (r) => {
    if (!r.ok) return;
    const data = await r.json();
    currentUser = data.user || null;
    renderAuthUI(currentUser);
  }).catch(() => {});
}

// Show a soft welcome only when chat page is visible
const showWelcome = () => {
  const first = (currentUser && currentUser.name) ? String(currentUser.name).split(' ')[0] : null;
  if (first) {
    addMsg(`Welcome ${first}! Please enter your tracking number to begin.\nExample: PKG12345678`);
  } else {
    addMsg('Welcome! Please enter your tracking number to begin.\nExample: PKG12345678');
  }
};
// If user landed directly on chat (e.g., after refresh when visible), show welcome
if (chatPage && chatPage.style.display !== 'none') showWelcome();

// Sessions persistence per user
function sessionsKey() { return currentUser ? `chat-sessions:${currentUser.id}` : null; }
function saveSessions(){ const k = sessionsKey(); if (k) localStorage.setItem(k, JSON.stringify(sessions)); }
function loadSessions(){ const k = sessionsKey(); if (!k) return; const raw = localStorage.getItem(k); sessions = raw ? JSON.parse(raw) : []; purgeNewChatSessions(); saveSessions(); renderHistorySidebar(); }
function purgeNewChatSessions(){ sessions = sessions.filter(s => !(String(s.title||'').toUpperCase().startsWith('NEW CHAT'))); }
function renderHistorySidebar(){ if (!historyListEl || !historyEmptyEl) return; historyListEl.innerHTML='';
  const visible = sessions.filter(s => !(String(s.title||'').toUpperCase().startsWith('NEW CHAT')));
  if (historyClearBtn) historyClearBtn.disabled = visible.length === 0;
  if (!visible.length){ historyEmptyEl.style.display='block'; return; } historyEmptyEl.style.display='none';
  visible.slice().reverse().forEach(s=>{
    const li=document.createElement('li');
    const first = s.messages.find(m=>m.type==='text');
    const text = first ? (first.text.split('\n')[0]).slice(0,80) : (s.title||'Session');
    const span=document.createElement('span'); span.className='text'; span.textContent=text; span.title=s.title||'';
    const del=document.createElement('button'); del.className='del'; del.textContent='🗑'; del.title='Delete';
    del.addEventListener('click', (e)=>{ e.stopPropagation(); sessions = sessions.filter(x=>x.id!==s.id); saveSessions(); renderHistorySidebar(); if (activeSessionId===s.id){ clearChatUI(); hideMap(); }});
    li.appendChild(span);
    li.appendChild(del);
    li.dataset.id = s.id;
    li.addEventListener('click', ()=> openSession(s.id));
    historyListEl.appendChild(li);
  }); }

function clearChatUI(){ chat.innerHTML=''; }
function openSession(id){
  const s = sessions.find(x=>x.id==id); if (!s) return; activeSessionId = s.id; clearChatUI();
  s.messages.forEach(m=>{ if (m.type==='text'){ appendMsgUI(m.text, m.who||'bot'); } else if (m.type==='map'){ appendMapUI(m.lat, m.lng, m.label); } });
  // Also update the full-width map to the last map in the session
  const lastMap = [...s.messages].reverse().find(m=>m.type==='map');
  if (lastMap) setMapAt(lastMap.lat, lastMap.lng); else hideMap();
  chat.scrollTop = chat.scrollHeight;
}

function newChatSession(){
  const session = { id: Date.now(), title: `New Chat ${new Date().toLocaleTimeString()}`, createdAt: Date.now(), messages: [] };
  sessions.push(session); activeSessionId = session.id; saveSessions(); renderHistorySidebar();
  clearChatUI(); hideMap();
}

async function clearAllSessions(){
  if (!sessions.length) return;
  const ok = await showConfirm('Delete all history?');
  if (!ok) return;
  sessions = []; activeSessionId = null; saveSessions(); renderHistorySidebar(); clearChatUI(); hideMap();
}

function showConfirm(message){
  return new Promise((resolve) => {
    if (!confirmModal) return resolve(window.confirm(message));
    confirmText.textContent = message;
    confirmModal.style.display = 'block';
    const cleanup = () => {
      confirmModal.style.display = 'none';
      confirmOk.onclick = null; confirmCancel.onclick = null;
    };
    confirmOk.onclick = () => { cleanup(); resolve(true); };
    confirmCancel.onclick = () => { cleanup(); resolve(false); };
    confirmModal.addEventListener('click', (e) => { if (e.target.dataset.close) { cleanup(); resolve(false); } }, { once: true });
  });
}

function eyeSVG(open=true){
  return open
    ? '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-7 11-7 11 7 11 7-4 7-11 7-11-7-11-7z"/><circle cx="12" cy="12" r="3"/></svg>'
    : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.94 10.94 0 0 1 12 20c-7 0-11-8-11-8a21.77 21.77 0 0 1 5.06-6.94M9.9 4.24A10.94 10.94 0 0 1 12 4c7 0 11 8 11 8a21.77 21.77 0 0 1-5.06 6.94"/><path d="M1 1l22 22"/><path d="M14.12 14.12A3 3 0 1 1 9.88 9.88"/></svg>';
}
function toggleEye(inputId, btnId){
  const input = document.getElementById(inputId);
  const btn = document.getElementById(btnId);
  if (!input || !btn) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.innerHTML = eyeSVG(!show);
  btn.setAttribute('aria-label', show ? 'Hide password' : 'Show password');
}

// Packages sidebar
async function refreshPackages(){
  if (!pkgListEl || !pkgEmptyEl || !token) return;
  const res = await fetch('/api/my-packages',{ headers:{ Authorization:'Bearer '+token }});
  pkgListEl.innerHTML='';
  if (!res.ok){ pkgEmptyEl.style.display='block'; return; }
  const rows = await res.json();
  if (!rows.length){ pkgEmptyEl.style.display='block'; } else {
    pkgEmptyEl.style.display='none';
    rows.forEach(r=>{
      const li=document.createElement('li');
      const title=document.createElement('span'); title.className='title'; title.textContent=r.trackingNumber;
      const sub=document.createElement('span'); sub.className='sub'; sub.textContent=`${r.carrier||''} • ${r.status||''}`;
      li.appendChild(title); li.appendChild(sub);
      li.addEventListener('click',()=> {
        const s = findSessionByTitle(r.trackingNumber);
        if (s) { openSession(s.id); }
        else { doTrack(r.trackingNumber, { record: true, sessionTitle: r.trackingNumber, clearView: true }); }
      });
      pkgListEl.appendChild(li);
    });
  }
}
