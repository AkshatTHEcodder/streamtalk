// ===== Video Platform APP LOGIC =====

let state = {
  userName: 'Alex Kim',
  roomId: '',
  supabaseUrl: '',
  supabaseKey: '',
  sb: null,
  session: null,
  user: null,
  authMode: 'signin', // signin | signup | magic | forgot | recovery
  micOn: true,
  camOn: true,
  screenSharing: false,
  translating: true,
  recording: false,
  streaming: false,
  startTime: null,
  timerInterval: null,
  streamInterval: null,
  viewerCount: 0,
  activeSpeaker: 0,
};

// Supabase (loaded from UMD on demand via ESM import)
async function loadSupabase() {
  if (window.supabase?.createClient) return window.supabase;

  // Use dynamic import so the rest of the app keeps working in demo mode.
  // eslint-disable-next-line no-unused-vars
  const mod = await import('https://esm.sh/@supabase/supabase-js@2');
  window.supabase = { createClient: mod.createClient };
  return window.supabase;
}

function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

function setAuthHint(msg, show = true) {
  const el = document.getElementById('authHint');
  if (!el) return;
  el.style.display = show ? 'block' : 'none';
  el.textContent = msg || '';
}

function readSupabaseConfigFromUI() {
  const authUrl = document.getElementById('authSupabaseUrl')?.value?.trim();
  const authKey = document.getElementById('authSupabaseKey')?.value?.trim();
  const lobbyUrl = document.getElementById('supabaseUrl')?.value?.trim();
  const lobbyKey = document.getElementById('supabaseKey')?.value?.trim();

  const url = authUrl || lobbyUrl || '';
  const key = authKey || lobbyKey || '';
  return { url, key };
}

function persistSupabaseConfig(url, key) {
  if (url) localStorage.setItem('st_supabase_url', url);
  if (key) localStorage.setItem('st_supabase_key', key);
}

function loadSupabaseConfigToUI() {
  const url = localStorage.getItem('st_supabase_url') || '';
  const key = localStorage.getItem('st_supabase_key') || '';
  const ids = ['authSupabaseUrl', 'supabaseUrl'];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = url;
  });
  const kids = ['authSupabaseKey', 'supabaseKey'];
  kids.forEach(id => {
    const el = document.getElementById(id);
    if (el && !el.value) el.value = key;
  });
}

async function ensureSupabaseClient() {
  const { url, key } = readSupabaseConfigFromUI();
  state.supabaseUrl = url;
  state.supabaseKey = key;

  if (!url || !key) {
    state.sb = null;
    return null;
  }

  if (state.sb && state.sb.__st_url === url) return state.sb;

  const sbLib = await loadSupabase();
  const sb = sbLib.createClient(url, key);
  sb.__st_url = url;
  state.sb = sb;
  persistSupabaseConfig(url, key);
  return sb;
}

function setAuthMode(mode) {
  state.authMode = mode;
  const label = document.getElementById('authSubmitLabel');
  const passGroup = document.getElementById('authPasswordGroup');

  if (mode === 'signin') {
    if (label) label.textContent = 'Sign in';
    if (passGroup) passGroup.style.display = 'flex';
  } else if (mode === 'signup') {
    if (label) label.textContent = 'Create account';
    if (passGroup) passGroup.style.display = 'flex';
  } else if (mode === 'magic') {
    if (label) label.textContent = 'Send magic link';
    if (passGroup) passGroup.style.display = 'none';
  } else if (mode === 'forgot') {
    if (label) label.textContent = 'Send reset email';
    if (passGroup) passGroup.style.display = 'none';
  } else if (mode === 'recovery') {
    if (label) label.textContent = 'Set new password';
    if (passGroup) passGroup.style.display = 'flex';
  }
  setAuthHint('', false);
}

