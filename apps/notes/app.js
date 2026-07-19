/* ============================================================
   Session Notes — dedicated progression log for BJJ / Coding / Side Hustle
   Dependency-free, localStorage-backed, no build step.
   ============================================================ */

const SECTIONS = [
  {
    id: 'bjj', label: 'BJJ', icon: '🥋', color: '#14b8a6',
    fields: [
      { key: 'sessionType', label: 'Session type', type: 'select', options: ['', 'Gi', 'No-Gi', 'Open mat', 'Competition', 'Other'] },
      { key: 'techniques', label: 'Techniques', type: 'tags', placeholder: 'Type a technique, press Enter' },
      { key: 'position', label: 'Position focus', type: 'datalist', options: ['Guard', 'Mount', 'Side Control', 'Back Control', 'Half Guard', 'Turtle', 'Standing / Takedowns', 'Submission defense'] },
    ],
    noteLabel: 'Notes',
    notePlaceholder: 'What did you work on? Rolls, technique, reflections...',
  },
  {
    id: 'coding', label: 'Coding', icon: '💻', color: '#8b5cf6',
    fields: [
      { key: 'tags', label: 'Project / stack', type: 'tags', placeholder: 'e.g. Habit Tracker, JavaScript — press Enter' },
      { key: 'link', label: 'Reference link', type: 'url', placeholder: 'https://...' },
    ],
    noteLabel: 'What I learned / built',
    notePlaceholder: 'What did you learn or build today?',
  },
  {
    id: 'sidehustle', label: 'Side Hustle', icon: '💼', color: '#6366f1',
    fields: [
      { key: 'taskType', label: 'Task type', type: 'select', options: ['', 'Marketing', 'Sales', 'Product', 'Admin', 'Content', 'Networking', 'Research', 'Other'] },
      { key: 'timeSpent', label: 'Time spent (hrs)', type: 'number', step: '0.25' },
      { key: 'revenue', label: 'Revenue / milestone ($)', type: 'number', step: '0.01' },
    ],
    noteLabel: 'Notes',
    notePlaceholder: 'What did you do? Progress, blockers, next steps...',
  },
];
const SECTION_BY_ID = Object.fromEntries(SECTIONS.map(s => [s.id, s]));
const STORAGE_KEY = 'notesApp.v1';

/* ---------- Date utils ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function fmtDate(d) { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function todayStr() { return fmtDate(new Date()); }
function normalizeDate(raw) {
  if (!raw) return null;
  const s = String(raw).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return fmtDate(d);
}
function formatDisplayDate(ds) {
  const [y, m, d] = ds.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' });
}
function makeId() {
  return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);
}

/* ---------- Store ---------- */
function defaultData() {
  return { version: 1, entries: { bjj: [], coding: [], sidehustle: [] } };
}
const Store = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultData();
      SECTIONS.forEach(s => { if (!Array.isArray(this.data.entries[s.id])) this.data.entries[s.id] = []; });
    } catch (e) {
      console.error('Failed to load notes data, starting fresh.', e);
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
  list(sectionId) {
    return [...this.data.entries[sectionId]].sort((a, b) => (b.date + b.createdAt).localeCompare(a.date + a.createdAt));
  },
  addEntry(sectionId, entry) {
    const full = { id: makeId(), createdAt: new Date().toISOString(), ...entry };
    this.data.entries[sectionId].push(full);
    this.save();
    return full.id;
  },
  updateEntry(sectionId, id, patch) {
    const list = this.data.entries[sectionId];
    const idx = list.findIndex(e => e.id === id);
    if (idx === -1) return;
    list[idx] = { ...list[idx], ...patch };
    this.save();
  },
  deleteEntry(sectionId, id) {
    this.data.entries[sectionId] = this.data.entries[sectionId].filter(e => e.id !== id);
    this.save();
  },
  getEntry(sectionId, id) {
    return this.data.entries[sectionId].find(e => e.id === id) || null;
  },
};

/* ---------- App state ---------- */
const state = { section: 'bjj', editingId: null, search: '', draftTags: [] };

