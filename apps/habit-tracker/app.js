/* ============================================================
   Habit Tracker — single-user, localStorage-backed, no build step
   ============================================================ */

/* ---------- Config: the 6 tracked areas ---------- */
const AREAS = [
  { id: 'sidehustle', label: 'Side Hustle', icon: '💼', color: '#6366f1', notes: true, notesPlaceholder: 'What did you work on today?', notesAppLink: '../notes/index.html#sidehustle' },
  { id: 'gym', label: 'Gym', icon: '🏋️', color: '#f97316', notes: false },
  { id: 'bjj', label: 'BJJ', icon: '🥋', color: '#14b8a6', notes: true, notesPlaceholder: 'Technique / rolls / progress from today’s session...', notesAppLink: '../notes/index.html#bjj' },
  { id: 'coding', label: 'Coding Skills', icon: '💻', color: '#8b5cf6', notes: true, notesPlaceholder: 'What did you learn or build today?', notesAppLink: '../notes/index.html#coding' },
  { id: 'growth', label: 'Personal Growth', icon: '🌱', color: '#ec4899', notes: true, notesPlaceholder: 'Reflections, small wins, mindset notes...' },
  { id: 'screentime', label: 'Screen Time', icon: '📵', color: '#0ea5e9', notes: true, hasValue: true, valueLabel: 'Hours (optional)', notesPlaceholder: 'Any notes on today’s screen time...' },
];
const AREA_BY_ID = Object.fromEntries(AREAS.map(a => [a.id, a]));
const NOTED_AREAS = AREAS.filter(a => a.notes);

const RATINGS = [
  { id: 'great', label: 'Great day', emoji: '🟩' },
  { id: 'good', label: 'Good day', emoji: '🟢' },
  { id: 'neutral', label: 'Neutral', emoji: '🟡' },
  { id: 'tough', label: 'Tough day', emoji: '🟠' },
  { id: 'rough', label: 'Rough day', emoji: '🔴' },
];

const STORAGE_KEY = 'habitTrackerData.v1';

/* ---------- Date utilities (local time, no timezone surprises) ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function parseDate(ds) { const [y, m, d] = ds.split('-').map(Number); return new Date(y, m - 1, d); }
function todayStr() { return fmtDate(new Date()); }
function addDays(ds, n) { const d = parseDate(ds); d.setDate(d.getDate() + n); return fmtDate(d); }
function addMonths(ds, n) { const d = parseDate(ds); d.setMonth(d.getMonth() + n); return fmtDate(d); }
function dayOfYear(ds) { const d = parseDate(ds); const start = new Date(d.getFullYear(), 0, 1); return Math.floor((d - start) / 86400000) + 1; }
function isLeap(y) { return (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0; }
function daysInYear(y) { return isLeap(y) ? 366 : 365; }
const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DOW_LABELS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

/* ---------- Data store ---------- */
function defaultData() {
  return {
    version: 1,
    days: {},
    settings: { reminderTime: '20:00', notificationsEnabled: false, lastNotifiedDate: null },
  };
}