async function submitAuth() {
  const sb = await ensureSupabaseClient();
  if (!sb) {
    setAuthHint('Add Supabase URL + anon key first.', true);
    return;
  }

  const email = document.getElementById('authEmail')?.value?.trim();
  const password = document.getElementById('authPassword')?.value || '';
  if (!email) {
    setAuthHint('Please enter your email.', true);
    return;
  }

  setAuthHint('Working...', true);

  try {
    if (state.authMode === 'signin') {
      const { data, error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
      state.session = data.session;
      state.user = data.user;
      setAuthHint('Signed in.', true);
      await afterSignedIn();
    } else if (state.authMode === 'signup') {
      const { data, error } = await sb.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.href.split('#')[0] },
      });
      if (error) throw error;
      state.session = data.session;
      state.user = data.user;
      setAuthHint('Check your email to confirm your account (SMTP). Then come back and sign in.', true);
      if (state.session) await afterSignedIn();
    } else if (state.authMode === 'magic') {
      const { error } = await sb.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: window.location.href.split('#')[0] },
      });
      if (error) throw error;
      setAuthHint('Magic link sent. Check your inbox.', true);
    } else if (state.authMode === 'forgot') {
      const { error } = await sb.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.href.split('#')[0],
      });
      if (error) throw error;
      setAuthHint('Password reset email sent. Open it to set a new password.', true);
    } else if (state.authMode === 'recovery') {
      const { error } = await sb.auth.updateUser({ password });
      if (error) throw error;
      setAuthHint('Password updated. You can continue.', true);
      await afterSignedIn();
    }
  } catch (e) {
    setAuthHint(e?.message || 'Auth failed. Check your Supabase Auth settings.', true);
  }
}

async function afterSignedIn() {
  // Reflect user in lobby header
  const email = state.user?.email || '';
  const row = document.getElementById('accountRow');
  const emailEl = document.getElementById('accountEmail');
  if (row && email) row.style.display = 'flex';
  if (emailEl && email) emailEl.textContent = email;

  // Bring user to lobby
  showScreen('lobby');
  // Keep lobby inputs in sync
  loadSupabaseConfigToUI();
  updateDBStatus();
}

async function logout() {
  const sb = await ensureSupabaseClient();
  if (sb) await sb.auth.signOut();
  state.session = null;
  state.user = null;
  const row = document.getElementById('accountRow');
  if (row) row.style.display = 'none';
  showScreen('auth');
  setAuthMode('signin');
}

function startForgotPassword() {
  setAuthMode('forgot');
}

function continueAsDemo() {
  state.sb = null;
  state.session = null;
  state.user = null;
  const row = document.getElementById('accountRow');
  if (row) row.style.display = 'none';
  showScreen('lobby');
  updateDBStatus();
}

const TRANSLATIONS = {
  greetings: [
    { original: 'Can everyone see my presentation?', translated: '¿Pueden todos ver mi presentación?' },
    { original: 'Let me share some Q3 highlights', translated: '私はQ3のハイライトを共有します' },
    { original: 'Great work from the entire team!', translated: 'Excellent travail de toute l\'équipe!' },
    { original: 'We should schedule a follow-up', translated: 'Wir sollten ein Folgegespräch planen' },
    { original: 'The metrics look very promising', translated: '指標は非常に有望に見えます' },
    { original: 'Any questions before we proceed?', translated: '¿Alguna pregunta antes de continuar?' },
    { original: 'I think we\'re aligned on this', translated: 'Je pense que nous sommes alignés là-dessus' },
    { original: 'Let\'s wrap up in 5 minutes', translated: 'Давайте завершим через 5 минут' },
  ],
};

const SPEAKERS = ['Alex Kim', 'Maria Rodriguez', 'Takeshi Nakamura', 'Sophie Andersson'];

// ===== LOBBY =====
async function joinRoom() {
  const userName = document.getElementById('userName').value.trim() || 'Anonymous';
  const roomId = document.getElementById('roomId').value.trim() || 'room-' + Math.random().toString(36).slice(2, 8);
  const supabaseUrl = document.getElementById('supabaseUrl').value.trim();
  const supabaseKey = document.getElementById('supabaseKey').value.trim();

  state.userName = userName;
  state.roomId = roomId;
  state.supabaseUrl = supabaseUrl;
  state.supabaseKey = supabaseKey;
  persistSupabaseConfig(supabaseUrl, supabaseKey);

  // If Supabase is configured, ensure user is signed in
  await ensureSupabaseClient();
  if (state.sb && !state.user) {
    showScreen('auth');
    setAuthHint('Please sign in to join a room (Supabase Auth).', true);
    return;
  }

  showScreen('room');

  initRoom();
}

