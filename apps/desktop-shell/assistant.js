/* ============================================================
   Voice assistant — push-to-talk, FIXED COMMAND SET (not a
   conversational LLM assistant).

   Uses only the browser's built-in Web Speech API: SpeechRecognition
   for speech-to-text and SpeechSynthesis for the spoken reply. No API
   key, no server round-trip, no ongoing cost — but it only understands
   the specific command patterns defined below, not open-ended requests.
   (The alternative — sending the transcript to an LLM so it can reason
   about open-ended requests — would need an API key and a small
   per-request cost; this was the simpler default per your instructions.)

   Click the orb to start listening (push-to-talk), speak one command,
   it stops automatically after you finish talking.
   ============================================================ */

const HABIT_TRACKER_KEY = 'habitTrackerData.v1';
const PROJECT_IDEAS_KEY = 'projectIdeasApp.v1';

const AREA_SYNONYMS = {
  'side hustle': 'sidehustle', 'hustle': 'sidehustle',
  'gym': 'gym', 'workout': 'gym',
  'bjj': 'bjj', 'jiu jitsu': 'bjj', 'jiu-jitsu': 'bjj', 'jitsu': 'bjj',
  'coding': 'coding', 'code': 'coding',
  'personal growth': 'growth', 'growth': 'growth',
  'screen time': 'screentime', 'screentime': 'screentime',
};
const AREA_LABELS = {
  sidehustle: 'side hustle', gym: 'gym', bjj: 'BJJ', coding: 'coding',
  growth: 'personal growth', screentime: 'screen time',
};

const APP_OPEN_SYNONYMS = {
  'session notes': 'notes', 'notes': 'notes', 'note': 'notes',
  'habit tracker': 'tracker', 'tracker': 'tracker', 'habits': 'tracker',
  'day planner': 'calendar', 'calendar': 'calendar', 'planner': 'calendar',
  'project ideas': 'ideas', 'ideas': 'ideas', 'projects': 'ideas', 'backlog': 'ideas',
};

/* ---------- Date helpers (mirror habit-tracker's own logic) ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function addDays(ds, n) {
  const [y, m, d] = ds.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + n);
  return fmtDate(dt);
}

function readJSON(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
function writeJSON(key, data) {
  try { localStorage.setItem(key, JSON.stringify(data)); return true; } catch (e) { return false; }
}

/* ---------- Read current streak directly from the Tracker's storage ---------- */
function getStreak(areaId) {
  const data = readJSON(HABIT_TRACKER_KEY);
  if (!data || !data.days) return null;
  const isDone = (ds) => !!(data.days[ds] && data.days[ds][areaId] && data.days[ds][areaId].done);
  let cursor = todayStr();
  if (!isDone(cursor)) {
    cursor = addDays(cursor, -1);
    if (!isDone(cursor)) return 0;
  }
  let streak = 0;
  while (isDone(cursor)) { streak++; cursor = addDays(cursor, -1); }
  return streak;
}

/* ---------- Write a new idea directly into Project Ideas' storage ---------- */
function addProjectIdea(title) {
  const data = readJSON(PROJECT_IDEAS_KEY) || { version: 1, ideas: [] };
  if (!Array.isArray(data.ideas)) data.ideas = [];
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const now = new Date().toISOString();
  data.ideas.push({ id, title, notes: '', status: 'idea', createdAt: now, updatedAt: now });
  return writeJSON(PROJECT_IDEAS_KEY, data);
}

/* ---------- Fuzzy phrase matching against the synonym maps ---------- */
function findBySynonym(phrase, map) {
  const p = phrase.toLowerCase();
  const keys = Object.keys(map).sort((a, b) => b.length - a.length); // longest match first
  for (const key of keys) {
    if (p.includes(key)) return map[key];
  }
  return null;
}