const Store = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultData();
      if (!this.data.settings) this.data.settings = defaultData().settings;
    } catch (e) {
      console.error('Failed to load habit tracker data, starting fresh.', e);
      this.data = defaultData();
    }
    return this.data;
  },
  _saveTimer: null,
  save(immediate) {
    const doSave = () => {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
        showToast('Saved');
      } catch (e) {
        console.error('Save failed — localStorage may be full or unavailable.', e);
        showToast('Save failed — storage unavailable');
      }
    };
    if (immediate) { clearTimeout(this._saveTimer); doSave(); return; }
    clearTimeout(this._saveTimer);
    this._saveTimer = setTimeout(doSave, 350);
  },
  emptyDayAreas() {
    const obj = {};
    AREAS.forEach(a => {
      obj[a.id] = { done: false, note: '' };
      if (a.hasValue) obj[a.id].value = null;
    });
    return obj;
  },
  getDay(ds) {
    return this.data.days[ds] || { ...this.emptyDayAreas(), rating: null };
  },
  ensureDay(ds) {
    if (!this.data.days[ds]) this.data.days[ds] = { ...this.emptyDayAreas(), rating: null };
    return this.data.days[ds];
  },
  setDone(ds, areaId, done) {
    const day = this.ensureDay(ds);
    day[areaId].done = done;
    this.save();
  },
  setNote(ds, areaId, note) {
    const day = this.ensureDay(ds);
    day[areaId].note = note;
    this.save();
  },
  setValue(ds, areaId, value) {
    const day = this.ensureDay(ds);
    day[areaId].value = value;
    this.save();
  },
  setRating(ds, rating) {
    const day = this.ensureDay(ds);
    day.rating = day.rating === rating ? null : rating;
    this.save(true);
  },
  earliestDate() {
    const keys = Object.keys(this.data.days).sort();
    return keys.length ? keys[0] : todayStr();
  },
};

/* ---------- Streaks & completion math ---------- */
function isDone(ds, areaId) {
  const day = Store.data.days[ds];
  return !!(day && day[areaId] && day[areaId].done);
}

function currentStreak(areaId) {
  const today = todayStr();
  let cursor = today;
  if (!isDone(cursor, areaId)) {
    // Grace period: today not logged yet shouldn't zero out an ongoing streak.
    cursor = addDays(cursor, -1);
    if (!isDone(cursor, areaId)) return 0;
  }
  let streak = 0;
  while (isDone(cursor, areaId)) {
    streak++;
    cursor = addDays(cursor, -1);
  }
  return streak;
}

function bestStreak(areaId) {
  const start = Store.earliestDate();
  let cursor = start;
  const end = todayStr();
  let best = 0, run = 0;
  // Guard against runaway loops if earliestDate is far in the past/future.
  let guard = 0;
  while (cursor <= end && guard < 20000) {
    if (isDone(cursor, areaId)) { run++; best = Math.max(best, run); }
    else run = 0;
    cursor = addDays(cursor, 1);
    guard++;
  }
  return best;
}

function completionPct(areaId, period) {
  const today = todayStr();
  let start;
  if (period === 'week') start = addDays(today, -6);
  else if (period === 'month') { const d = parseDate(today); start = fmtDate(new Date(d.getFullYear(), d.getMonth(), 1)); }
  else start = fmtDate(new Date(parseDate(today).getFullYear(), 0, 1));

  let total = 0, done = 0;
  let cursor = start;
  while (cursor <= today) {
    total++;
    if (isDone(cursor, areaId)) done++;
    cursor = addDays(cursor, 1);
  }
  return total ? Math.round((done / total) * 100) : 0;
}

function overallConsistency(period) {
  const pcts = AREAS.map(a => completionPct(a.id, period));
  return Math.round(pcts.reduce((s, v) => s + v, 0) / pcts.length);
}

/* ---------- Routing ---------- */
const state = { route: 'daily', dailyDate: todayStr(), monthlyMonth: todayStr(), yearlyYear: new Date().getFullYear(), logArea: 'coding' };

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  const [route, arg] = hash.split('/');
  return { route: route || 'daily', arg };
}

function navigate() {
  const { route, arg } = parseHash();
  state.route = ['daily','monthly','yearly','log','stats'].includes(route) ? route : 'daily';
  if (state.route === 'daily' && arg) state.dailyDate = arg;
  if (state.route === 'monthly' && arg) state.monthlyMonth = arg + '-01';
  if (state.route === 'yearly' && arg) state.yearlyYear = parseInt(arg, 10);
  render();
}

window.addEventListener('hashchange', navigate);

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