// ===== ROOM INIT =====
function initRoom() {
  // Set room info
  document.getElementById('roomBadge').textContent = state.roomId;
  document.getElementById('dbRoomId').textContent = state.roomId;
  const initials = state.userName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  document.getElementById('localInitials').textContent = initials;
  document.getElementById('localName').innerHTML = `${state.userName} <span class="you-tag">YOU</span>`;

  // Connection status
  setTimeout(() => {
    const dot = document.getElementById('connDot');
    const label = document.getElementById('connLabel');
    dot.classList.add('connected');
    label.textContent = 'Connected';
    logDBEvent('join', `${state.userName} joined room`);
  }, 1200);

  // Supabase status
  updateDBStatus();
  upsertActiveRoom().catch(() => {});

  // Start timer
  state.startTime = Date.now();
  state.timerInterval = setInterval(updateTimer, 1000);

  // Start simulations
  setTimeout(startSpeakerSimulation, 2000);
  setTimeout(startTranslationSimulation, 3000);
}

function updateTimer() {
  const elapsed = Math.floor((Date.now() - state.startTime) / 1000);
  const m = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const s = String(elapsed % 60).padStart(2, '0');
  document.getElementById('roomTimer').textContent = `${m}:${s}`;
  if (state.streaming) {
    const dur = Math.floor((Date.now() - state.streamStart) / 1000);
    const dm = String(Math.floor(dur / 60)).padStart(2, '0');
    const ds = String(dur % 60).padStart(2, '0');
    document.getElementById('streamDur').textContent = `${dm}:${ds}`;
  }
}

// ===== SPEAKER SIMULATION =====
function startSpeakerSimulation() {
  rotateSpeaker();
  setInterval(rotateSpeaker, 3500);
}

function rotateSpeaker() {
  const prev = state.activeSpeaker;
  const next = (Math.floor(Math.random() * 4));
  state.activeSpeaker = next;

  document.querySelectorAll('.video-tile').forEach((tile, i) => {
    tile.classList.toggle('active-speaker', i === next);
    const wave = document.getElementById(`wave${i}`);
    if (wave) wave.classList.toggle('active', i === next);
  });
}

// ===== TRANSLATION SIMULATION =====
let transIdx = 0;
function startTranslationSimulation() {
  if (!state.translating) return;
  runTranslation();
  setInterval(() => { if (state.translating) runTranslation(); }, 4500);
}

function runTranslation() {
  const item = TRANSLATIONS.greetings[transIdx % TRANSLATIONS.greetings.length];
  const speaker = SPEAKERS[state.activeSpeaker];
  transIdx++;

  // Add to transcript
  addTranscriptItem(speaker, item.original, item.translated);

  // Show on tile
  const tileTransIds = ['trans0', 'trans1', 'trans3', 'trans3b'];
  const tileEl = document.getElementById(tileTransIds[state.activeSpeaker]);
  if (tileEl) {
    tileEl.textContent = item.translated;
    setTimeout(() => { tileEl.textContent = ''; }, 3500);
  }

  // Log to DB
  logDBEvent('translation', `${speaker}: "${item.original.slice(0, 30)}..."`);
}

function addTranscriptItem(speaker, original, translated) {
  const box = document.getElementById('transcriptBox');
  const empty = box.querySelector('.transcript-empty');
  if (empty) empty.remove();

  const item = document.createElement('div');
  item.className = 'transcript-item';
  item.innerHTML = `
    <div class="trans-speaker">${speaker}</div>
    <div class="trans-original">${original}</div>
    <div class="trans-translated">→ ${translated}</div>
  `;
  box.appendChild(item);
  box.scrollTop = box.scrollHeight;
}

