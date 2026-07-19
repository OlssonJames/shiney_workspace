/* ============================================================
   Desktop Shell — floating-window launcher for the personal app suite.
   Embeds each app via <iframe> — they're independent static sites
   (no shared build/component tree), so iframes are the only clean
   way to embed them fully-interactive without rewriting them.
   ============================================================ */

const APPS = [
  { id: 'notes', label: 'Notes', icon: '📓', src: '../notes/index.html' },
  { id: 'tracker', label: 'Habit Tracker', icon: '✅', src: '../habit-tracker/index.html' },
  { id: 'calendar', label: 'Day Planner', icon: '🗓️', src: '../calendar/index.html' },
  { id: 'ideas', label: 'Project Ideas', icon: '💡', src: '../project-ideas/index.html' },
];
const APP_BY_ID = Object.fromEntries(APPS.map(a => [a.id, a]));

const MIN_W = 360;
const MIN_H = 260;

const state = {
  windows: {}, // appId -> { el, x, y, w, h, z, minimized, maximized, prevRect }
  zCounter: 10,
  cascadeCount: 0,
};

function nextZ() { return ++state.zCounter; }

/* ---------- Dock ---------- */
function renderDock() {
  const dock = document.getElementById('dock');
  dock.innerHTML = APPS.map(app => `
    <button class="dock-icon" data-app="${app.id}" title="${app.label}">
      <span class="dock-emoji">${app.icon}</span>
      <span class="dock-label">${app.label}</span>
      <span class="dock-dot"></span>
    </button>
  `).join('');
  dock.querySelectorAll('.dock-icon').forEach(btn => {
    btn.addEventListener('click', () => openApp(btn.dataset.app));
  });
}

function updateDockIndicators() {
  document.querySelectorAll('.dock-icon').forEach(btn => {
    btn.classList.toggle('open', !!state.windows[btn.dataset.app]);
  });
}

/* ---------- Open / focus / close / minimize / maximize ---------- */
function openApp(appId) {
  const existing = state.windows[appId];
  if (existing) {
    if (existing.minimized) restoreWindow(appId);
    focusWindow(appId);
    return;
  }
  createWindow(appId);
}

function createWindow(appId) {
  const app = APP_BY_ID[appId];
  const desktop = document.getElementById('desktop');

  const cascade = (state.cascadeCount++ % 6) * 28;
  const defaultW = Math.min(920, window.innerWidth - 80);
  const defaultH = Math.min(640, window.innerHeight - 140);
  const x = 50 + cascade;
  const y = 40 + cascade;

  const win = document.createElement('div');
  win.className = 'window opening';
  win.id = `win-${appId}`;
  win.style.left = `${x}px`;
  win.style.top = `${y}px`;
  win.style.width = `${defaultW}px`;
  win.style.height = `${defaultH}px`;
  win.style.zIndex = nextZ();

  win.innerHTML = `
    <div class="window-titlebar" data-drag-handle>
      <span class="window-icon">${app.icon}</span>
      <span class="window-title">${app.label}</span>
      <div class="window-controls">
        <button data-action="minimize" title="Minimize" aria-label="Minimize">&#8722;</button>
        <button data-action="maximize" title="Maximize" aria-label="Maximize">&#9723;</button>
        <button data-action="close" title="Close" aria-label="Close">&#10005;</button>
      </div>
    </div>
    <div class="window-body">
      <iframe src="${app.src}" title="${app.label}"></iframe>
    </div>
    ${['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'].map(dir => `<div class="resize-handle ${dir}" data-resize="${dir}"></div>`).join('')}
  `;

  desktop.appendChild(win);

  // Force a layout flush so the "opening" starting state actually
  // paints before we remove it — otherwise the browser may coalesce
  // both class changes into one frame and skip the transition.
  void win.offsetWidth;
  requestAnimationFrame(() => win.classList.remove('opening'));

  state.windows[appId] = {
    el: win, x, y, w: defaultW, h: defaultH, z: state.zCounter,
    minimized: false, maximized: false, prevRect: null,
  };

  wireWindow(appId);
  focusWindow(appId);
  updateDockIndicators();
}