function parseHash() {
  const hash = location.hash.replace(/^#\/?/, '');
  return SECTION_BY_ID[hash] ? hash : 'bjj';
}
window.addEventListener('hashchange', () => {
  state.section = parseHash();
  state.editingId = null;
  state.search = '';
  render();
});

/* ---------- Toast ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}

/* ---------- Tabs ---------- */
function renderTabs() {
  const tabs = document.getElementById('tabs');
  tabs.innerHTML = SECTIONS.map(s => `
    <a href="#${s.id}" class="tab ${s.id === state.section ? 'active' : ''}" style="${s.id === state.section ? `background:${s.color};` : ''}">${s.icon} ${s.label}</a>
  `).join('');
}

/* ---------- Escape helper ---------- */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str == null ? '' : String(str);
  return div.innerHTML;
}

/* ---------- Field rendering (form) ---------- */
function renderFieldInput(section, field, value) {
  if (field.type === 'select') {
    const isCustom = value && !field.options.includes(value) && value !== '';
    const selected = isCustom ? 'Other' : (value || '');
    const opts = field.options.map(o => `<option value="${o}" ${o === selected ? 'selected' : ''}>${o || '—'}</option>`).join('');
    return `
      <select class="field-select" data-field="${field.key}" data-type="select">${opts}</select>
      <input type="text" class="field-input custom-field-input" data-custom-for="${field.key}"
        placeholder="Type custom ${field.label.toLowerCase()}..."
        style="display:${selected === 'Other' ? 'block' : 'none'};"
        value="${isCustom ? escapeHtml(value) : ''}" />
    `;
  }
  if (field.type === 'datalist') {
    const listId = `dl-${field.key}`;
    const opts = field.options.map(o => `<option value="${o}"></option>`).join('');
    return `
      <input type="text" class="field-input" list="${listId}" data-field="${field.key}" data-type="text" value="${escapeHtml(value || '')}" />
      <datalist id="${listId}">${opts}</datalist>
    `;
  }
  if (field.type === 'tags') {
    const tags = Array.isArray(value) ? value : [];
    const chips = tags.map((t, i) => `<span class="tag-chip">${escapeHtml(t)}<button type="button" data-remove-tag="${i}" data-field="${field.key}">✕</button></span>`).join('');
    return `
      <div class="tag-input-wrap" data-tag-wrap="${field.key}">
        ${chips}
        <input type="text" class="tag-input-field" data-tag-input="${field.key}" placeholder="${field.placeholder || 'Add tag, press Enter'}" />
      </div>
    `;
  }
  if (field.type === 'number') {
    return `<input type="number" class="field-input" step="${field.step || 'any'}" data-field="${field.key}" data-type="number" value="${value ?? ''}" />`;
  }
  if (field.type === 'url') {
    return `<input type="url" class="field-input" data-field="${field.key}" data-type="text" value="${escapeHtml(value || '')}" placeholder="${field.placeholder || ''}" />`;
  }
  return `<input type="text" class="field-input" data-field="${field.key}" data-type="text" value="${escapeHtml(value || '')}" />`;
}

function renderForm(section) {
  const editing = state.editingId ? Store.getEntry(section.id, state.editingId) : null;
  const date = editing ? editing.date : todayStr();
  state.draftTags = {};
  section.fields.filter(f => f.type === 'tags').forEach(f => {
    state.draftTags[f.key] = editing && Array.isArray(editing[f.key]) ? [...editing[f.key]] : [];
  });

  const fieldsHtml = section.fields.map(f => `
    <div>
      <label class="field-label">${f.label}</label>
      ${renderFieldInput(section, f, editing ? editing[f.key] : (f.type === 'tags' ? state.draftTags[f.key] : ''))}
    </div>
  `).join('');

  return `
    <div class="entry-form" id="entryForm">
      <div class="form-row">
        <div>
          <label class="field-label">Date</label>
          <input type="date" class="field-input" id="entryDate" value="${date}" />
        </div>
        ${fieldsHtml}
      </div>
      <label class="field-label">${section.noteLabel}</label>
      <textarea class="field-textarea" id="entryNote" placeholder="${section.notePlaceholder}">${escapeHtml(editing ? editing.note : '')}</textarea>
      <div class="form-actions">
        ${editing ? `<button class="btn danger small" id="deleteEntryBtn">Delete</button><button class="btn small" id="cancelEditBtn">Cancel</button>` : ''}
        <button class="btn primary" id="saveEntryBtn" style="background:${section.color};border-color:${section.color};">${editing ? 'Save changes' : 'Add entry'}</button>
      </div>
    </div>
  `;
}