/* ---------- Render dispatch ---------- */
function render() {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.route === state.route));
  const app = document.getElementById('app');
  if (state.route === 'daily') app.innerHTML = renderDaily(state.dailyDate);
  else if (state.route === 'monthly') app.innerHTML = renderMonthly(state.monthlyMonth);
  else if (state.route === 'yearly') app.innerHTML = renderYearly(state.yearlyYear);
  else if (state.route === 'log') app.innerHTML = renderLog(state.logArea);
  else if (state.route === 'stats') app.innerHTML = renderStats();
  attachViewHandlers();
}

/* ---------- Daily view ---------- */
function renderDaily(ds) {
  const day = Store.getDay(ds);
  const d = parseDate(ds);
  const label = d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const isToday = ds === todayStr();

  const cards = AREAS.map(a => {
    const entry = day[a.id];
    const streak = currentStreak(a.id);
    return `
    <div class="area-card ${entry.done ? 'done' : ''}" data-area="${a.id}">
      <div class="area-card-top">
        <input type="checkbox" class="area-checkbox" data-action="toggle" data-area="${a.id}" ${entry.done ? 'checked' : ''} />
        <span class="area-icon">${a.icon}</span>
        <span class="area-label">${a.label}</span>
        <span class="streak-badge">🔥 ${streak}</span>
      </div>
      ${a.hasValue ? `
        <div class="area-value-row">
          <label class="field-label" style="margin:0;">${a.valueLabel}</label>
          <input type="number" min="0" step="0.25" data-action="value" data-area="${a.id}" value="${entry.value ?? ''}" placeholder="e.g. 3.5" />
        </div>` : ''}
      ${a.notes ? `<textarea class="area-notes" data-action="note" data-area="${a.id}" placeholder="${a.notesPlaceholder || 'Notes...'}">${escapeHtml(entry.note || '')}</textarea>` : ''}
      ${a.notesAppLink ? `<a href="${a.notesAppLink}" class="notes-app-link" target="_blank" rel="noopener">📓 Open detailed log →</a>` : ''}
    </div>`;
  }).join('');

  const ratingBtns = RATINGS.map(r => `
    <button class="rating-btn ${day.rating === r.id ? 'active' : ''}" data-rating="${r.id}" data-action="rating">${r.emoji} ${r.label}</button>
  `).join('');

  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">${isToday ? 'Today' : label}</h2>
        <div class="view-sub">${isToday ? label : ''}</div>
      </div>
      <div class="nav-arrows">
        <button class="btn small" data-action="daily-prev">← Prev day</button>
        <input type="date" class="date-picker-input" id="dailyDatePick" value="${ds}" />
        <button class="btn small" data-action="daily-today">Today</button>
        <button class="btn small" data-action="daily-next">Next day →</button>
      </div>
    </div>
    <div class="area-grid">${cards}</div>
    <div class="rating-card">
      <div class="rating-title">How did today feel overall? <span style="font-weight:400;color:var(--text-muted);">(shows up in your Yearly view)</span></div>
      <div class="rating-options">${ratingBtns}</div>
    </div>
  `;
}

/* ---------- Monthly view ---------- */
function renderMonthly(monthDs) {
  const d = parseDate(monthDs);
  const year = d.getFullYear(), month = d.getMonth();
  const firstOfMonth = new Date(year, month, 1);
  const startPad = firstOfMonth.getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = todayStr();

  let cells = '';
  for (let i = 0; i < startPad; i++) cells += `<div class="cal-cell empty"></div>`;
  for (let day = 1; day <= daysInMonth; day++) {
    const ds = `${year}-${pad2(month + 1)}-${pad2(day)}`;
    const dayData = Store.data.days[ds];
    const doneCount = dayData ? AREAS.filter(a => dayData[a.id] && dayData[a.id].done).length : 0;
    const isFuture = ds > today;
    const intensity = isFuture ? 0 : doneCount / AREAS.length;
    const bg = intensity === 0 ? 'var(--surface)' : `color-mix(in srgb, var(--accent) ${Math.round(intensity * 85 + 10)}%, var(--surface))`;
    cells += `
      <div class="cal-cell ${ds === today ? 'today' : ''}" data-action="open-day" data-date="${ds}" style="background:${bg};">
        <span>${day}</span>
        ${!isFuture ? `<span class="frac">${doneCount}/${AREAS.length}</span>` : ''}
      </div>`;
  }

  const dowHeader = DOW_LABELS.map(l => `<div class="cal-dow">${l}</div>`).join('');

  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">${MONTH_NAMES[month]} ${year}</h2>
        <div class="view-sub">Shading = fraction of the 6 areas completed that day</div>
      </div>
      <div class="nav-arrows">
        <button class="btn small" data-action="month-prev">← Prev</button>
        <button class="btn small" data-action="month-today">This month</button>
        <button class="btn small" data-action="month-next">Next →</button>
      </div>
    </div>
    <div class="cal-grid">${dowHeader}${cells}</div>
  `;
}

