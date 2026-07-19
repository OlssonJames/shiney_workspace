/* ============================================================
   Desktop HUD — ambient status layer on the shell desktop.

   Shows the time, today's six-area completion (read live from the
   Habit Tracker's storage), and the current/next Day Planner block.
   Sits at z-index 1 so windows float over it; it's desktop furniture,
   not a window. Exposes window.CommandCenter so the voice assistant
   can reuse the same data readers for spoken briefings.
   ============================================================ */

const HUD_TRACKER_KEY = 'habitTrackerData.v1';
const HUD_CAL_KEY = 'calendarApp.v1';

/* Same ids/colors as the Habit Tracker's AREAS — functional colors,
   kept meaningful rather than forced into the monochrome theme. */
const HUD_AREAS = [
  { id: 'sidehustle', label: 'Side Hustle', icon: '💼', color: '#6366f1' },
  { id: 'gym', label: 'Gym', icon: '🏋️', color: '#f97316' },
  { id: 'bjj', label: 'BJJ', icon: '🥋', color: '#14b8a6' },
  { id: 'coding', label: 'Coding', icon: '💻', color: '#8b5cf6' },
  { id: 'growth', label: 'Growth', icon: '🌱', color: '#ec4899' },
  { id: 'screentime', label: 'Screen Time', icon: '📵', color: '#0ea5e9' },
];

function hudPad2(n) { return String(n).padStart(2, '0'); }
function hudTodayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${hudPad2(d.getMonth() + 1)}-${hudPad2(d.getDate())}`;
}
function hudRead(key) {
  try { return JSON.parse(localStorage.getItem(key)); } catch (e) { return null; }
}
function hudEscape(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

function hudAreaStatus() {
  const data = hudRead(HUD_TRACKER_KEY);
  const day = data && data.days ? data.days[hudTodayStr()] : null;
  return HUD_AREAS.map(a => ({ ...a, done: !!(day && day[a.id] && day[a.id].done) }));
}

function hudTodaysBlocks() {
  const data = hudRead(HUD_CAL_KEY);
  if (!data || !Array.isArray(data.blocks)) return [];
  const today = hudTodayStr();
  const dow = new Date().getDay();
  const catById = Object.fromEntries((data.categories || []).map(c => [c.id, c]));
  return data.blocks
    .filter(b => {
      if (b.recurrence) {
        const r = b.recurrence;
        if (!Array.isArray(r.daysOfWeek) || !r.daysOfWeek.includes(dow)) return false;
        if (r.startDate && today < r.startDate) return false;
        if (r.endDate && today > r.endDate) return false;
        return true;
      }
      return b.date === today;
    })
    .map(b => {
      const cat = catById[b.categoryId];
      return { ...b, categoryLabel: cat ? cat.label : '', color: cat ? cat.color : '#8f8f96' };
    })
    .sort((a, b) => a.start.localeCompare(b.start));
}

function hudNowNext() {
  const blocks = hudTodaysBlocks();
  const now = new Date().toTimeString().slice(0, 5);
  const current = blocks.find(b => b.start <= now && now < b.end);
  if (current) return { kind: 'now', block: current };
  const next = blocks.find(b => b.start > now);
  if (next) return { kind: 'next', block: next };
  return { kind: 'none' };
}

/* Shared with assistant.js (loaded after this file). */
window.CommandCenter = { areaStatus: hudAreaStatus, todaysBlocks: hudTodaysBlocks, nowNext: hudNowNext };

/* ---------- DOM ---------- */
const hudEl = document.createElement('div');
hudEl.className = 'hud';
hudEl.innerHTML = `
  <div class="hud-clock" id="hudClock"></div>
  <div class="hud-date" id="hudDate"></div>
  <div class="hud-areas" id="hudAreas"></div>
  <button class="hud-block" id="hudBlock" title="Open Day Planner"></button>
  <div class="hud-hint"><kbd>Ctrl</kbd>+<kbd>K</kbd> command palette · <kbd>Alt</kbd>+<kbd>1–4</kbd> apps</div>
`;
document.getElementById('desktop').appendChild(hudEl);

function renderHud() {
  const now = new Date();
  document.getElementById('hudClock').textContent =
    now.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  document.getElementById('hudDate').textContent =
    now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  const areas = hudAreaStatus();
  const doneCount = areas.filter(a => a.done).length;
  document.getElementById('hudAreas').innerHTML = areas.map(a => `
    <button class="hud-area ${a.done ? 'done' : ''}" data-open-app="tracker" title="${a.label}${a.done ? ' — done today' : ''}">
      <span class="hud-area-icon">${a.icon}</span>
      <span class="hud-area-dot" style="${a.done ? `background:${a.color};` : ''}"></span>
    </button>
  `).join('') + `<span class="hud-count">${doneCount}/6</span>`;

  const nn = hudNowNext();
  const blockBtn = document.getElementById('hudBlock');
  if (nn.kind === 'none') {
    blockBtn.innerHTML = `<span class="hud-block-dot" style="background:var(--border);"></span>No blocks scheduled today`;
  } else {
    const title = hudEscape(nn.block.label || nn.block.categoryLabel || 'Untitled block');
    const when = nn.kind === 'now' ? `until ${nn.block.end}` : `at ${nn.block.start}`;
    blockBtn.innerHTML = `<span class="hud-block-dot" style="background:${nn.block.color};"></span>${nn.kind === 'now' ? 'Now' : 'Next'}: ${title} · ${when}`;
  }
}

hudEl.addEventListener('click', (e) => {
  const areaBtn = e.target.closest('[data-open-app]');
  if (areaBtn && typeof openApp === 'function') { openApp(areaBtn.dataset.openApp); return; }
  if (e.target.closest('#hudBlock') && typeof openApp === 'function') openApp('calendar');
});

renderHud();
setInterval(renderHud, 10000);
window.addEventListener('storage', (e) => {
  if (e.key === HUD_TRACKER_KEY || e.key === HUD_CAL_KEY) renderHud();
});
window.addEventListener('focus', renderHud);