/* ---------- Entry list rendering ---------- */
function matchesSearch(entry, section, q) {
  if (!q) return true;
  const hay = [entry.note, ...(section.fields.map(f => entry[f.key])).flat()].filter(Boolean).join(' ').toLowerCase();
  return hay.includes(q.toLowerCase());
}

function renderEntryCard(section, entry) {
  const metaChips = section.fields.filter(f => f.type !== 'tags' && entry[f.key]).map(f => {
    if (f.key === 'timeSpent') return `<span class="meta-chip">${entry[f.key]} hrs</span>`;
    if (f.key === 'revenue') return `<span class="meta-chip">$${entry[f.key]}</span>`;
    if (f.key === 'link') return '';
    return `<span class="meta-chip">${escapeHtml(entry[f.key])}</span>`;
  }).join('');
  const tagChips = section.fields.filter(f => f.type === 'tags' && Array.isArray(entry[f.key]))
    .flatMap(f => entry[f.key]).map(t => `<span class="meta-chip">${escapeHtml(t)}</span>`).join('');
  const linkField = section.fields.find(f => f.key === 'link');
  const linkHtml = linkField && entry.link ? `<a class="entry-link" href="${escapeHtml(entry.link)}" target="_blank" rel="noopener">${escapeHtml(entry.link)}</a>` : '';

  return `
    <div class="entry-card">
      <div class="entry-top">
        <div>
          <div class="entry-date">${formatDisplayDate(entry.date)}</div>
          <div class="entry-meta">${metaChips}${tagChips}</div>
        </div>
        <div class="entry-actions">
          <button class="btn small" data-action="edit-entry" data-id="${entry.id}">Edit</button>
        </div>
      </div>
      ${entry.note ? `<div class="entry-note">${escapeHtml(entry.note)}</div>` : ''}
      ${linkHtml}
    </div>
  `;
}

/* ---------- Section view ---------- */
function renderSection(sectionId) {
  const section = SECTION_BY_ID[sectionId];
  const entries = Store.list(sectionId).filter(e => matchesSearch(e, section, state.search));

  const list = entries.length
    ? entries.map(e => renderEntryCard(section, e)).join('')
    : `<div class="entry-empty">No entries yet. Log your first ${section.label} session above.</div>`;

  return `
    <div class="view-header">
      <div>
        <h2 class="view-title">${section.icon} ${section.label}</h2>
        <div class="view-sub">${Store.data.entries[sectionId].length} total entries logged</div>
      </div>
    </div>
    ${renderForm(section)}
    <div class="search-row">
      <input type="text" class="search-input" id="searchInput" placeholder="Search ${section.label} notes and tags..." value="${escapeHtml(state.search)}" />
    </div>
    <div class="entry-list">${list}</div>
  `;
}

/* ---------- Render dispatch ---------- */
function render() {
  renderTabs();
  document.getElementById('app').innerHTML = renderSection(state.section);
  attachHandlers();
}