/* ---------- Yearly view ---------- */
function buildYearGridDays(year) {
  const jan1 = new Date(year, 0, 1);
  const dec31 = new Date(year, 11, 31);
  const gridStart = new Date(jan1); gridStart.setDate(jan1.getDate() - jan1.getDay());
  const gridEnd = new Date(dec31); gridEnd.setDate(dec31.getDate() + (6 - dec31.getDay()));
  const days = [];
  const cur = new Date(gridStart);
  while (cur <= gridEnd) { days.push(new Date(cur)); cur.setDate(cur.getDate() + 1); }
  return days;
}

function renderYearly(year) {
  const days = buildYearGridDays(year);
  const weeks = days.length / 7;
  const today = todayStr();

  let monthLabels = '';
  let lastMonth = -1;
  for (let w = 0; w < weeks; w++) {
    const weekFirstDay = days[w * 7];
    const m = weekFirstDay.getFullYear() === year ? weekFirstDay.getMonth() : -1;
    if (m !== -1 && m !== lastMonth && weekFirstDay.getDate() <= 7) {
      monthLabels += `<span style="grid-column:${w + 1};">${MONTH_NAMES[m].slice(0, 3)}</span>`;
      lastMonth = m;
    }
  }

  let gridCells = '';
  days.forEach(d => {
    if (d.getFullYear() !== year) { gridCells += `<div class="year-cell pad"></div>`; return; }
    const ds = fmtDate(d);
    if (ds > today) { gridCells += `<div class="year-cell future" title="${ds}"></div>`; return; }
    const dayData = Store.data.days[ds];
    const rating = dayData ? dayData.rating : null;
    const doneCount = dayData ? AREAS.filter(a => dayData[a.id] && dayData[a.id].done).length : 0;
    const cls = rating ? rating : '';
    gridCells += `<div class="year-cell ${cls} ${ds === today ? 'today' : ''}" data-action="open-year-day" data-date="${ds}" title="${ds} — ${doneCount}/${AREAS.length} areas done${rating ? ' — ' + rating : ''}"></div>`;
  });

  const dowLabels = DOW_LABELS.map(l => `<span>${l[0]}</span>`).join('');

  const ratingCounts = { great: 0, good: 0, neutral: 0, tough: 0, rough: 0 };
  Object.entries(Store.data.days).forEach(([ds, dayData]) => {
    if (parseDate(ds).getFullYear() === year && dayData.rating) ratingCounts[dayData.rating]++;
  });

  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">${year} Overview</h2>
        <div class="view-sub">Click any day to rate how it felt. ${ratingCounts.great} great · ${ratingCounts.good} good · ${ratingCounts.neutral} neutral · ${ratingCounts.tough} tough · ${ratingCounts.rough} rough days logged this year.</div>
      </div>
      <div class="nav-arrows">
        <button class="btn small" data-action="year-prev">← ${year - 1}</button>
        <button class="btn small" data-action="year-today">This year</button>
        <button class="btn small" data-action="year-next">${year + 1} →</button>
      </div>
    </div>
    <div class="year-scroll">
      <div class="year-grid-wrap">
        <div class="year-months">${monthLabels}</div>
        <div class="year-body">
          <div class="year-dow-labels">${dowLabels}</div>
          <div class="year-grid">${gridCells}</div>
        </div>
      </div>
    </div>
    <div class="year-legend">
      <span><span class="legend-dot" style="background:var(--border)"></span>No rating</span>
      <span><span class="legend-dot" style="background:var(--great)"></span>Great</span>
      <span><span class="legend-dot" style="background:var(--good)"></span>Good</span>
      <span><span class="legend-dot" style="background:var(--neutral)"></span>Neutral</span>
      <span><span class="legend-dot" style="background:var(--tough)"></span>Tough</span>
      <span><span class="legend-dot" style="background:var(--rough)"></span>Rough</span>
    </div>
  `;
}

/* ---------- Log view (progression history per area) ---------- */
function renderLog(areaId) {
  const area = AREA_BY_ID[areaId] || NOTED_AREAS[0];
  const options = NOTED_AREAS.map(a => `<option value="${a.id}" ${a.id === area.id ? 'selected' : ''}>${a.icon} ${a.label}</option>`).join('');

  const entries = Object.entries(Store.data.days)
    .filter(([ds, dayData]) => dayData[area.id] && (dayData[area.id].note?.trim() || dayData[area.id].done))
    .sort((a, b) => b[0].localeCompare(a[0]));

  const list = entries.length ? entries.map(([ds, dayData]) => {
    const entry = dayData[area.id];
    const label = parseDate(ds).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
    return `
      <div class="log-entry">
        <div class="log-entry-top">
          <span class="log-date">${label}</span>
          <span class="log-done ${entry.done ? 'yes' : 'no'}">${entry.done ? 'Done' : 'Not logged'}</span>
        </div>
        ${entry.note ? `<div class="log-note">${escapeHtml(entry.note)}</div>` : ''}
      </div>`;
  }).join('') : `<div class="log-empty">No entries yet for ${area.label}. Log a day to start building your history.</div>`;

  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">Progression Log</h2>
        <div class="view-sub">Every note you've written for this area, most recent first.</div>
      </div>
      <select class="log-select" id="logAreaSelect">${options}</select>
    </div>
    <div class="log-list">${list}</div>
  `;
}

