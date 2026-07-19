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

/* ---------- Window snapping ---------- */
const SNAP_MARGIN = 20;   // how close (px) the cursor must be to an edge/corner to trigger
const SNAP_GAP = 8;       // gap between side-by-side snapped windows
const UNSNAP_THRESHOLD = 6; // px of drag before a snapped window pops free

const state = {
  windows: {}, // appId -> { el, x, y, w, h, z, minimized, maximized, prevRect, snapped, restoreRect }
  zCounter: 10,
  cascadeCount: 0,
};

// The usable area for snapped windows — mirrors the insets toggleMaximize
// already uses (8px sides, ~90px reserved at the bottom for the dock).
function workArea() {
  const d = document.getElementById('desktop');
  return { x: 8, y: 8, w: d.clientWidth - 16, h: d.clientHeight - 98 };
}

function snapRect(zone) {
  const a = workArea();
  const halfW = (a.w - SNAP_GAP) / 2;
  const halfH = (a.h - SNAP_GAP) / 2;
  const rightX = a.x + halfW + SNAP_GAP;
  const bottomY = a.y + halfH + SNAP_GAP;
  switch (zone) {
    case 'full':         return { x: a.x, y: a.y, w: a.w, h: a.h };
    case 'left':         return { x: a.x, y: a.y, w: halfW, h: a.h };
    case 'right':        return { x: rightX, y: a.y, w: halfW, h: a.h };
    case 'top-left':     return { x: a.x, y: a.y, w: halfW, h: halfH };
    case 'top-right':    return { x: rightX, y: a.y, w: halfW, h: halfH };
    case 'bottom-left':  return { x: a.x, y: bottomY, w: halfW, h: halfH };
    case 'bottom-right': return { x: rightX, y: bottomY, w: halfW, h: halfH };
    default:             return null;
  }
}

// Corners win over edges; top edge alone maximizes; bottom edge alone is
// dead space (the dock lives there), only bottom corners snap.
function detectSnapZone(cx, cy) {
  const nearL = cx <= SNAP_MARGIN;
  const nearR = cx >= window.innerWidth - SNAP_MARGIN;
  const nearT = cy <= SNAP_MARGIN;
  const nearB = cy >= window.innerHeight - SNAP_MARGIN;
  if (nearT && nearL) return 'top-left';
  if (nearT && nearR) return 'top-right';
  if (nearB && nearL) return 'bottom-left';
  if (nearB && nearR) return 'bottom-right';
  if (nearT) return 'full';
  if (nearL) return 'left';
  if (nearR) return 'right';
  return null;
}

let snapPreviewEl = null;
function showSnapPreview(zone) {
  const r = snapRect(zone);
  snapPreviewEl.style.left = `${r.x}px`;
  snapPreviewEl.style.top = `${r.y}px`;
  snapPreviewEl.style.width = `${r.w}px`;
  snapPreviewEl.style.height = `${r.h}px`;
  snapPreviewEl.classList.add('visible');
}
function hideSnapPreview() {
  snapPreviewEl.classList.remove('visible');
}

function snapTo(appId, zone) {
  const w = state.windows[appId];
  if (!w) return;
  // The command palette can snap a button-maximized window; clear that
  // state so the two systems don't fight (drag stays blocked otherwise).
  if (w.maximized) { w.maximized = false; if (w.prevRect) Object.assign(w, w.prevRect); }
  if (w.minimized) restoreWindow(appId);
  // Remember the free-floating size once, so chained re-snaps
  // (left -> right -> quarter) still restore to the original size.
  if (!w.snapped) w.restoreRect = { w: w.w, h: w.h };
  w.snapped = zone;
  const r = snapRect(zone);
  Object.assign(w, { x: r.x, y: r.y, w: r.w, h: r.h });
  w.el.classList.add('snap-anim');
  applyRect(appId);
  setTimeout(() => w.el.classList.remove('snap-anim'), 240);
  focusWindow(appId);
  saveLayout();
}

/* ---------- Session restore ----------
   Persists which windows are open and their geometry/snap state, so
   reopening the shell brings the workspace back. (Requested earlier as
   "only if trivial" — it is now: the whole window state already lives
   in one serializable object per window.) */
const LAYOUT_KEY = 'desktopShellLayout.v1';
let layoutSaveTimer = null;