/* ---------- Fixed command set ---------- */
const COMMANDS = [
  {
    test: /\b(open|launch)\b/i,
    run: (text) => {
      const appId = findBySynonym(text, APP_OPEN_SYNONYMS);
      if (!appId) return `I didn't catch which app to open. Try "open notes" or "open calendar."`;
      if (typeof openApp === 'function') openApp(appId);
      const app = typeof APP_BY_ID !== 'undefined' ? APP_BY_ID[appId] : null;
      return `Opening ${app ? app.label : appId}.`;
    },
  },
  {
    test: /\bclose\b/i,
    run: (text) => {
      const appId = findBySynonym(text, APP_OPEN_SYNONYMS);
      if (!appId) return `I didn't catch which app to close.`;
      if (typeof closeWindow === 'function') closeWindow(appId);
      const app = typeof APP_BY_ID !== 'undefined' ? APP_BY_ID[appId] : null;
      return `Closed ${app ? app.label : appId}.`;
    },
  },
  {
    test: /\bstreak\b/i,
    run: (text) => {
      const areaId = findBySynonym(text, AREA_SYNONYMS);
      if (!areaId) return `I didn't catch which area — try "what's my gym streak" or "what's my coding streak."`;
      const streak = getStreak(areaId);
      if (streak === null) return `I can't find any Habit Tracker data in this browser yet.`;
      return `Your ${AREA_LABELS[areaId]} streak is ${streak} day${streak === 1 ? '' : 's'}.`;
    },
  },
  {
    test: /\badd\b.*\b(idea|project)\b/i,
    run: (text) => {
      const match = text.match(/add\s+(?:a\s+|an\s+)?(?:project\s+)?idea(?:s)?\s*(?:called|titled|for|to|:|-)?\s*(.+)/i);
      const title = match && match[1] ? match[1].trim().replace(/[.!?]+$/, '') : '';
      if (!title) return `What should I call the idea? Try "add a project idea called dark mode toggle."`;
      const ok = addProjectIdea(title);
      return ok ? `Added "${title}" to your project ideas.` : `Something went wrong saving that idea.`;
    },
  },
  {
    test: /\b(help|what can you do|commands)\b/i,
    run: () => `Try: open notes, close calendar, what's my gym streak, or add a project idea called your idea name.`,
  },
];

function handleTranscript(text) {
  for (const cmd of COMMANDS) {
    if (cmd.test.test(text)) return cmd.run(text);
  }
  return `Sorry, I didn't understand that. Say "help" to hear what I can do.`;
}

/* ---------- Wiring: SpeechRecognition (STT) + SpeechSynthesis (TTS) ---------- */
const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;
const orb = document.getElementById('assistantOrb');
const bubble = document.getElementById('assistantBubble');
const heardEl = document.getElementById('assistantHeard');
const saidEl = document.getElementById('assistantSaid');

let recognizing = false;
let bubbleHideTimer = null;

function showBubble(heard, said) {
  heardEl.textContent = heard ? `"${heard}"` : '';
  saidEl.textContent = said || '';
  bubble.hidden = false;
  clearTimeout(bubbleHideTimer);
  bubbleHideTimer = setTimeout(() => { bubble.hidden = true; }, 6000);
}

function speak(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 1.02;
  orb.classList.add('speaking');
  utter.onend = () => orb.classList.remove('speaking');
  utter.onerror = () => orb.classList.remove('speaking');
  window.speechSynthesis.speak(utter);
}

if (!SpeechRecognitionCtor) {
  orb.classList.add('unsupported');
  orb.title = 'Voice commands need a browser with Web Speech API support (e.g. Chrome or Edge).';
  orb.addEventListener('click', () => {
    showBubble('', "Voice commands aren't supported in this browser — try Chrome or Edge.");
  });
} else {
  const recognition = new SpeechRecognitionCtor();
  recognition.continuous = false;
  recognition.interimResults = false;
  recognition.lang = 'en-US';

  recognition.onstart = () => { recognizing = true; orb.classList.add('listening'); };
  recognition.onend = () => { recognizing = false; orb.classList.remove('listening'); };
  recognition.onerror = (e) => {
    recognizing = false;
    orb.classList.remove('listening');
    if (e.error === 'no-speech') { showBubble('', "Didn't hear anything — click the orb and try again."); return; }
    if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
      showBubble('', 'Microphone access is blocked — allow it for this page in your browser settings.');
      return;
    }
    showBubble('', `Voice error: ${e.error}`);
  };
  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const response = handleTranscript(transcript);
    showBubble(transcript, response);
    speak(response);
  };

  orb.addEventListener('click', () => {
    if (recognizing) { recognition.stop(); return; }
    try { recognition.start(); } catch (e) { /* recognition already active — ignore */ }
  });
}