/* ---------- Event handlers ---------- */
function attachHandlers() {
  const app = document.getElementById('app');
  const section = SECTION_BY_ID[state.section];

  // select -> reveal/hide custom text field
  app.querySelectorAll('select[data-type="select"]').forEach(sel => {
    sel.addEventListener('change', () => {
      const custom = app.querySelector(`[data-custom-for="${sel.dataset.field}"]`);
      if (custom) custom.style.display = sel.value === 'Other' ? 'block' : 'none';
    });
  });

  // tag inputs
  app.querySelectorAll('[data-tag-input]').forEach(input => {
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = input.value.trim().replace(/,$/, '');
        if (val) {
          const key = input.dataset.tagInput;
          state.draftTags[key] = state.draftTags[key] || [];
          state.draftTags[key].push(val);
          input.value = '';
          refreshTagWrap(key);
        }
      }
    });
  });
  app.querySelectorAll('[data-remove-tag]').forEach(btn => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.field;
      const idx = parseInt(btn.dataset.removeTag, 10);
      state.draftTags[key].splice(idx, 1);
      refreshTagWrap(key);
    });
  });

  function refreshTagWrap(key) {
    const wrap = app.querySelector(`[data-tag-wrap="${key}"]`);
    const input = wrap.querySelector('[data-tag-input]');
    const chips = (state.draftTags[key] || []).map((t, i) => `<span class="tag-chip">${escapeHtml(t)}<button type="button" data-remove-tag="${i}" data-field="${key}">✕</button></span>`).join('');
    wrap.innerHTML = chips + `<input type="text" class="tag-input-field" data-tag-input="${key}" placeholder="Add tag, press Enter" />`;
    wrap.querySelector('[data-tag-input]').addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ',') {
        e.preventDefault();
        const val = e.target.value.trim().replace(/,$/, '');
        if (val) { state.draftTags[key].push(val); e.target.value = ''; refreshTagWrap(key); }
      }
    });
    wrap.querySelectorAll('[data-remove-tag]').forEach(b => {
      b.addEventListener('click', () => {
        state.draftTags[key].splice(parseInt(b.dataset.removeTag, 10), 1);
        refreshTagWrap(key);
      });
    });
  }

  // save / cancel / delete
  const saveBtn = document.getElementById('saveEntryBtn');
  if (saveBtn) saveBtn.addEventListener('click', () => saveEntryFromForm(section));
  const cancelBtn = document.getElementById('cancelEditBtn');
  if (cancelBtn) cancelBtn.addEventListener('click', () => { state.editingId = null; render(); });
  const deleteBtn = document.getElementById('deleteEntryBtn');
  if (deleteBtn) deleteBtn.addEventListener('click', () => {
    if (confirm('Delete this entry? This cannot be undone.')) {
      Store.deleteEntry(section.id, state.editingId);
      state.editingId = null;
      render();
    }
  });

  // edit entry
  app.querySelectorAll('[data-action="edit-entry"]').forEach(btn => {
    btn.addEventListener('click', () => {
      state.editingId = btn.dataset.id;
      render();
      document.getElementById('entryForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // search
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', () => { state.search = searchInput.value; renderListOnly(section); });
  }
}

function renderListOnly(section) {
  const entries = Store.list(section.id).filter(e => matchesSearch(e, section, state.search));
  const list = entries.length ? entries.map(e => renderEntryCard(section, e)).join('') : `<div class="entry-empty">No entries match "${escapeHtml(state.search)}".</div>`;
  const container = document.querySelector('.entry-list');
  if (container) {
    container.innerHTML = list;
    container.querySelectorAll('[data-action="edit-entry"]').forEach(btn => {
      btn.addEventListener('click', () => {
        state.editingId = btn.dataset.id;
        render();
        document.getElementById('entryForm').scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    });
  }
}

function saveEntryFromForm(section) {
  const date = document.getElementById('entryDate').value;
  if (!date) { showToast('Date is required'); return; }
  const note = document.getElementById('entryNote').value;
  const entry = { date, note };

  section.fields.forEach(f => {
    if (f.type === 'tags') {
      entry[f.key] = state.draftTags[f.key] || [];
    } else if (f.type === 'select') {
      const sel = document.querySelector(`select[data-field="${f.key}"]`);
      const custom = document.querySelector(`[data-custom-for="${f.key}"]`);
      entry[f.key] = sel.value === 'Other' ? (custom.value.trim() || 'Other') : sel.value;
    } else if (f.type === 'number') {
      const input = document.querySelector(`input[data-field="${f.key}"]`);
      entry[f.key] = input.value === '' ? null : parseFloat(input.value);
    } else {
      const input = document.querySelector(`[data-field="${f.key}"]`);
      entry[f.key] = input ? input.value : '';
    }
  });

  if (state.editingId) {
    Store.updateEntry(section.id, state.editingId, entry);
    state.editingId = null;
  } else {
    Store.addEntry(section.id, entry);
  }
  render();
}

/* ---------- Import: CSV / JSON / dated markdown-or-plain-text ---------- */
const FIELD_ALIASES = {
  bjj: {
    date: ['date'],
    sessionType: ['sessiontype', 'session', 'session type', 'type'],
    techniques: ['techniques', 'technique', 'tags', 'tag'],
    position: ['position', 'position focus'],
    note: ['note', 'notes'],
  },
  coding: {
    date: ['date'],
    tags: ['tags', 'tag', 'project', 'stack', 'project tags', 'project / stack'],
    link: ['link', 'url', 'reference', 'reference link'],
    note: ['note', 'notes'],
  },
  sidehustle: {
    date: ['date'],
    taskType: ['tasktype', 'task', 'task type', 'type'],
    timeSpent: ['timespent', 'time', 'time spent', 'hours', 'hrs'],
    revenue: ['revenue', 'money', 'amount', '$'],
    note: ['note', 'notes'],
  },
};

function splitCsvLine(line) {
  const result = [];
  let cur = '', inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQuotes && line[i + 1] === '"') { cur += '"'; i++; }
      else inQuotes = !inQuotes;
    } else if (c === ',' && !inQuotes) { result.push(cur); cur = ''; }
    else cur += c;
  }
  result.push(cur);
  return result;
}
function parseCSV(text) {
  const lines = text.split(/\r\n|\n/).filter(l => l.trim() !== '');
  if (!lines.length) return [];
  const headers = splitCsvLine(lines[0]).map(h => h.trim().toLowerCase());
  return lines.slice(1).map(line => {
    const cells = splitCsvLine(line);
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cells[i] || '').trim());
    return obj;
  });
}

