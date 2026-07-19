/* ============================================================
   Day Planner — minute-by-minute daily/weekly time-blocking calendar
   Dependency: FullCalendar (CDN, standard bundle) for the drag/resize/snap grid.
   Persistence: localStorage, shared-origin sync with the Habit Tracker.
   ============================================================ */

const CALENDAR_STORAGE_KEY = 'calendarApp.v1';
const TRACKER_STORAGE_KEY = 'habitTrackerData.v1';

/* The 6 ids below MUST exactly match the Habit Tracker's AREA ids
   (sidehustle/gym/bjj/coding/growth/screentime) — this is the shared
   schema the two apps sync through. Do not rename without updating both apps. */
const DEFAULT_CATEGORIES = [
  { id: 'sidehustle', label: 'Side Hustle', color: '#6366f1', linkedAreaId: 'sidehustle', locked: true },
  { id: 'gym', label: 'Gym', color: '#f97316', linkedAreaId: 'gym', locked: true },
  { id: 'bjj', label: 'BJJ', color: '#14b8a6', linkedAreaId: 'bjj', locked: true },
  { id: 'coding', label: 'Coding Practice', color: '#8b5cf6', linkedAreaId: 'coding', locked: true },
  { id: 'growth', label: 'Personal Growth', color: '#ec4899', linkedAreaId: 'growth', locked: true },
  { id: 'screentime', label: 'Screen Time', color: '#0ea5e9', linkedAreaId: 'screentime', locked: true },
  { id: 'sleep', label: 'Sleep', color: '#475569', linkedAreaId: null, locked: false },
  { id: 'meals', label: 'Meals', color: '#eab308', linkedAreaId: null, locked: false },
  { id: 'workcommute', label: 'Work / Commute', color: '#78716c', linkedAreaId: null, locked: false },
  { id: 'freetime', label: 'Free Time', color: '#22c55e', linkedAreaId: null, locked: false },
];

const WEEKDAY_LABELS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/* ---------- Date utils ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function makeId() { return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }

/* ---------- Store ---------- */
function defaultData() {
  return {
    version: 1,
    settings: { dayStart: '05:00', dayEnd: '23:00', snapMinutes: 5 },
    categories: DEFAULT_CATEGORIES.map(c => ({ ...c })),
    blocks: [],
    completions: {},
  };
}

const Store = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(CALENDAR_STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultData();
      if (!this.data.settings) this.data.settings = defaultData().settings;
      if (!Array.isArray(this.data.categories) || !this.data.categories.length) this.data.categories = DEFAULT_CATEGORIES.map(c => ({ ...c }));
      if (!Array.isArray(this.data.blocks)) this.data.blocks = [];
      if (!this.data.completions) this.data.completions = {};
    } catch (e) {
      console.error('Failed to load calendar data, starting fresh.', e);
      this.data = defaultData();
    }
    return this.data;
  },
  save() {
    try {
      localStorage.setItem(CALENDAR_STORAGE_KEY, JSON.stringify(this.data));
    } catch (e) {
      console.error('Save failed.', e);
      showToast('Save failed — storage unavailable');
    }
  },
};

function categoryById(id) { return Store.data.categories.find(c => c.id === id); }

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1600);
}

/* ---------- Modal helpers ---------- */
function openModal(innerHtml, wide) {
  document.getElementById('modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop"><div class="modal-box${wide ? ' wide' : ''}">${innerHtml}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="close-modal"]')) { closeModal(); return; }
  const backdrop = e.target.closest('[data-action="backdrop"]');
  if (backdrop && e.target === backdrop) closeModal();
});

/* ---------- Tracker sync ---------- */
function readTrackerData() {
  try {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return (parsed && parsed.days) ? parsed : null;
  } catch (e) { return null; }
}

function emptyTrackerDayAreas() {
  return {
    sidehustle: { done: false, note: '' }, gym: { done: false },
    bjj: { done: false, note: '' }, coding: { done: false, note: '' },
    growth: { done: false, note: '' }, screentime: { done: false, note: '', value: null },
  };
}