/* ---------- Stats view ---------- */
function renderStats() {
  const consistency = overallConsistency('month');
  const cards = AREAS.map(a => {
    const cur = currentStreak(a.id);
    const best = bestStreak(a.id);
    const w = completionPct(a.id, 'week');
    const m = completionPct(a.id, 'month');
    const y = completionPct(a.id, 'year');
    return `
      <div class="stat-card">
        <div class="stat-card-top">
          <span class="stat-card-title">${a.icon} ${a.label}</span>
        </div>
        <div class="stat-streaks">
          <span class="stat-pill">🔥 Current: ${cur}d</span>
          <span class="stat-pill">🏆 Best: ${best}d</span>
        </div>
        <div class="progress-row"><span style="width:60px;">Week</span><div class="progress-bar"><div class="progress-fill" style="width:${w}%;background:${a.color};"></div></div><span>${w}%</span></div>
        <div class="progress-row"><span style="width:60px;">Month</span><div class="progress-bar"><div class="progress-fill" style="width:${m}%;background:${a.color};"></div></div><span>${m}%</span></div>
        <div class="progress-row"><span style="width:60px;">Year</span><div class="progress-bar"><div class="progress-fill" style="width:${y}%;background:${a.color};"></div></div><span>${y}%</span></div>
      </div>`;
  }).join('');

  const totalDaysTracked = Object.keys(Store.data.days).length;

  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">Stats & Summary</h2>
        <div class="view-sub">Your consistency across all 6 areas.</div>
      </div>
    </div>
    <div class="stats-hero">
      <div>
        <div class="stats-hero-num">${consistency}%</div>
        <div class="stats-hero-label">Overall consistency this month</div>
      </div>
      <div class="stats-hero-breakdown">
        <div><b>${overallConsistency('week')}%</b>This week</div>
        <div><b>${overallConsistency('year')}%</b>This year</div>
        <div><b>${totalDaysTracked}</b>Days logged (all time)</div>
      </div>
    </div>
    <div class="stat-grid">${cards}</div>
  `;
}

/* ---------- Day popover (used by Monthly + Yearly) ---------- */
function openDayPopover(ds) {
  const day = Store.getDay(ds);
  const label = parseDate(ds).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const rows = AREAS.map(a => `
    <div class="day-popover-row"><span>${a.icon} ${a.label}</span><span class="${day[a.id].done ? '' : 'dim'}">${day[a.id].done ? '✓ Done' : '— Not logged'}</span></div>
  `).join('');

  const ratingBtns = RATINGS.map(r => `<button class="rating-btn ${day.rating === r.id ? 'active' : ''}" data-rating="${r.id}" data-action="popover-rating" data-date="${ds}">${r.emoji} ${r.label}</button>`).join('');

  openModal(`
    <div class="modal-title">${label}<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="day-popover-summary">${rows}</div>
    <div class="rating-title">Day rating</div>
    <div class="rating-options" style="margin-bottom:16px;">${ratingBtns}</div>
    <div class="modal-actions">
      <a class="btn primary" href="#/daily/${ds}" data-action="close-modal">Edit this day →</a>
    </div>
  `);
}

/* ---------- Settings modal ---------- */
function openSettingsModal() {
  const s = Store.data.settings;
  const permission = ('Notification' in window) ? Notification.permission : 'unsupported';
  openModal(`
    <div class="modal-title">Settings & Reminders<button class="modal-close" data-action="close-modal">✕</button></div>

    <div class="field-group">
      <label class="field-label">Daily reminder time</label>
      <input type="time" class="time-input" id="reminderTimeInput" value="${s.reminderTime}" />
    </div>

    <div class="field-group switch-row">
      <div>
        <label class="field-label" style="margin-bottom:2px;">Browser notifications</label>
        <div class="field-help">Status: ${permission}</div>
      </div>
      <button class="btn primary small" id="enableNotifBtn">${s.notificationsEnabled ? 'Enabled ✓' : 'Enable'}</button>
    </div>
    <div class="field-help">
      This uses your browser's Web Notification API. It only works <b>while this tab or app is open</b> on this device — it cannot wake your phone or computer from being closed, and there's no server involved. Closing the browser/tab means no reminder fires.
    </div>

    <hr class="divider" />

    <div class="field-group">
      <label class="field-label">True phone/computer push (no app open needed)</label>
      <div class="field-help">
        Real native push notifications (like a text message alert) require a backend push service and an installed PWA/app — a plain local web app genuinely cannot do this reliably, and I'm not standing up a server for a single-user local tool. The most reliable realistic path: export a daily recurring reminder to your phone/computer's own calendar or reminders app, which <i>will</i> notify you natively, offline, every day, forever.
      </div>
      <button class="btn" id="downloadIcsBtn" style="margin-top:10px;">📅 Download daily reminder (.ics)</button>
    </div>

    <hr class="divider" />

    <div class="field-group">
      <label class="field-label">Install as an app (optional)</label>
      <div class="field-help">On desktop Chrome/Edge, use the install icon in the address bar. On phone (Chrome/Safari), use "Add to Home Screen". This makes it launch like a real app and work offline, but reminders still only fire while it's open in the background — see above.</div>
    </div>

    <hr class="divider" />

    <div class="field-group">
      <label class="field-label">Backup your data</label>
      <div class="field-help">All data lives only in this browser's local storage. Export a backup regularly, especially before clearing browser data or switching devices.</div>
      <div class="modal-actions">
        <button class="btn" id="exportBtn">⬇ Export JSON</button>
        <button class="btn" id="importBtn">⬆ Import JSON</button>
        <input type="file" id="importFile" accept="application/json" style="display:none;" />
      </div>
    </div>
  `);

  document.getElementById('reminderTimeInput').addEventListener('change', e => {
    Store.data.settings.reminderTime = e.target.value;
    Store.save(true);
  });

  document.getElementById('enableNotifBtn').addEventListener('click', async () => {
    if (!('Notification' in window)) { showToast('Notifications not supported in this browser'); return; }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      Store.data.settings.notificationsEnabled = true;
      Store.save(true);
      showToast('Notifications enabled');
      closeModal();
      openSettingsModal();
    } else {
      showToast('Permission not granted');
    }
  });

  document.getElementById('downloadIcsBtn').addEventListener('click', () => downloadIcs(Store.data.settings.reminderTime));

  document.getElementById('exportBtn').addEventListener('click', exportData);
  document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
  document.getElementById('importFile').addEventListener('change', importData);
}

/* ---------- Modal helpers ---------- */
function openModal(innerHtml) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `<div class="modal-backdrop" data-action="backdrop"><div class="modal-box">${innerHtml}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

/* ---------- Export / Import ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `habit-tracker-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}
function importData(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || typeof parsed !== 'object' || !parsed.days) throw new Error('Invalid file');
      Store.data = parsed;
      Store.save(true);
      showToast('Data imported');
      closeModal();
      render();
    } catch (err) {
      showToast('Import failed — invalid file');
    }
  };
  reader.readAsText(file);
}

/* ---------- Calendar (.ics) export for real device reminders ---------- */
function downloadIcs(time) {
  const [hh, mm] = time.split(':');
  const now = new Date();
  const dtstart = `${now.getFullYear()}${pad2(now.getMonth() + 1)}${pad2(now.getDate())}T${pad2(hh)}${pad2(mm)}00`;
  const dtstamp = now.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Habit Tracker//Personal//EN',
    'BEGIN:VEVENT',
    'UID:habit-tracker-daily-reminder@local',
    `DTSTAMP:${dtstamp}`,
    `DTSTART:${dtstart}`,
    'DURATION:PT10M',
    'RRULE:FREQ=DAILY',
    'SUMMARY:Log your habits 📋',
    'DESCRIPTION:Open your Habit Tracker and log today\'s progress across all 6 areas.',
    'BEGIN:VALARM',
    'ACTION:DISPLAY',
    'DESCRIPTION:Habit Tracker reminder',
    'TRIGGER:PT0M',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const blob = new Blob([ics], { type: 'text/calendar' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'habit-tracker-daily-reminder.ics';
  a.click();
  URL.revokeObjectURL(url);
  showToast('Calendar file downloaded — open it to add to your calendar app');
}

/* ---------- In-browser notification check loop ---------- */
function checkReminder() {
  const s = Store.data.settings;
  if (!s.notificationsEnabled) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const now = new Date();
  const [rh, rm] = s.reminderTime.split(':').map(Number);
  const reminderMinutes = rh * 60 + rm;
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const today = todayStr();

  if (nowMinutes >= reminderMinutes && s.lastNotifiedDate !== today) {
    const day = Store.getDay(today);
    const allDone = AREAS.every(a => day[a.id] && day[a.id].done);
    if (!allDone) {
      new Notification('Habit Tracker', {
        body: "You haven't logged today's habits yet — take two minutes before the day ends.",
        icon: 'icons/icon.svg',
      });
    }
    s.lastNotifiedDate = today;
    Store.save(true);
  }
}

/* ---------- Utility ---------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/* ---------- Event delegation ---------- */
function attachViewHandlers() {
  const app = document.getElementById('app');

  app.querySelectorAll('[data-action="toggle"]').forEach(el => {
    el.addEventListener('change', () => {
      Store.setDone(state.dailyDate, el.dataset.area, el.checked);
      render();
    });
  });
  app.querySelectorAll('[data-action="note"]').forEach(el => {
    el.addEventListener('input', () => Store.setNote(state.dailyDate, el.dataset.area, el.value));
  });
  app.querySelectorAll('[data-action="value"]').forEach(el => {
    el.addEventListener('input', () => Store.setValue(state.dailyDate, el.dataset.area, el.value === '' ? null : parseFloat(el.value)));
  });
  app.querySelectorAll('[data-action="rating"]').forEach(el => {
    el.addEventListener('click', () => { Store.setRating(state.dailyDate, el.dataset.rating); render(); });
  });

  const dp = document.getElementById('dailyDatePick');
  if (dp) dp.addEventListener('change', () => { location.hash = `#/daily/${dp.value}`; });

  const prevBtn = app.querySelector('[data-action="daily-prev"]');
  if (prevBtn) prevBtn.addEventListener('click', () => { location.hash = `#/daily/${addDays(state.dailyDate, -1)}`; });
  const nextBtn = app.querySelector('[data-action="daily-next"]');
  if (nextBtn) nextBtn.addEventListener('click', () => { location.hash = `#/daily/${addDays(state.dailyDate, 1)}`; });
  const todayBtn = app.querySelector('[data-action="daily-today"]');
  if (todayBtn) todayBtn.addEventListener('click', () => { location.hash = `#/daily/${todayStr()}`; });

  const mPrev = app.querySelector('[data-action="month-prev"]');
  if (mPrev) mPrev.addEventListener('click', () => { location.hash = `#/monthly/${addMonths(state.monthlyMonth, -1).slice(0,7)}`; });
  const mNext = app.querySelector('[data-action="month-next"]');
  if (mNext) mNext.addEventListener('click', () => { location.hash = `#/monthly/${addMonths(state.monthlyMonth, 1).slice(0,7)}`; });
  const mToday = app.querySelector('[data-action="month-today"]');
  if (mToday) mToday.addEventListener('click', () => { location.hash = `#/monthly/${todayStr().slice(0,7)}`; });

  const yPrev = app.querySelector('[data-action="year-prev"]');
  if (yPrev) yPrev.addEventListener('click', () => { location.hash = `#/yearly/${state.yearlyYear - 1}`; });
  const yNext = app.querySelector('[data-action="year-next"]');
  if (yNext) yNext.addEventListener('click', () => { location.hash = `#/yearly/${state.yearlyYear + 1}`; });
  const yToday = app.querySelector('[data-action="year-today"]');
  if (yToday) yToday.addEventListener('click', () => { location.hash = `#/yearly/${new Date().getFullYear()}`; });

  app.querySelectorAll('[data-action="open-day"], [data-action="open-year-day"]').forEach(el => {
    el.addEventListener('click', () => openDayPopover(el.dataset.date));
  });

  const logSelect = document.getElementById('logAreaSelect');
  if (logSelect) logSelect.addEventListener('change', () => { state.logArea = logSelect.value; render(); });
}

document.addEventListener('click', (e) => {
  const closeEl = e.target.closest('[data-action="close-modal"]');
  if (closeEl) { closeModal(); return; }
  const backdrop = e.target.closest('[data-action="backdrop"]');
  if (backdrop && e.target === backdrop) { closeModal(); return; }
  const popRating = e.target.closest('[data-action="popover-rating"]');
  if (popRating) {
    Store.setRating(popRating.dataset.date, popRating.dataset.rating);
    closeModal();
    render();
  }
});

document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);

/* ---------- Init ---------- */
Store.load();
if (!location.hash) location.hash = '#/daily';
navigate();
setInterval(checkReminder, 30000);
checkReminder();

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('sw.js').catch(() => { /* file:// or unsupported — safe to ignore */ });
}
