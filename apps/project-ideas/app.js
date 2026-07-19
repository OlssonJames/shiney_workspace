/* ============================================================
   Project Ideas — lightweight backlog for someday/maybe project ideas
   Dependency-free, localStorage-backed, no build step.
   ============================================================ */

const STORAGE_KEY = 'projectIdeasApp.v1';

const STATUSES = [
  { id: 'idea', label: 'Idea', color: '#94a3b8' },
  { id: 'in-progress', label: 'In Progress', color: '#f59e0b' },
  { id: 'done', label: 'Done', color: '#22c55e' },
];
const STATUS_BY_ID = Object.fromEntries(STATUSES.map(s => [s.id, s]));

function makeId() { return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }

/* ---------- Store ---------- */
function defaultData() { return { version: 1, ideas: [] }; }

const Store = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultData();
      if (!Array.isArray(this.data.ideas)) this.data.ideas = [];
    } catch (e) {
      console.error('Failed to load project ideas, starting fresh.', e);
      this.data = defaultData();
    }
    return this.data;
  },
  save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      showToast('Saved');
    } catch (e) {
      console.error('Save failed.', e);
      showToast('Save failed — storage unavailable');
    }
  },
  add(idea) {
    const full = { id: makeId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), ...idea };
    this.data.ideas.push(full);
    this.save();
  },
  update(id, patch) {
    const idea = this.data.ideas.find(i => i.id === id);
    if (!idea) return;
    Object.assign(idea, patch, { updatedAt: new Date().toISOString() });
    this.save();
  },
  remove(id) {
    this.data.ideas = this.data.ideas.filter(i => i.id !== id);
    this.save();
  },
};

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

/* ---------- Modal ---------- */
function openModal(innerHtml) {
  document.getElementById('modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop"><div class="modal-box">${innerHtml}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="close-modal"]')) { closeModal(); return; }
  const backdrop = e.target.closest('[data-action="backdrop"]');
  if (backdrop && e.target === backdrop) closeModal();
});

/* ---------- Render ---------- */
function statusOptions(selected) {
  return STATUSES.map(s => `<option value="${s.id}" ${s.id === selected ? 'selected' : ''}>${s.label}</option>`).join('');
}

function renderIdeaCard(idea) {
  return `
    <div class="idea-card" data-id="${idea.id}">
      <div class="idea-title">${escapeHtml(idea.title)}</div>
      ${idea.notes ? `<div class="idea-notes">${escapeHtml(idea.notes)}</div>` : ''}
      <div class="idea-actions">
        <select class="status-select" data-action="change-status" data-id="${idea.id}">${statusOptions(idea.status)}</select>
        <div class="idea-buttons">
          <button data-action="edit-idea" data-id="${idea.id}" title="Edit">✎</button>
          <button data-action="delete-idea" data-id="${idea.id}" title="Delete">🗑</button>
        </div>
      </div>
    </div>
  `;
}

function renderBoard() {
  const columns = STATUSES.map(status => {
    const ideas = Store.data.ideas
      .filter(i => i.status === status.id)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    const cards = ideas.length
      ? ideas.map(renderIdeaCard).join('')
      : `<div class="column-empty">Nothing here yet</div>`;
    return `
      <div class="column">
        <div class="column-header">
          <span class="column-title"><span class="status-dot" style="background:${status.color};"></span>${status.label}</span>
          <span class="column-count">${ideas.length}</span>
        </div>
        ${cards}
      </div>
    `;
  }).join('');

  return `<div class="board">${columns}</div>`;
}

function render() {
  const app = document.getElementById('app');
  app.innerHTML = `
    <div class="view-header">
      <h2 class="view-title">💡 Project Ideas</h2>
      <div class="view-sub">${Store.data.ideas.length} idea${Store.data.ideas.length === 1 ? '' : 's'} in the backlog</div>
    </div>

    <div class="add-form">
      <div class="add-row">
        <input type="text" class="field-input" id="newTitle" placeholder="Idea title..." />
        <input type="text" class="field-input" id="newNotes" placeholder="Short description / notes (optional)..." />
        <select class="field-select" id="newStatus">${statusOptions('idea')}</select>
        <button class="btn primary" id="addIdeaBtn">+ Add</button>
      </div>
    </div>

    ${renderBoard()}
  `;
  attachHandlers();
}

function attachHandlers() {
  document.getElementById('addIdeaBtn').addEventListener('click', addIdeaFromForm);
  document.getElementById('newTitle').addEventListener('keydown', (e) => { if (e.key === 'Enter') addIdeaFromForm(); });

  document.querySelectorAll('[data-action="change-status"]').forEach(sel => {
    sel.addEventListener('change', () => {
      Store.update(sel.dataset.id, { status: sel.value });
      render();
    });
  });
  document.querySelectorAll('[data-action="edit-idea"]').forEach(btn => {
    btn.addEventListener('click', () => openEditModal(btn.dataset.id));
  });
  document.querySelectorAll('[data-action="delete-idea"]').forEach(btn => {
    btn.addEventListener('click', () => {
      if (confirm('Delete this idea?')) { Store.remove(btn.dataset.id); render(); }
    });
  });
}

function addIdeaFromForm() {
  const title = document.getElementById('newTitle').value.trim();
  if (!title) { showToast('Title is required'); return; }
  const notes = document.getElementById('newNotes').value.trim();
  const status = document.getElementById('newStatus').value;
  Store.add({ title, notes, status });
  render();
}

function openEditModal(id) {
  const idea = Store.data.ideas.find(i => i.id === id);
  if (!idea) return;
  openModal(`
    <div class="modal-title">Edit idea<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group">
      <label class="field-label">Title</label>
      <input type="text" class="field-input" id="editTitle" value="${escapeHtml(idea.title)}" />
    </div>
    <div class="field-group">
      <label class="field-label">Notes</label>
      <textarea class="field-textarea" id="editNotes">${escapeHtml(idea.notes || '')}</textarea>
    </div>
    <div class="field-group">
      <label class="field-label">Status</label>
      <select class="field-select" id="editStatus">${statusOptions(idea.status)}</select>
    </div>
    <div class="modal-actions">
      <button class="btn danger" id="deleteIdeaBtn">Delete</button>
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="saveIdeaBtn">Save changes</button>
    </div>
  `);
  document.getElementById('saveIdeaBtn').addEventListener('click', () => {
    const title = document.getElementById('editTitle').value.trim();
    if (!title) { showToast('Title is required'); return; }
    Store.update(id, {
      title,
      notes: document.getElementById('editNotes').value.trim(),
      status: document.getElementById('editStatus').value,
    });
    closeModal();
    render();
  });
  document.getElementById('deleteIdeaBtn').addEventListener('click', () => {
    if (confirm('Delete this idea?')) { Store.remove(id); closeModal(); render(); }
  });
}

/* ---------- Export / Import ---------- */
function exportData() {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `project-ideas-backup-${new Date().toISOString().slice(0, 10)}.json`;
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
      if (!parsed || !Array.isArray(parsed.ideas)) throw new Error('Invalid file');
      Store.data = parsed;
      Store.save();
      showToast('Data imported');
      render();
    } catch (err) {
      showToast('Import failed — invalid file');
    }
  };
  reader.readAsText(file);
}

document.getElementById('exportBtn').addEventListener('click', exportData);
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', importData);

/* ---------- Init ---------- */
Store.load();
render();

// Reflect changes made from outside this document (e.g. the desktop
// shell's voice assistant adding an idea directly into storage) without
// needing a manual reload — fires in this window when another same-origin
// window/iframe writes to the same localStorage key.
window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { Store.load(); render(); }
});