function syncCompletionToTracker(ds, categoryId, done) {
  const category = categoryById(categoryId);
  if (!category || !category.linkedAreaId) return; // not a synced category — nothing to do
  const trackerData = readTrackerData();
  if (!trackerData) return; // Tracker not present in this origin's storage — silent no-op, surfaced via badge instead
  if (!trackerData.days[ds]) trackerData.days[ds] = { ...emptyTrackerDayAreas(), rating: null };
  if (!trackerData.days[ds][category.linkedAreaId]) trackerData.days[ds][category.linkedAreaId] = { done: false };
  trackerData.days[ds][category.linkedAreaId].done = done;
  try {
    localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(trackerData));
  } catch (e) {
    console.error('Tracker sync write failed.', e);
  }
}

function updateTrackerBadge() {
  const badge = document.getElementById('trackerBadge');
  const connected = !!readTrackerData();
  badge.textContent = connected ? '🔗 Tracker: Connected' : '🔗 Tracker: Not found';
  badge.className = 'tracker-badge ' + (connected ? 'connected' : 'disconnected');
}

function exportCompletionsForTracker() {
  const completions = {};
  Object.entries(Store.data.completions).forEach(([ds, byCat]) => {
    Object.entries(byCat).forEach(([categoryId, done]) => {
      if (!done) return;
      const cat = categoryById(categoryId);
      if (!cat || !cat.linkedAreaId) return;
      completions[ds] = completions[ds] || {};
      completions[ds][cat.linkedAreaId] = true;
    });
  });
  const payload = { kind: 'habit-tracker-completions-sync', version: 1, generatedAt: new Date().toISOString(), completions };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `calendar-completions-sync-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Completions file downloaded — import it from Tracker → Settings');
}

/* ---------- Completion toggling ---------- */
function toggleCompletion(ds, categoryId) {
  if (!Store.data.completions[ds]) Store.data.completions[ds] = {};
  const next = !Store.data.completions[ds][categoryId];
  Store.data.completions[ds][categoryId] = next;
  Store.save();
  syncCompletionToTracker(ds, categoryId, next);
  updateTrackerBadge();
  calendar.refetchEvents();
}

/* ---------- FullCalendar event feed ---------- */
function eventsFeed(fetchInfo, successCallback) {
  const events = [];
  Store.data.blocks.forEach(block => {
    const category = categoryById(block.categoryId) || { color: '#94a3b8', label: block.categoryId };
    const base = {
      id: block.id,
      title: block.label || category.label,
      backgroundColor: category.color,
      borderColor: category.color,
      extendedProps: { categoryId: block.categoryId, notes: block.notes || '' },
    };
    if (block.recurrence) {
      events.push({
        ...base,
        daysOfWeek: block.recurrence.daysOfWeek,
        startTime: block.start,
        endTime: block.end,
        startRecur: block.recurrence.startDate || undefined,
        endRecur: block.recurrence.endDate || undefined,
        startEditable: false,
        durationEditable: false,
      });
    } else if (block.date) {
      events.push({
        ...base,
        start: `${block.date}T${block.start}:00`,
        end: `${block.date}T${block.end}:00`,
        startEditable: true,
        durationEditable: true,
      });
    }
  });
  successCallback(events);
}

/* ---------- Block editor modal ---------- */
function renderCategorySwatches(selectedId) {
  return Store.data.categories.map(c => `
    <button type="button" class="swatch-btn ${c.id === selectedId ? 'active' : ''}" data-category="${c.id}">
      <span class="dot" style="background:${c.color};"></span>${escapeHtml(c.label)}
    </button>
  `).join('');
}

function renderWeekdayChips(selectedDays) {
  return WEEKDAY_LABELS.map((label, idx) => `
    <button type="button" class="weekday-chip ${selectedDays.includes(idx) ? 'active' : ''}" data-day="${idx}">${label}</button>
  `).join('');
}

function openBlockModal({ block, prefillDate, prefillStart, prefillEnd }) {
  const isEditing = !!block;
  const categoryId = block ? block.categoryId : (Store.data.categories[0] && Store.data.categories[0].id);
  const label = block ? block.label : '';
  const notes = block ? block.notes : '';
  const start = block ? block.start : prefillStart;
  const end = block ? block.end : prefillEnd;
  const date = block ? (block.date || block.recurrence?.startDate) : prefillDate;
  const recurDays = block && block.recurrence ? block.recurrence.daysOfWeek : [];
  const recurEnd = block && block.recurrence ? (block.recurrence.endDate || '') : '';

  openModal(`
    <div class="modal-title">${isEditing ? 'Edit block' : 'New block'}<button class="modal-close" data-action="close-modal">✕</button></div>

    <div class="field-group">
      <label class="field-label">Label</label>
      <input type="text" class="field-input" id="blockLabel" value="${escapeHtml(label)}" placeholder="e.g. Gym, Deep work, Coding practice..." />
    </div>

    <div class="field-group">
      <label class="field-label">Category</label>
      <div class="swatch-row" id="categorySwatches">${renderCategorySwatches(categoryId)}</div>
      <input type="hidden" id="blockCategoryId" value="${categoryId || ''}" />
    </div>

    <div class="form-row-2 field-group">
      <div>
        <label class="field-label">Start</label>
        <input type="time" class="field-input" id="blockStart" value="${start}" />
      </div>
      <div>
        <label class="field-label">End</label>
        <input type="time" class="field-input" id="blockEnd" value="${end}" />
      </div>
    </div>

    <div class="field-group" id="oneOffDateGroup" style="${recurDays.length ? 'display:none;' : ''}">
      <label class="field-label">Date</label>
      <input type="date" class="field-input" id="blockDate" value="${date}" />
    </div>

    <div class="field-group">
      <label class="field-label">Repeat on</label>
      <div class="weekday-row" id="weekdayChips">${renderWeekdayChips(recurDays)}</div>
      <div class="field-help">Select weekdays to make this a recurring block (e.g. Gym Tue/Thu). Editing or deleting affects the whole series — no single-day overrides yet.</div>
      <div class="field-group" id="recurEndGroup" style="${recurDays.length ? '' : 'display:none;'} margin-top:10px;">
        <label class="field-label">Ends (optional)</label>
        <input type="date" class="field-input" id="blockRecurEnd" value="${recurEnd}" />
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">Notes</label>
      <textarea class="field-textarea" id="blockNotes" placeholder="Optional notes...">${escapeHtml(notes)}</textarea>
    </div>

    <div class="modal-actions">
      ${isEditing ? `<button class="btn danger" id="deleteBlockBtn">Delete</button>` : ''}
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="saveBlockBtn">${isEditing ? 'Save changes' : 'Create block'}</button>
    </div>
  `);

  document.querySelectorAll('#categorySwatches .swatch-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.getElementById('blockCategoryId').value = btn.dataset.category;
      document.querySelectorAll('#categorySwatches .swatch-btn').forEach(b => b.classList.toggle('active', b === btn));
    });
  });

  let activeDays = new Set(recurDays);
  document.querySelectorAll('#weekdayChips .weekday-chip').forEach(chip => {
    chip.addEventListener('click', () => {
      const day = parseInt(chip.dataset.day, 10);
      if (activeDays.has(day)) activeDays.delete(day); else activeDays.add(day);
      chip.classList.toggle('active');
      const hasRecur = activeDays.size > 0;
      document.getElementById('oneOffDateGroup').style.display = hasRecur ? 'none' : '';
      document.getElementById('recurEndGroup').style.display = hasRecur ? '' : 'none';
    });
  });

  document.getElementById('blockLabel').focus();

  document.getElementById('saveBlockBtn').addEventListener('click', () => {
    const newLabel = document.getElementById('blockLabel').value.trim();
    const newCategoryId = document.getElementById('blockCategoryId').value;
    const newStart = document.getElementById('blockStart').value;
    const newEnd = document.getElementById('blockEnd').value;
    const newNotes = document.getElementById('blockNotes').value;

    if (!newStart || !newEnd) { showToast('Start and end time are required'); return; }
    if (newEnd <= newStart) { showToast('End time must be after start time'); return; }

    const isRecurring = activeDays.size > 0;
    let payload;
    if (isRecurring) {
      const startDate = (block && block.recurrence && block.recurrence.startDate) || prefillDate || todayStr();
      const recurEndVal = document.getElementById('blockRecurEnd').value || null;
      payload = {
        label: newLabel, categoryId: newCategoryId, notes: newNotes, start: newStart, end: newEnd,
        date: null, recurrence: { daysOfWeek: [...activeDays].sort(), startDate, endDate: recurEndVal },
      };
    } else {
      const newDate = document.getElementById('blockDate').value || prefillDate || todayStr();
      payload = { label: newLabel, categoryId: newCategoryId, notes: newNotes, start: newStart, end: newEnd, date: newDate, recurrence: null };
    }

    if (isEditing) {
      Object.assign(block, payload);
    } else {
      Store.data.blocks.push({ id: makeId(), ...payload });
    }
    Store.save();
    calendar.refetchEvents();
    closeModal();
  });

  if (isEditing) {
    document.getElementById('deleteBlockBtn').addEventListener('click', () => {
      const msg = block.recurrence ? 'Delete this entire recurring series?' : 'Delete this block?';
      if (confirm(msg)) {
        Store.data.blocks = Store.data.blocks.filter(b => b.id !== block.id);
        Store.save();
        calendar.refetchEvents();
        closeModal();
      }
    });
  }
}

/* ---------- Category management modal ---------- */
function openCategoriesModal() {
  const rows = Store.data.categories.map(c => `
    <div class="category-row" data-id="${c.id}">
      <input type="color" value="${c.color}" data-action="cat-color" />
      <input type="text" value="${escapeHtml(c.label)}" data-action="cat-label" />
      ${c.locked
        ? `<span class="lock-note">🔒 synced with Tracker</span>`
        : `<button type="button" class="btn small danger" data-action="cat-delete">Delete</button>`}
    </div>
  `).join('');

  openModal(`
    <div class="modal-title">Categories<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-help">The 6 marked 🔒 are shared with the Habit Tracker — their id and link can't change, but you can still recolor or relabel them. Add as many extra categories as you like; new ones aren't tracker-synced.</div>
    <div class="category-list" id="categoryList">${rows}</div>
    <div class="modal-actions" style="justify-content:flex-start;">
      <button class="btn" id="addCategoryBtn">+ Add category</button>
    </div>
  `, true);

  function wireRow(row) {
    const id = row.dataset.id;
    row.querySelector('[data-action="cat-color"]').addEventListener('input', (e) => {
      categoryById(id).color = e.target.value;
      Store.save();
      calendar.refetchEvents();
    });
    row.querySelector('[data-action="cat-label"]').addEventListener('change', (e) => {
      categoryById(id).label = e.target.value.trim() || categoryById(id).label;
      Store.save();
      calendar.refetchEvents();
    });
    const delBtn = row.querySelector('[data-action="cat-delete"]');
    if (delBtn) {
      delBtn.addEventListener('click', () => {
        const affected = Store.data.blocks.filter(b => b.categoryId === id).length;
        const msg = affected
          ? `Delete this category? ${affected} block(s) using it will be moved to "Free Time".`
          : 'Delete this category?';
        if (!confirm(msg)) return;
        Store.data.blocks.forEach(b => { if (b.categoryId === id) b.categoryId = 'freetime'; });
        Store.data.categories = Store.data.categories.filter(c => c.id !== id);
        Store.save();
        calendar.refetchEvents();
        openCategoriesModal();
      });
    }
  }
  document.querySelectorAll('#categoryList .category-row').forEach(wireRow);

  document.getElementById('addCategoryBtn').addEventListener('click', () => {
    const newCat = { id: makeId(), label: 'New category', color: '#94a3b8', linkedAreaId: null, locked: false };
    Store.data.categories.push(newCat);
    Store.save();
    openCategoriesModal();
  });
}

/* ---------- Settings modal ---------- */
function openSettingsModal() {
  const s = Store.data.settings;
  const connected = !!readTrackerData();
  openModal(`
    <div class="modal-title">Settings<button class="modal-close" data-action="close-modal">✕</button></div>

    <div class="form-row-2 field-group">
      <div>
        <label class="field-label">Day starts at</label>
        <input type="time" class="field-input" id="dayStartInput" value="${s.dayStart}" />
      </div>
      <div>
        <label class="field-label">Day ends at</label>
        <input type="time" class="field-input" id="dayEndInput" value="${s.dayEnd}" />
      </div>
    </div>

    <div class="field-group">
      <label class="field-label">Snap increment</label>
      <select class="field-select" id="snapInput">
        <option value="5" ${s.snapMinutes === 5 ? 'selected' : ''}>5 minutes</option>
        <option value="15" ${s.snapMinutes === 15 ? 'selected' : ''}>15 minutes</option>
        <option value="30" ${s.snapMinutes === 30 ? 'selected' : ''}>30 minutes</option>
      </select>
    </div>

    <hr class="divider" />

    <div class="field-group">
      <label class="field-label">Habit Tracker connection</label>
      <div class="field-help">
        Status: <b>${connected ? 'Connected' : 'Not found in this browser'}</b>. Marking a synced block (Side Hustle/Gym/BJJ/Coding/Growth/Screen Time) done writes directly into the Tracker automatically — but only when both apps are opened from the <b>same origin</b> (e.g. both served by one local static server). Opening them as separate double-clicked files won't share storage; that's a browser security boundary, not a bug.
      </div>
      <button class="btn" id="exportCompletionsBtn">⬇ Export completions for Tracker</button>
      <div class="field-help">If auto-sync isn't connected, use this to download a file, then import it from the Tracker's Settings → "Import Calendar completions".</div>
    </div>

    <hr class="divider" />

    <div class="field-group">
      <label class="field-label">Backup your data</label>
      <div class="field-help">All blocks, categories, and completions live only in this browser's local storage. Export a backup regularly.</div>
      <div class="modal-actions" style="justify-content:flex-start;">
        <button class="btn" id="exportAllBtn">⬇ Export JSON</button>
        <button class="btn" id="importAllBtn">⬆ Import JSON</button>
        <input type="file" id="importAllFile" accept="application/json" style="display:none;" />
      </div>
    </div>
  `);

  document.getElementById('dayStartInput').addEventListener('change', (e) => {
    Store.data.settings.dayStart = e.target.value;
    Store.save();
    applyCalendarSettings();
  });
  document.getElementById('dayEndInput').addEventListener('change', (e) => {
    Store.data.settings.dayEnd = e.target.value;
    Store.save();
    applyCalendarSettings();
  });
  document.getElementById('snapInput').addEventListener('change', (e) => {
    Store.data.settings.snapMinutes = parseInt(e.target.value, 10);
    Store.save();
    applyCalendarSettings();
  });
  document.getElementById('exportCompletionsBtn').addEventListener('click', exportCompletionsForTracker);
  document.getElementById('exportAllBtn').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `day-planner-backup-${todayStr()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Backup downloaded');
  });
  document.getElementById('importAllBtn').addEventListener('click', () => document.getElementById('importAllFile').click());
  document.getElementById('importAllFile').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result);
        if (!parsed || !Array.isArray(parsed.blocks) || !Array.isArray(parsed.categories)) throw new Error('Invalid file');
        Store.data = parsed;
        Store.save();
        showToast('Data imported');
        closeModal();
        applyCalendarSettings();
        calendar.refetchEvents();
      } catch (err) {
        showToast('Import failed — invalid file');
      }
    };
    reader.readAsText(file);
  });
}