function normalizeImportedObject(sectionId, obj) {
  const aliases = FIELD_ALIASES[sectionId];
  const lowerObj = {};
  Object.keys(obj).forEach(k => lowerObj[k.toLowerCase().trim()] = obj[k]);
  const out = {};
  Object.entries(aliases).forEach(([field, aliasList]) => {
    for (const alias of aliasList) {
      if (lowerObj[alias] !== undefined && lowerObj[alias] !== '') { out[field] = lowerObj[alias]; break; }
    }
  });
  return out;
}

function parsePlainText(sectionId, text) {
  const lines = text.split(/\r\n|\n/);
  const dateHeadingRe = /^#{0,6}\s*(\d{4}-\d{2}-\d{2})\s*:?\s*$/;
  const fieldLineRe = /^\*{0,2}([A-Za-z][A-Za-z /]+?)\*{0,2}\s*:\s*(.+)$/;
  const rawEntries = [];
  let current = null;
  lines.forEach(line => {
    const dateMatch = line.match(dateHeadingRe);
    if (dateMatch) {
      if (current) rawEntries.push(current);
      current = { date: dateMatch[1], rawFields: {}, bodyLines: [] };
      return;
    }
    if (!current) return;
    const fieldMatch = line.match(fieldLineRe);
    if (fieldMatch) current.rawFields[fieldMatch[1].toLowerCase().trim()] = fieldMatch[2].trim();
    else current.bodyLines.push(line);
  });
  if (current) rawEntries.push(current);

  return rawEntries.map(e => {
    const normalized = normalizeImportedObject(sectionId, { date: e.date, ...e.rawFields });
    if (!normalized.note) normalized.note = e.bodyLines.join('\n').trim();
    normalized.date = e.date;
    return normalized;
  });
}