// ===== DB EVENTS =====
function logDBEvent(type, msg) {
  const container = document.getElementById('dbEvents');
  const empty = container.querySelector('.db-empty');
  if (empty) empty.remove();

  const now = new Date();
  const time = `${String(now.getHours()).padStart(2,'0')}:${String(now.getMinutes()).padStart(2,'0')}:${String(now.getSeconds()).padStart(2,'0')}`;

  const row = document.createElement('div');
  row.className = 'db-event-row';
  row.innerHTML = `<span class="ev-time">${time}</span><span class="ev-type">${type}</span><span>${msg}</span>`;
  container.appendChild(row);
  container.scrollTop = container.scrollHeight;

  // Write-through to Supabase when available
  writeSupabaseEvent(type, msg).catch(() => {});
}

function updateDBStatus() {
  const dot = document.getElementById('dbDot');
  const text = document.getElementById('dbStatusText');
  const urlDisplay = document.getElementById('dbUrlDisplay');

  if (state.supabaseUrl) {
    dot.classList.add('connected');
    text.textContent = state.user ? 'Connected (Auth + DB)' : 'DB configured (auth required)';
    urlDisplay.textContent = state.supabaseUrl;
    logDBEvent('connect', 'Supabase realtime channel opened');
  } else {
    dot.style.background = '#f59e0b';
    text.textContent = 'Demo mode (no key)';
    urlDisplay.textContent = 'Add Supabase URL in lobby to connect';
  }
}

async function writeSupabaseEvent(type, msg) {
  const sb = state.sb;
  if (!sb || !state.user || !state.roomId) return;
  await sb.from('realtime_events').insert({
    room_id: state.roomId,
    user_id: state.user.id,
    user_email: state.user.email,
    type,
    message: msg,
    created_at: new Date().toISOString(),
  });
}

async function upsertActiveRoom() {
  const sb = state.sb;
  if (!sb || !state.user || !state.roomId) return;
  await sb.from('active_rooms').upsert({
    room_id: state.roomId,
    host_user_id: state.user.id,
    host_email: state.user.email,
    translation_active: state.translating,
    streaming: state.streaming,
    updated_at: new Date().toISOString(),
  }, { onConflict: 'room_id' });
}

// ===== CONTROLS =====
function toggleMic() {
  state.micOn = !state.micOn;
  const btn = document.getElementById('micBtn');
  btn.classList.toggle('muted', !state.micOn);
  btn.querySelector('.ctrl-icon').textContent = state.micOn ? '🎤' : '🔇';
  btn.querySelector('.ctrl-label').textContent = state.micOn ? 'Mute' : 'Unmuted';
  logDBEvent('media', `Mic ${state.micOn ? 'enabled' : 'muted'}`);
}

function toggleCam() {
  state.camOn = !state.camOn;
  const btn = document.getElementById('camBtn');
  btn.classList.toggle('off', !state.camOn);
  btn.querySelector('.ctrl-icon').textContent = state.camOn ? '📷' : '📵';
  btn.querySelector('.ctrl-label').textContent = state.camOn ? 'Video' : 'Off';
  logDBEvent('media', `Camera ${state.camOn ? 'enabled' : 'disabled'}`);
}

function toggleScreen() {
  state.screenSharing = !state.screenSharing;
  const btn = document.getElementById('screenBtn');
  btn.classList.toggle('active', state.screenSharing);
  btn.querySelector('.ctrl-label').textContent = state.screenSharing ? 'Sharing' : 'Share';
  logDBEvent('screenshare', state.screenSharing ? 'Screen share started' : 'Screen share ended');
}

function toggleTranslation() {
  state.translating = !state.translating;
  const btn = document.getElementById('transBtn');
  btn.classList.toggle('active', state.translating);
  document.getElementById('dbTransActive').textContent = state.translating ? 'true' : 'false';
  logDBEvent('translation', `Translation ${state.translating ? 'enabled' : 'disabled'}`);
  upsertActiveRoom().catch(() => {});
}

function toggleRecord() {
  state.recording = !state.recording;
  const btn = document.getElementById('recBtn');
  btn.classList.toggle('recording', state.recording);
  btn.querySelector('.ctrl-icon').textContent = state.recording ? '⏹' : '⏺';
  btn.querySelector('.ctrl-label').textContent = state.recording ? 'Stop' : 'Record';
  logDBEvent('record', state.recording ? 'Recording started' : 'Recording stopped');
}