function saveLayout(immediate) {
  const doSave = () => {
    try {
      const wins = {};
      Object.entries(state.windows).forEach(([id, w]) => {
        wins[id] = {
          x: w.x, y: w.y, w: w.w, h: w.h, z: w.z,
          minimized: w.minimized, maximized: w.maximized, prevRect: w.prevRect,
          snapped: w.snapped, restoreRect: w.restoreRect,
        };
      });
      localStorage.setItem(LAYOUT_KEY, JSON.stringify(wins));
    } catch (e) { /* storage unavailable — layout just won't persist */ }
  };
  clearTimeout(layoutSaveTimer);
  if (immediate) doSave();
  else layoutSaveTimer = setTimeout(doSave, 300);
}

function restoreLayout() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(LAYOUT_KEY)); } catch (e) { /* corrupt — start fresh */ }
  if (!saved || typeof saved !== 'object') return;
  Object.entries(saved)
    .sort((a, b) => (a[1].z || 0) - (b[1].z || 0)) // recreate bottom-up so stacking order survives
    .forEach(([id, s]) => {
      if (!APP_BY_ID[id]) return;
      createWindow(id);
      const w = state.windows[id];
      // Clamp into the current viewport in case the screen size changed.
      w.x = Math.min(Math.max(-100, s.x), window.innerWidth - 120);
      w.y = Math.min(Math.max(0, s.y), window.innerHeight - 120);
      w.w = Math.max(MIN_W, s.w || w.w);
      w.h = Math.max(MIN_H, s.h || w.h);
      w.maximized = !!s.maximized;
      w.prevRect = s.prevRect || null;
      w.snapped = s.snapped || null;
      w.restoreRect = s.restoreRect || null;
      applyRect(id);
      if (s.minimized) minimizeWindow(id);
    });
}

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
    snapped: null, restoreRect: null,
  };

  wireWindow(appId);
  focusWindow(appId);
  updateDockIndicators();
  saveLayout();
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
  saveLayout();
}

function minimizeWindow(appId) {
  const w = state.windows[appId];
  if (!w) return;
  w.minimized = true;
  w.el.style.display = 'none';
  updateDockIndicators();
  saveLayout();
}

function restoreWindow(appId) {
  const w = state.windows[appId];
  if (!w) return;
  w.minimized = false;
  w.el.style.display = 'flex';
  updateDockIndicators();
  saveLayout();
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
  saveLayout();
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
  let startX = startEvent.clientX;
  let startY = startEvent.clientY;
  let orig = { x: w.x, y: w.y, w: w.w, h: w.h };
  let activeZone = null;
  document.body.classList.add('is-interacting');

  // If the user grabs the window again mid-snap-animation, kill the
  // geometry transition immediately so the drag tracks the pointer.
  w.el.classList.remove('snap-anim');

  // Resizing a snapped window turns it back into a normal floating
  // window at whatever size the resize produces.
  if (mode !== 'drag' && w.snapped) w.snapped = null;

  function onMove(e) {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;

    if (mode === 'drag') {
      // Dragging a snapped window away un-snaps it: restore the pre-snap
      // size and keep the grab point under the cursor (same proportional
      // position along the titlebar), like Windows/macOS.
      if (w.snapped) {
        if (Math.abs(dx) <= UNSNAP_THRESHOLD && Math.abs(dy) <= UNSNAP_THRESHOLD) return;
        const restored = w.restoreRect || { w: Math.min(920, window.innerWidth - 80), h: Math.min(640, window.innerHeight - 140) };
        const relX = (startX - w.x) / w.w;
        w.w = restored.w;
        w.h = restored.h;
        w.x = e.clientX - relX * restored.w;
        w.y = Math.max(0, e.clientY - 14);
        w.snapped = null;
        startX = e.clientX;
        startY = e.clientY;
        orig = { x: w.x, y: w.y, w: w.w, h: w.h };
        applyRect(appId);
        return;
      }

      w.x = orig.x + dx;
      w.y = Math.max(0, orig.y + dy);
      applyRect(appId);

      const zone = detectSnapZone(e.clientX, e.clientY);
      if (zone !== activeZone) {
        activeZone = zone;
        if (zone) showSnapPreview(zone);
        else hideSnapPreview();
      }
      return;
    }

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
    applyRect(appId);
  }

  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
    document.body.classList.remove('is-interacting');
    hideSnapPreview();
    if (mode === 'drag' && activeZone) snapTo(appId, activeZone);
    else saveLayout();
  }

  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

/* ---------- Init ---------- */
renderDock();
snapPreviewEl = document.createElement('div');
snapPreviewEl.className = 'snap-preview';
document.getElementById('desktop').appendChild(snapPreviewEl);
restoreLayout();
window.addEventListener('beforeunload', () => saveLayout(true));