function importText(sectionId, text) {
  const trimmed = text.trim();
  if (!trimmed) return { imported: 0, skipped: 0 };
  let rawObjects = [];

  if (trimmed.startsWith('[') || trimmed.startsWith('{')) {
    let parsed;
    try { parsed = JSON.parse(trimmed); }
    catch (e) { throw new Error('Could not parse as JSON — check the file is valid JSON.'); }
    rawObjects = (Array.isArray(parsed) ? parsed : [parsed]).map(o => normalizeImportedObject(sectionId, o));
  } else if (/^[^\n]*,[^\n]*(\n|$)/.test(trimmed) && /date/i.test(trimmed.split('\n')[0])) {
    rawObjects = parseCSV(trimmed).map(o => normalizeImportedObject(sectionId, o));
  } else {
    rawObjects = parsePlainText(sectionId, trimmed);
  }

  const section = SECTION_BY_ID[sectionId];
  let imported = 0, skipped = 0;
  rawObjects.forEach(obj => {
    const ds = normalizeDate(obj.date);
    if (!ds) { skipped++; return; }
    const entry = { date: ds, note: obj.note || '' };
    section.fields.forEach(f => {
      let val = obj[f.key];
      if (f.type === 'tags') {
        if (typeof val === 'string') val = val.split(/[,;]/).map(s => s.trim()).filter(Boolean);
        entry[f.key] = Array.isArray(val) ? val : [];
      } else if (f.type === 'number') {
        const n = parseFloat(String(val ?? '').replace(/[^0-9.\-]/g, ''));
        entry[f.key] = isNaN(n) ? null : n;
      } else {
        entry[f.key] = val || '';
      }
    });
    Store.addEntry(sectionId, entry);
    imported++;
  });
  return { imported, skipped };
}