function toggleStream() {
  state.streaming = document.getElementById('streamToggle').checked;
  const badge = document.getElementById('streamBadge');
  badge.style.display = state.streaming ? 'flex' : 'none';
  document.getElementById('dbStreaming').textContent = state.streaming ? 'true' : 'false';
  document.getElementById('streamDur').textContent = state.streaming ? '00:00' : '—';

  if (state.streaming) {
    state.streamStart = Date.now();
    state.viewerCount = 0;
    state.streamInterval = setInterval(() => {
      if (state.streaming) {
        state.viewerCount += Math.floor(Math.random() * 5) + 1;
        document.getElementById('viewerCount').textContent = state.viewerCount;
      }
    }, 2000);
    logDBEvent('stream', 'Live broadcast started');
  } else {
    clearInterval(state.streamInterval);
    document.getElementById('viewerCount').textContent = '0';
    logDBEvent('stream', 'Broadcast ended');
  }
  upsertActiveRoom().catch(() => {});
}

// ===== TABS =====
function switchTab(tabName) {
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  document.getElementById(`tab-${tabName}`).classList.add('active');
  event.currentTarget.classList.add('active');

  if (tabName === 'chat') document.getElementById('chatBadge').style.display = 'none';
}

// ===== CHAT =====
function sendChat() {
  const input = document.getElementById('chatInput');
  const msg = input.value.trim();
  if (!msg) return;

  const container = document.getElementById('chatMessages');
  const el = document.createElement('div');
  el.className = 'chat-msg';
  el.innerHTML = `<span class="chat-author">${state.userName}</span><span class="chat-text">${escapeHTML(msg)}</span>`;
  container.appendChild(el);
  container.scrollTop = container.scrollHeight;
  input.value = '';

  logDBEvent('chat', `${state.userName}: "${msg.slice(0, 40)}"`);
}

function escapeHTML(str) {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ===== END CALL =====
function endCall() {
  clearInterval(state.timerInterval);
  clearInterval(state.streamInterval);
  logDBEvent('leave', `${state.userName} left the room`);
  showScreen('lobby');
  // Reset state
  state.streaming = false;
  state.recording = false;
  state.micOn = true;
  state.camOn = true;
  state.screenSharing = false;
  state.translating = true;
}

// ===== BOOTSTRAP =====
async function bootstrap() {
  loadSupabaseConfigToUI();
  await ensureSupabaseClient();

  if (state.sb) {
    // Handle recovery link flow (Supabase puts tokens in URL hash)
    // We'll just try to fetch session; if it exists user will be present.
    const { data } = await state.sb.auth.getSession();
    state.session = data?.session || null;
    state.user = data?.session?.user || null;

    state.sb.auth.onAuthStateChange((_event, session) => {
      state.session = session;
      state.user = session?.user || null;
      const row = document.getElementById('accountRow');
      const emailEl = document.getElementById('accountEmail');
      if (row) row.style.display = state.user ? 'flex' : 'none';
      if (emailEl) emailEl.textContent = state.user?.email || '—';
      updateDBStatus();
    });
  }

  if (state.user) {
    await afterSignedIn();
  } else {
    showScreen('auth');
    setAuthMode('signin');
  }
}

bootstrap().catch(() => {
  showScreen('auth');
  setAuthMode('signin');
  setAuthHint('Failed to initialize Supabase. You can continue as demo.', true);
});

// Expose for inline onclick handlers
window.joinRoom = joinRoom;
window.toggleMic = toggleMic;
window.toggleCam = toggleCam;
window.toggleScreen = toggleScreen;
window.toggleTranslation = toggleTranslation;
window.toggleRecord = toggleRecord;
window.toggleStream = toggleStream;
window.endCall = endCall;
window.switchTab = switchTab;
window.sendChat = sendChat;
window.setAuthMode = setAuthMode;
window.submitAuth = submitAuth;
window.logout = logout;
window.startForgotPassword = startForgotPassword;
window.continueAsDemo = continueAsDemo;