/* ---------- Calendar init ---------- */
let calendar;

function applyCalendarSettings() {
  const s = Store.data.settings;
  calendar.setOption('slotMinTime', `${s.dayStart}:00`);
  calendar.setOption('slotMaxTime', `${s.dayEnd}:00`);
  calendar.setOption('snapDuration', `00:${pad2(s.snapMinutes)}:00`);
}

function updateHeaderState() {
  const view = calendar.view.type;
  document.getElementById('dayViewBtn').classList.toggle('active', view === 'timeGridDay');
  document.getElementById('weekViewBtn').classList.toggle('active', view === 'timeGridWeek');
  document.getElementById('rangeLabel').textContent = calendar.view.title;
}

function initCalendar() {
  const el = document.getElementById('calendar');
  const s = Store.data.settings;
  calendar = new FullCalendar.Calendar(el, {
    initialView: 'timeGridDay',
    headerToolbar: false,
    height: 'auto',
    nowIndicator: true,
    selectable: true,
    selectMirror: true,
    editable: true,
    eventResizableFromStart: true,
    slotMinTime: `${s.dayStart}:00`,
    slotMaxTime: `${s.dayEnd}:00`,
    snapDuration: `00:${pad2(s.snapMinutes)}:00`,
    slotDuration: '00:15:00',
    scrollTime: new Date().toTimeString().slice(0, 8),
    events: eventsFeed,

    select(info) {
      const date = fmtDate(info.start);
      const start = info.start.toTimeString().slice(0, 5);
      let end = info.end.toTimeString().slice(0, 5);
      if (end <= start) end = '23:59';
      openBlockModal({ block: null, prefillDate: date, prefillStart: start, prefillEnd: end });
      calendar.unselect();
    },

    eventContent(arg) {
      const categoryId = arg.event.extendedProps.categoryId;
      const ds = fmtDate(arg.event.start);
      const done = !!(Store.data.completions[ds] && Store.data.completions[ds][categoryId]);
      const wrapper = document.createElement('div');
      wrapper.className = 'block-content' + (done ? ' done' : '');
      wrapper.innerHTML = `
        <button type="button" class="block-check" data-date="${ds}" data-category="${categoryId}">${done ? '✓' : ''}</button>
        <span class="block-title">${escapeHtml(arg.event.title)}</span>
      `;
      return { domNodes: [wrapper] };
    },

    eventClick(info) {
      const checkBtn = info.jsEvent.target.closest('.block-check');
      if (checkBtn) {
        info.jsEvent.stopPropagation();
        toggleCompletion(checkBtn.dataset.date, checkBtn.dataset.category);
        return;
      }
      const block = Store.data.blocks.find(b => b.id === info.event.id);
      if (block) openBlockModal({ block });
    },

    eventDrop(info) {
      const block = Store.data.blocks.find(b => b.id === info.event.id);
      if (!block) return;
      block.date = fmtDate(info.event.start);
      block.start = info.event.start.toTimeString().slice(0, 5);
      block.end = info.event.end.toTimeString().slice(0, 5);
      Store.save();
    },

    eventResize(info) {
      const block = Store.data.blocks.find(b => b.id === info.event.id);
      if (!block) return;
      block.start = info.event.start.toTimeString().slice(0, 5);
      block.end = info.event.end.toTimeString().slice(0, 5);
      Store.save();
    },

    datesSet() { updateHeaderState(); },
  });
  calendar.render();
  updateHeaderState();
}

/* ---------- Header wiring ---------- */
function wireHeader() {
  document.getElementById('prevBtn').addEventListener('click', () => calendar.prev());
  document.getElementById('nextBtn').addEventListener('click', () => calendar.next());
  document.getElementById('todayBtn').addEventListener('click', () => calendar.today());
  document.getElementById('dayViewBtn').addEventListener('click', () => calendar.changeView('timeGridDay'));
  document.getElementById('weekViewBtn').addEventListener('click', () => calendar.changeView('timeGridWeek'));
  document.getElementById('categoriesBtn').addEventListener('click', openCategoriesModal);
  document.getElementById('settingsBtn').addEventListener('click', openSettingsModal);
  window.addEventListener('focus', updateTrackerBadge);
}

/* ---------- Init ---------- */
Store.load();
initCalendar();
wireHeader();
updateTrackerBadge();
