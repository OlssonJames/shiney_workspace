/* ============================================================
   Command palette — Ctrl+K (or Cmd+K) opens a fuzzy-filtered list
   of shell actions: open/close/minimize apps, snap the focused
   window, or quick-add a project idea by typing "idea: <title>".
   Alt+1..4 opens apps directly (dock order).
   ============================================================ */

const PALETTE_APPS = [
  { id: 'notes', label: 'Session Notes', icon: '📓' },
  { id: 'tracker', label: 'Habit Tracker', icon: '✅' },
  { id: 'calendar', label: 'Day Planner', icon: '🗓️' },
  { id: 'ideas', label: 'Project Ideas', icon: '💡' },
];

function paletteFocusedAppId() {
  let best = null, bestZ = -1;
  Object.entries(state.windows).forEach(([id, w]) => {
    if (!w.minimized && w.z > bestZ) { bestZ = w.z; best = id; }
  });
  return best;
}

function paletteEscape(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* Writes straight into Project Ideas' storage; its own `storage`
   listener refreshes an open window live. */
function paletteAddIdea(title) {
  const KEY = 'projectIdeasApp.v1';
  let data;
  try { data = JSON.parse(localStorage.getItem(KEY)); } catch (e) { data = null; }
  if (!data || !Array.isArray(data.ideas)) data = { version: 1, ideas: [] };
  const id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
  const now = new Date().toISOString();
  data.ideas.push({ id, title, notes: '', status: 'idea', createdAt: now, updatedAt: now });
  try { localStorage.setItem(KEY, JSON.stringify(data)); return true; } catch (e) { return false; }
}

function buildPaletteActions(query) {
  const q = query.trim().toLowerCase();

  // "idea: dark mode toggle" / "add idea dark mode toggle" → single quick-add action
  const ideaMatch = query.match(/^(?:add\s+)?idea[:\s]+(.+)$/i);
  if (ideaMatch && ideaMatch[1].trim()) {
    const title = ideaMatch[1].trim();
    return [{
      title: `💡 Add project idea: “${paletteEscape(title)}”`,
      hint: 'Enter',
      run: () => { paletteAddIdea(title); },
    }];
  }

  const actions = [];
  PALETTE_APPS.forEach((app, i) => {
    actions.push({
      title: `${app.icon} Open ${app.label}`,
      hint: `Alt+${i + 1}`,
      keywords: `open launch ${app.label}`,
      run: () => openApp(app.id),
    });
  });

  const focused = paletteFocusedAppId();
  if (focused) {
    const label = APP_BY_ID[focused] ? APP_BY_ID[focused].label : focused;
    actions.push(
      { title: `⬅ Snap ${label} left`, keywords: 'snap left half window', run: () => snapTo(focused, 'left') },
      { title: `➡ Snap ${label} right`, keywords: 'snap right half window', run: () => snapTo(focused, 'right') },
      { title: `⬆ Maximize ${label}`, keywords: 'snap maximize full window', run: () => snapTo(focused, 'full') },
      { title: `⬇ Minimize ${label}`, keywords: 'minimize hide window', run: () => minimizeWindow(focused) },
      { title: `✕ Close ${label}`, keywords: 'close quit window', run: () => closeWindow(focused) },
    );
  }

  actions.push({
    title: '💡 Add project idea…',
    hint: 'type “idea: <title>”',
    keywords: 'add idea project backlog new',
    run: () => { /* prompt-style: refill input as a template */ paletteSetQuery('idea: '); return 'keep-open'; },
  });

  if (!q) return actions;
  return actions.filter(a => (a.title + ' ' + (a.keywords || '')).toLowerCase().includes(q));
}

/* ---------- DOM ---------- */
let paletteOpen = false;
let paletteSelected = 0;

const paletteBackdrop = document.createElement('div');
paletteBackdrop.className = 'palette-backdrop';
paletteBackdrop.hidden = true;
paletteBackdrop.innerHTML = `
  <div class="palette">
    <input type="text" class="palette-input" id="paletteInput" placeholder="Type a command — open, snap, close, or “idea: …”" autocomplete="off" spellcheck="false" />
    <div class="palette-list" id="paletteList"></div>
  </div>
`;
document.body.appendChild(paletteBackdrop);
const paletteInput = document.getElementById('paletteInput');
const paletteList = document.getElementById('paletteList');

function paletteSetQuery(q) {
  paletteInput.value = q;
  paletteSelected = 0;
  renderPaletteList();
  paletteInput.focus();
  paletteInput.setSelectionRange(q.length, q.length);
}

function renderPaletteList() {
  const actions = buildPaletteActions(paletteInput.value);
  paletteSelected = Math.min(paletteSelected, Math.max(0, actions.length - 1));
  if (!actions.length) {
    paletteList.innerHTML = `<div class="palette-empty">No matching commands</div>`;
    return;
  }
  paletteList.innerHTML = actions.map((a, i) => `
    <div class="palette-item ${i === paletteSelected ? 'selected' : ''}" data-index="${i}">
      <span>${a.title}</span>
      ${a.hint ? `<span class="hint">${a.hint}</span>` : ''}
    </div>
  `).join('');
}

function runPaletteAction(index) {
  const actions = buildPaletteActions(paletteInput.value);
  const action = actions[index];
  if (!action) return;
  const result = action.run();
  if (result !== 'keep-open') closePalette();
}

function openPalette() {
  paletteOpen = true;
  paletteBackdrop.hidden = false;
  paletteInput.value = '';
  paletteSelected = 0;
  renderPaletteList();
  paletteInput.focus();
}
function closePalette() {
  paletteOpen = false;
  paletteBackdrop.hidden = true;
}

paletteInput.addEventListener('input', () => { paletteSelected = 0; renderPaletteList(); });
paletteInput.addEventListener('keydown', (e) => {
  const actions = buildPaletteActions(paletteInput.value);
  if (e.key === 'ArrowDown') { e.preventDefault(); paletteSelected = Math.min(paletteSelected + 1, actions.length - 1); renderPaletteList(); }
  else if (e.key === 'ArrowUp') { e.preventDefault(); paletteSelected = Math.max(paletteSelected - 1, 0); renderPaletteList(); }
  else if (e.key === 'Enter') { e.preventDefault(); runPaletteAction(paletteSelected); }
});
paletteList.addEventListener('click', (e) => {
  const item = e.target.closest('.palette-item');
  if (item) runPaletteAction(parseInt(item.dataset.index, 10));
});
paletteBackdrop.addEventListener('click', (e) => { if (e.target === paletteBackdrop) closePalette(); });

document.addEventListener('keydown', (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    if (paletteOpen) closePalette(); else openPalette();
    return;
  }
  if (paletteOpen && e.key === 'Escape') { closePalette(); return; }
  if (e.altKey && !e.ctrlKey && !e.metaKey) {
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= PALETTE_APPS.length) {
      e.preventDefault();
      openApp(PALETTE_APPS[n - 1].id);
    }
  }
});