function focusWindow(appId) {
  const w = state.windows[appId];
  if (!w) return;
  w.z = nextZ();
  w.el.style.zIndex = w.z;
  document.querySelectorAll('.window').forEach(el => el.classList.remove('focused'));
  w.el.classList.add('focused');
}

function closeWindow(appId) {
  const w = state.windows[appId];
  if (!w) return;
  w.el.classList.add('closing');
  delete state.windows[appId]; // frees the dock/focus slot immediately
  updateDockIndicators();
  setTimeout(() => w.el.remove(), 180);
}

function minimizeWindow(appId) {
  const w = state.windows[appId];
  if (!w) return;
  w.minimized = true;
  w.el.style.display = 'none';
  updateDockIndicators();
}

function restoreWindow(appId) {
  const w = state.windows[appId];
  if (!w) return;
  w.minimized = false;
  w.el.style.display = 'flex';
  updateDockIndicators();
}

function toggleMaximize(appId) {
  const w = state.windows[appId];
  if (!w) return;
  const desktop = document.getElementById('desktop');
  if (!w.maximized) {
    w.prevRect = { x: w.x, y: w.y, w: w.w, h: w.h };
    w.maximized = true;
    w.x = 8;
    w.y = 8;
    w.w = desktop.clientWidth - 16;
    w.h = desktop.clientHeight - 100;
  } else {
    w.maximized = false;
    Object.assign(w, w.prevRect);
  }
  applyRect(appId);
}

function applyRect(appId) {
  const w = state.windows[appId];
  w.el.style.left = `${w.x}px`;
  w.el.style.top = `${w.y}px`;
  w.el.style.width = `${w.w}px`;
  w.el.style.height = `${w.h}px`;
}

/* ---------- Wiring: focus, controls, drag, resize ---------- */
function wireWindow(appId) {
  const w = state.windows[appId];
  const el = w.el;

  el.addEventListener('pointerdown', () => focusWindow(appId));

  el.querySelector('[data-action="minimize"]').addEventListener('click', (e) => { e.stopPropagation(); minimizeWindow(appId); });
  el.querySelector('[data-action="maximize"]').addEventListener('click', (e) => { e.stopPropagation(); toggleMaximize(appId); });
  el.querySelector('[data-action="close"]').addEventListener('click', (e) => { e.stopPropagation(); closeWindow(appId); });

  const titlebar = el.querySelector('[data-drag-handle]');
  titlebar.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.window-controls')) return;
    if (w.maximized) return;
    e.preventDefault();
    focusWindow(appId);
    startDragOrResize(appId, 'drag', e);
  });
  titlebar.addEventListener('dblclick', (e) => {
    if (e.target.closest('.window-controls')) return;
    toggleMaximize(appId);
  });

  el.querySelectorAll('.resize-handle').forEach(handle => {
    handle.addEventListener('pointerdown', (e) => {
      if (w.maximized) return;
      e.preventDefault();
      e.stopPropagation();
      focusWindow(appId);
      startDragOrResize(appId, handle.dataset.resize, e);
    });
  });
}

function startDragOrResize(appId, mode, startEvent) {
  const w = state.windows[appId];
  const startX = startEvent.clientX;
  const startY = startEvent.clientY;
  const orig = { x: w.x, y: w.y, w: w.w, h: w.h };
  document.body.classList.add('is-interacting');

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (mode === 'drag') {
      w.x = orig.x + dx;
      w.y = Math.max(0, orig.y + dy);
    } else {
      if (mode.includes('e')) w.w = Math.max(MIN_W, orig.w + dx);
      if (mode.includes('s')) w.h = Math.max(MIN_H, orig.h + dy);
      if (mode.includes('w')) {
        const newW = Math.max(MIN_W, orig.w - dx);
        w.x = orig.x + (orig.w - newW);
        w.w = newW;
      }
      if (mode.includes('n')) {
        const newH = Math.max(MIN_H, orig.h - dy);
        w.y = orig.y + (orig.h - newH);
        w.h = newH;
      }
    }
    applyRect(appId);
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.body.classList.remove('is-interacting');
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

/* ---------- Init ---------- */
renderDock();