/* ---------- Import / Export modals ---------- */
function openModal(innerHtml) {
  document.getElementById('modal-root').innerHTML = `<div class="modal-backdrop" data-action="backdrop"><div class="modal-box">${innerHtml}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }

function openImportModal() {
  const sectionOpts = SECTIONS.map(s => `<option value="${s.id}" ${s.id === state.section ? 'selected' : ''}>${s.icon} ${s.label}</option>`).join('');
  openModal(`
    <div class="modal-title">Import notes<button class="modal-close" data-action="close-modal">✕</button></div>
    <label class="field-label">Import into</label>
    <select class="field-select" id="importSection" style="margin-bottom:12px;">${sectionOpts}</select>
    <div class="field-help">
      Accepts a <b>JSON</b> array of entries, a <b>CSV</b> with a header row (must include a "date" column), or dated
      <b>plain text / Markdown</b> where each entry starts on its own line with just a date (<code>2026-07-19</code> or
      <code>## 2026-07-19</code>), optionally followed by lines like <code>Session type: Gi</code>, with everything else
      treated as the note. Import never overwrites existing entries — it only adds new ones.
    </div>
    <label class="field-label">Upload a file</label>
    <input type="file" id="importFile" accept=".json,.csv,.md,.txt,text/*,application/json" style="margin-bottom:12px;" />
    <label class="field-label">...or paste text directly</label>
    <textarea class="import-textarea" id="importPasteArea" placeholder="Paste JSON, CSV, or dated notes here..."></textarea>
    <div class="modal-actions">
      <button class="btn primary" id="runImportBtn">Import</button>
    </div>
  `);

  document.getElementById('importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const text = await file.text();
    document.getElementById('importPasteArea').value = text;
  });

  document.getElementById('runImportBtn').addEventListener('click', () => {
    const sectionId = document.getElementById('importSection').value;
    const text = document.getElementById('importPasteArea').value;
    try {
      const { imported, skipped } = importText(sectionId, text);
      showToast(`Imported ${imported} entr${imported === 1 ? 'y' : 'ies'}${skipped ? `, skipped ${skipped}` : ''}`);
      closeModal();
      if (sectionId === state.section) render();
    } catch (err) {
      showToast(err.message || 'Import failed');
    }
  });
}

function exportAll() {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `session-notes-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
}

/* ---------- Sync to Habit Tracker ---------- */
const TRACKER_STORAGE_KEY = 'habitTrackerData.v1';

function formatEntryForSync(section, entry) {
  const parts = [];
  section.fields.forEach(f => {
    if (f.key === 'link') return; // handled separately, appended below
    if (f.type === 'tags') {
      if (Array.isArray(entry[f.key]) && entry[f.key].length) parts.push(entry[f.key].join(', '));
    } else if (entry[f.key]) {
      if (f.key === 'timeSpent') parts.push(`${entry[f.key]} hrs`);
      else if (f.key === 'revenue') parts.push(`$${entry[f.key]}`);
      else parts.push(entry[f.key]);
    }
  });
  const header = parts.length ? `[${parts.join(' · ')}]` : '';
  const linkLine = entry.link ? entry.link : '';
  return [header, entry.note || '', linkLine].filter(Boolean).join('\n').trim();
}

function computeSyncPayload() {
  const notes = {};
  SECTIONS.forEach(section => {
    const byDate = {};
    const sorted = [...Store.data.entries[section.id]].sort((a, b) => (a.date + a.createdAt).localeCompare(b.date + b.createdAt));
    sorted.forEach(entry => {
      const text = formatEntryForSync(section, entry);
      if (!text) return;
      byDate[entry.date] = byDate[entry.date] ? byDate[entry.date] + '\n\n---\n\n' + text : text;
    });
    notes[section.id] = byDate;
  });
  return { kind: 'habit-tracker-notes-sync', version: 1, generatedAt: new Date().toISOString(), notes };
}

function mergeSyncIntoTrackerData(trackerData, payload) {
  let updated = 0;
  const emptyDayAreas = () => ({
    sidehustle: { done: false, note: '' }, gym: { done: false },
    bjj: { done: false, note: '' }, coding: { done: false, note: '' },
    growth: { done: false, note: '' }, screentime: { done: false, note: '', value: null },
  });
  Object.entries(payload.notes).forEach(([areaId, byDate]) => {
    Object.entries(byDate).forEach(([ds, text]) => {
      if (!trackerData.days[ds]) trackerData.days[ds] = { ...emptyDayAreas(), rating: null };
      const day = trackerData.days[ds];
      if (!day[areaId]) day[areaId] = { done: false, note: '' };
      const marker = '[Synced from Session Notes]';
      if (!day[areaId].note) { day[areaId].note = `${marker}\n${text}`; updated++; }
      else if (!day[areaId].note.includes(text)) { day[areaId].note += `\n\n${marker}\n${text}`; updated++; }
    });
  });
  return updated;
}

function downloadSyncFile(payload) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `notes-sync-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function syncToTracker() {
  const payload = computeSyncPayload();
  try {
    const raw = localStorage.getItem(TRACKER_STORAGE_KEY);
    if (raw) {
      const trackerData = JSON.parse(raw);
      if (trackerData && trackerData.days) {
        const updated = mergeSyncIntoTrackerData(trackerData, payload);
        localStorage.setItem(TRACKER_STORAGE_KEY, JSON.stringify(trackerData));
        showToast(updated ? `Synced directly — ${updated} day note(s) updated in Tracker` : 'Already up to date — nothing new to sync');
        return;
      }
    }
  } catch (e) {
    console.error('Direct sync failed, falling back to file export.', e);
  }
  downloadSyncFile(payload);
  showToast('Tracker not found in this browser — downloaded a sync file instead (import it from Tracker → Settings)');
}

/* ---------- Global modal close handling ---------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="close-modal"]')) { closeModal(); return; }
  const backdrop = e.target.closest('[data-action="backdrop"]');
  if (backdrop && e.target === backdrop) closeModal();
});

document.getElementById('importBtn').addEventListener('click', openImportModal);
document.getElementById('exportBtn').addEventListener('click', exportAll);
document.getElementById('syncBtn').addEventListener('click', syncToTracker);

/* ---------- Init ---------- */
Store.load();
state.section = parseHash();
render();
