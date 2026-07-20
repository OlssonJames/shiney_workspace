/* ============================================================
   Budget — manual-entry personal finance tracker.
   Dependency-free, localStorage-backed, no build step, no bank sync.

   Cycle model: calendar months ('YYYY-MM'), navigable indefinitely.
   Nothing is stored per-cycle except transactions themselves —
   rollover balances, bill paid-states, and debt progress are all
   DERIVED from the ledgers, so history never needs migrating.
   ============================================================ */

const STORAGE_KEY = 'budgetApp.v1';
const CURRENCY = '$';
const FREQUENCIES = [
  { id: 'monthly', label: 'Monthly', perMonth: 1 },
  { id: 'biweekly', label: 'Every 2 weeks', perMonth: 26 / 12 },
  { id: 'weekly', label: 'Weekly', perMonth: 52 / 12 },
  { id: 'oneoff', label: 'One-off', perMonth: 0 },
];
const CAT_COLORS = ['#0ea5e9', '#ec4899', '#22c55e', '#f97316', '#8b5cf6', '#14b8a6', '#eab308', '#6366f1'];

/* ---------- Helpers ---------- */
function pad2(n) { return String(n).padStart(2, '0'); }
function todayStr() { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }
function currentYm() { return todayStr().slice(0, 7); }
function addYm(ym, n) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}`;
}
function ymLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
}
function ymShort(ym) {
  const [y, m] = ym.split('-').map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString(undefined, { month: 'short' });
}
function daysInYm(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
function makeId() { return (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`); }
function escapeHtml(str) { const div = document.createElement('div'); div.textContent = str == null ? '' : String(str); return div.innerHTML; }
function money(n) {
  const v = Math.round((n + Number.EPSILON) * 100) / 100;
  const abs = Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  return `${v < 0 ? '−' : ''}${CURRENCY}${abs}`;
}
function num(v) { const n = parseFloat(v); return isNaN(n) ? 0 : n; }

/* ---------- Store ---------- */
function defaultData() {
  return {
    version: 1,
    settings: { cycleType: 'monthly' },
    incomes: [],
    bills: [],
    categories: [
      { id: 'needs', name: 'Needs', color: '#0ea5e9', budget: 0, rollover: false },
      { id: 'wants', name: 'Wants', color: '#ec4899', budget: 0, rollover: false },
      { id: 'savings', name: 'Savings', color: '#22c55e', budget: 0, rollover: true },
      { id: 'debt', name: 'Debt Payoff', color: '#f97316', budget: 0, rollover: false },
    ],
    transactions: [],
    debts: [],
    debtPayments: [],
  };
}

const Store = {
  data: null,
  load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      this.data = raw ? JSON.parse(raw) : defaultData();
      const d = defaultData();
      Object.keys(d).forEach(k => { if (this.data[k] === undefined) this.data[k] = d[k]; });
    } catch (e) {
      console.error('Failed to load budget data, starting fresh.', e);
      this.data = defaultData();
    }
    return this.data;
  },
  save() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data)); }
    catch (e) { console.error('Save failed.', e); showToast('Save failed — storage unavailable'); }
  },
};
function catById(id) { return Store.data.categories.find(c => c.id === id); }

/* ---------- Income math ---------- */
function incomeForCycle(ym) {
  let total = 0;
  Store.data.incomes.forEach(inc => {
    if (inc.frequency === 'oneoff') {
      if ((inc.date || '').slice(0, 7) === ym) total += inc.amount;
    } else {
      const f = FREQUENCIES.find(f => f.id === inc.frequency);
      total += inc.amount * (f ? f.perMonth : 1);
    }
  });
  return total;
}

/* ---------- Category math (incl. rollover) ---------- */
function txInCycle(ym) { return Store.data.transactions.filter(t => t.date.slice(0, 7) === ym); }
function spentFor(catId, ym) {
  return txInCycle(ym).filter(t => t.categoryId === catId).reduce((s, t) => s + t.amount, 0);
}
function firstCycle() {
  const dates = Store.data.transactions.map(t => t.date.slice(0, 7));
  const cur = currentYm();
  if (!dates.length) return cur;
  const min = dates.reduce((a, b) => (a < b ? a : b));
  return min < cur ? min : cur;
}
/* Rollover: carry(month m) = budget + carry(m-1) − spent(m-1's spend applied each step).
   Computed forward from the first month that has any data; overspend
   carries as a NEGATIVE balance (honest accounting, not forgiveness).
   Non-rollover categories always start each cycle at their flat budget. */
function carryFor(catId, ym) {
  const cat = catById(catId);
  if (!cat || !cat.rollover) return 0;
  let carry = 0;
  let c = firstCycle();
  let guard = 0;
  while (c < ym && guard++ < 240) {
    carry = (cat.budget + carry) - spentFor(catId, c);
    c = addYm(c, 1);
  }
  return carry;
}
function availableFor(catId, ym) {
  const cat = catById(catId);
  if (!cat) return 0;
  return cat.budget + carryFor(catId, ym);
}

/* ---------- Bills ---------- */
function billPaymentTx(bill, ym) {
  return Store.data.transactions.find(t => t.billId === bill.id && t.date.slice(0, 7) === ym) || null;
}
function billDueDate(bill, ym) {
  return `${ym}-${pad2(Math.min(bill.dueDay, daysInYm(ym)))}`;
}

/* ---------- Debt math ---------- */
function debtPaid(debtId) {
  return Store.data.debtPayments.filter(p => p.debtId === debtId).reduce((s, p) => s + p.amount, 0);
}
function debtBalance(debt) { return Math.max(0, debt.startBalance - debtPaid(debt.id)); }
/* Average of the last 3 calendar months of payment history; falls back
   to the minimum payment when there's no history yet. */
function avgMonthlyPayment(debt) {
  const cutoff = addYm(currentYm(), -3);
  const recent = Store.data.debtPayments.filter(p => p.debtId === debt.id && p.date.slice(0, 7) > cutoff);
  if (!recent.length) return debt.minPayment || 0;
  const months = new Set(recent.map(p => p.date.slice(0, 7))).size || 1;
  return recent.reduce((s, p) => s + p.amount, 0) / Math.max(months, 1);
}
/* Iterate month by month: accrue interest at APR/12, subtract the
   payment, until the balance clears (or never will). */
function projectPayoff(balance, aprPct, monthlyPay) {
  if (balance <= 0) return { months: 0, interest: 0 };
  const r = (aprPct || 0) / 100 / 12;
  if (monthlyPay <= 0 || monthlyPay <= balance * r) return null; // payment doesn't outpace interest
  let b = balance, months = 0, interest = 0;
  while (b > 0 && months < 600) {
    const i = b * r;
    interest += i;
    b = b + i - monthlyPay;
    months++;
  }
  return b <= 0 ? { months, interest } : null;
}
function payoffDateLabel(months) {
  const target = addYm(currentYm(), months);
  return ymLabel(target);
}
/* Snowball vs avalanche: same total monthly amount, different targeting.
   Minimums go to every debt; the surplus (plus minimums freed by paid-off
   debts) attacks one target — smallest balance (snowball) or highest
   rate (avalanche). */
function simulateStrategy(mode) {
  const debts = Store.data.debts
    .map(d => ({ balance: debtBalance(d), rate: (d.rate || 0) / 100 / 12, min: d.minPayment || 0 }))
    .filter(d => d.balance > 0);
  if (!debts.length) return null;
  const totalBudget = Math.max(
    debts.reduce((s, d) => s + d.min, 0),
    Store.data.debts.reduce((s, d) => s + avgMonthlyPayment(d), 0)
  );
  if (totalBudget <= 0) return null;
  let months = 0, interest = 0;
  while (debts.some(d => d.balance > 0) && months < 600) {
    debts.forEach(d => { if (d.balance > 0) { const i = d.balance * d.rate; d.balance += i; interest += i; } });
    let pool = totalBudget;
    debts.forEach(d => {
      if (d.balance <= 0) return;
      const pay = Math.min(d.min, d.balance, pool);
      d.balance -= pay;
      pool -= pay;
    });
    const alive = debts.filter(d => d.balance > 0);
    if (alive.length && pool > 0) {
      const target = mode === 'snowball'
        ? alive.reduce((a, b) => (a.balance < b.balance ? a : b))
        : alive.reduce((a, b) => (a.rate > b.rate ? a : b));
      target.balance -= Math.min(pool, target.balance);
    }
    months++;
  }
  return debts.some(d => d.balance > 0) ? null : { months, interest, monthly: totalBudget };
}

/* ---------- Toast / modal (family pattern) ---------- */
let toastTimer = null;
function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 1400);
}
function openModal(innerHtml) {
  document.getElementById('modal-root').innerHTML =
    `<div class="modal-backdrop" data-action="backdrop"><div class="modal-box">${innerHtml}</div></div>`;
}
function closeModal() { document.getElementById('modal-root').innerHTML = ''; }
document.addEventListener('click', (e) => {
  if (e.target.closest('[data-action="close-modal"]')) { closeModal(); return; }
  const backdrop = e.target.closest('[data-action="backdrop"]');
  if (backdrop && e.target === backdrop) closeModal();
});

/* ---------- App state / routing ---------- */
const state = { tab: 'dashboard', cycle: currentYm() };
const TABS = ['dashboard', 'budget', 'transactions', 'incomebills', 'debts'];
window.addEventListener('hashchange', () => {
  const h = location.hash.replace(/^#/, '');
  if (TABS.includes(h)) { state.tab = h; render(); }
});

/* ---------- Shared UI bits ---------- */
function cycleNavHtml() {
  return `
    <div class="cycle-nav">
      <button class="btn small" data-action="cycle-prev">←</button>
      <span class="cycle-label">${ymLabel(state.cycle)}</span>
      <button class="btn small" data-action="cycle-next">→</button>
      ${state.cycle !== currentYm() ? `<button class="btn small" data-action="cycle-now">Now</button>` : ''}
    </div>`;
}
function catOptions(selected) {
  return Store.data.categories.map(c => `<option value="${c.id}" ${c.id === selected ? 'selected' : ''}>${escapeHtml(c.name)}</option>`).join('');
}
function catBarHtml(cat, ym) {
  const spent = spentFor(cat.id, ym);
  const avail = availableFor(cat.id, ym);
  const pct = avail > 0 ? Math.min(100, (spent / avail) * 100) : (spent > 0 ? 100 : 0);
  const over = avail >= 0 && spent > avail;
  const carry = carryFor(cat.id, ym);
  return `
    <div class="cat-bar-row">
      <div class="cat-bar-top">
        <span class="cat-bar-name"><span class="cat-dot" style="background:${cat.color};"></span>${escapeHtml(cat.name)}</span>
        <span class="cat-bar-nums"><b>${money(spent)}</b> of ${money(avail)}${over ? ' · over' : ''}</span>
      </div>
      <div class="bar"><div class="bar-fill ${over ? 'over' : ''}" style="width:${pct}%;background:${cat.color};"></div></div>
      ${cat.rollover && Math.abs(carry) > 0.004 ? `<div class="rollover-note">includes ${money(carry)} rolled over</div>` : ''}
    </div>`;
}

/* ---------- SVG charts (no libraries) ---------- */
function donutSvg(slices) {
  const total = slices.reduce((s, x) => s + x.value, 0);
  if (total <= 0) return '';
  const R = 52, C = 2 * Math.PI * R;
  let offset = 0;
  const rings = slices.map(s => {
    const frac = s.value / total;
    const seg = `<circle cx="70" cy="70" r="${R}" fill="none" stroke="${s.color}" stroke-width="20"
      stroke-dasharray="${(frac * C).toFixed(2)} ${(C - frac * C).toFixed(2)}"
      stroke-dashoffset="${(-offset * C).toFixed(2)}" transform="rotate(-90 70 70)" />`;
    offset += frac;
    return seg;
  }).join('');
  return `<svg width="140" height="140" viewBox="0 0 140 140" role="img" aria-label="Spending by category">${rings}</svg>`;
}
function trendSvg(items) {
  const W = 300, H = 120, PAD = 4;
  const max = Math.max(...items.map(i => i.value), 1);
  const bw = (W - PAD * 2) / items.length;
  const bars = items.map((it, i) => {
    const h = Math.round((it.value / max) * (H - 24));
    const x = PAD + i * bw + bw * 0.15;
    return `<rect x="${x.toFixed(1)}" y="${H - h - 16}" width="${(bw * 0.7).toFixed(1)}" height="${h}" rx="3"
      fill="${it.current ? 'var(--accent)' : 'var(--border)'}" />`;
  }).join('');
  return `<svg width="100%" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="Spending trend">${bars}</svg>`;
}

/* ============================================================
   Views
   ============================================================ */
function renderDashboard() {
  const ym = state.cycle;
  const income = incomeForCycle(ym);
  const budgeted = Store.data.categories.reduce((s, c) => s + c.budget, 0);
  const spent = txInCycle(ym).reduce((s, t) => s + t.amount, 0);
  const remaining = income - spent;

  const slices = Store.data.categories
    .map(c => ({ label: c.name, color: c.color, value: spentFor(c.id, ym) }))
    .filter(s => s.value > 0);

  const trendItems = [];
  for (let i = 5; i >= 0; i--) {
    const c = addYm(ym, -i);
    trendItems.push({ ym: c, value: txInCycle(c).reduce((s, t) => s + t.amount, 0), current: c === ym });
  }

  const debtsWithBalance = Store.data.debts.filter(d => debtBalance(d) > 0);
  const totalDebt = debtsWithBalance.reduce((s, d) => s + debtBalance(d), 0);

  return `
    <div class="view-header">
      <div><h2 class="view-title">Dashboard</h2><div class="view-sub">Everything for this cycle at a glance</div></div>
      ${cycleNavHtml()}
    </div>
    <div class="stat-row">
      <div class="stat-tile"><div class="num">${money(income)}</div><div class="lbl">Income (est.)</div></div>
      <div class="stat-tile"><div class="num">${money(budgeted)}</div><div class="lbl">Budgeted</div></div>
      <div class="stat-tile"><div class="num">${money(spent)}</div><div class="lbl">Spent</div></div>
      <div class="stat-tile"><div class="num ${remaining >= 0 ? 'pos' : 'neg'}">${money(remaining)}</div><div class="lbl">Remaining</div></div>
    </div>
    <div class="card">
      <h3 class="card-title">Categories</h3>
      ${Store.data.categories.length ? Store.data.categories.map(c => catBarHtml(c, ym)).join('') : `<div class="list-empty">No categories yet — set them up in the Budget tab.</div>`}
    </div>
    <div class="charts-row">
      <div class="card">
        <h3 class="card-title">Spending by category</h3>
        ${slices.length ? `
          <div class="donut-wrap">
            ${donutSvg(slices)}
            <div class="donut-legend">
              ${slices.map(s => `<div class="row"><span class="cat-dot" style="background:${s.color};"></span>${escapeHtml(s.label)}<span class="amt">${money(s.value)}</span></div>`).join('')}
            </div>
          </div>` : `<div class="chart-empty">No spending logged this cycle yet.</div>`}
      </div>
      <div class="card">
        <h3 class="card-title">Spending, last 6 cycles</h3>
        ${trendItems.some(t => t.value > 0) ? `
          ${trendSvg(trendItems)}
          <div class="trend-labels">${trendItems.map(t => `<span>${ymShort(t.ym)}</span>`).join('')}</div>`
          : `<div class="chart-empty">No history yet.</div>`}
      </div>
    </div>
    ${debtsWithBalance.length ? `
      <div class="card">
        <h3 class="card-title">Debt payoff</h3>
        ${debtsWithBalance.map(d => {
          const bal = debtBalance(d);
          const pct = d.startBalance > 0 ? ((d.startBalance - bal) / d.startBalance) * 100 : 0;
          return `
            <div class="cat-bar-row">
              <div class="cat-bar-top">
                <span class="cat-bar-name">${escapeHtml(d.name)}</span>
                <span class="cat-bar-nums"><b>${money(bal)}</b> left of ${money(d.startBalance)}</span>
              </div>
              <div class="bar"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:#f97316;"></div></div>
            </div>`;
        }).join('')}
        <div class="rollover-note">Total remaining: <b>${money(totalDebt)}</b> — details in the Debts tab.</div>
      </div>` : ''}
  `;
}

function renderBudget() {
  const ym = state.cycle;
  const rows = Store.data.categories.map(c => {
    const carry = carryFor(c.id, ym);
    return `
      <div class="list-row" data-id="${c.id}">
        <span class="cat-dot" style="background:${c.color};"></span>
        <div class="grow">
          <div class="title">${escapeHtml(c.name)}</div>
          <div class="sub">${c.rollover ? `rolls over${Math.abs(carry) > 0.004 ? ` · ${money(carry)} carried into ${ymLabel(ym)}` : ''}` : 'resets each cycle'}</div>
        </div>
        <span class="amount">${money(c.budget)}<span style="font-size:11px;color:var(--text-muted);">/cycle</span></span>
        <div class="row-actions">
          <button data-action="edit-cat" data-id="${c.id}" title="Edit">✎</button>
          <button data-action="del-cat" data-id="${c.id}" title="Delete">🗑</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="view-header">
      <div><h2 class="view-title">Budget</h2><div class="view-sub">Per-cycle allocation and rollover per category</div></div>
      ${cycleNavHtml()}
    </div>
    <div class="card">
      ${rows || `<div class="list-empty">No categories yet.</div>`}
    </div>
    <button class="btn primary" data-action="add-cat">+ Add category</button>
  `;
}

function renderTransactions() {
  const ym = state.cycle;
  const txs = txInCycle(ym).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || '').localeCompare(a.createdAt || ''));
  return `
    <div class="view-header">
      <div><h2 class="view-title">Transactions</h2><div class="view-sub">${txs.length} in ${ymLabel(ym)}</div></div>
      ${cycleNavHtml()}
    </div>
    <div class="card">
      <h3 class="card-title">Add transaction</h3>
      <div class="form-grid">
        <div><label class="field-label">Date</label><input type="date" class="field-input" id="txDate" value="${todayStr()}" /></div>
        <div><label class="field-label">Amount</label><input type="number" step="0.01" min="0" class="field-input" id="txAmount" placeholder="0.00" /></div>
        <div><label class="field-label">Category</label><select class="field-select" id="txCat">${catOptions()}</select></div>
        <div><label class="field-label">Note</label><input type="text" class="field-input" id="txNote" placeholder="optional" /></div>
        <button class="btn primary" data-action="add-tx">+ Add</button>
      </div>
    </div>
    <div class="card">
      ${txs.length ? txs.map(t => {
        const cat = catById(t.categoryId);
        return `
          <div class="list-row">
            <span class="cat-dot" style="background:${cat ? cat.color : 'var(--border)'};"></span>
            <div class="grow">
              <div class="title">${escapeHtml(t.note || (cat ? cat.name : 'Uncategorized'))}${t.billId ? ` <span class="pill">bill</span>` : ''}</div>
              <div class="sub">${t.date}${cat ? ` · ${escapeHtml(cat.name)}` : ''}</div>
            </div>
            <span class="amount neg">−${money(t.amount).replace('−', '')}</span>
            <div class="row-actions">
              <button data-action="edit-tx" data-id="${t.id}" title="Edit">✎</button>
              <button data-action="del-tx" data-id="${t.id}" title="Delete">🗑</button>
            </div>
          </div>`;
      }).join('') : `<div class="list-empty">No transactions in ${ymLabel(ym)} yet.</div>`}
    </div>
  `;
}

function renderIncomeBills() {
  const ym = state.cycle;
  const incomeRows = Store.data.incomes.map(inc => {
    const f = FREQUENCIES.find(f => f.id === inc.frequency);
    const monthly = inc.frequency === 'oneoff' ? null : inc.amount * f.perMonth;
    return `
      <div class="list-row">
        <div class="grow">
          <div class="title">${escapeHtml(inc.name)}</div>
          <div class="sub">${f ? f.label : inc.frequency}${inc.frequency === 'oneoff' && inc.date ? ` · ${inc.date}` : ''}${monthly !== null && inc.frequency !== 'monthly' ? ` · ≈${money(monthly)}/mo` : ''}</div>
        </div>
        <span class="amount pos">${money(inc.amount)}</span>
        <div class="row-actions">
          <button data-action="edit-income" data-id="${inc.id}" title="Edit">✎</button>
          <button data-action="del-income" data-id="${inc.id}" title="Delete">🗑</button>
        </div>
      </div>`;
  }).join('');

  const billRows = Store.data.bills.map(b => {
    const paidTx = billPaymentTx(b, ym);
    const cat = catById(b.categoryId);
    return `
      <div class="list-row">
        <span class="cat-dot" style="background:${cat ? cat.color : 'var(--border)'};"></span>
        <div class="grow">
          <div class="title">${escapeHtml(b.name)}</div>
          <div class="sub">due ${billDueDate(b, ym)}${cat ? ` · ${escapeHtml(cat.name)}` : ''}</div>
        </div>
        <span class="amount">${money(b.amount)}</span>
        ${paidTx
          ? `<span class="pill paid">Paid</span><div class="row-actions"><button data-action="unpay-bill" data-id="${b.id}" title="Undo payment">↩</button></div>`
          : `<button class="btn small" data-action="pay-bill" data-id="${b.id}">Mark paid</button>`}
        <div class="row-actions">
          <button data-action="edit-bill" data-id="${b.id}" title="Edit">✎</button>
          <button data-action="del-bill" data-id="${b.id}" title="Delete">🗑</button>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="view-header">
      <div><h2 class="view-title">Income &amp; Bills</h2><div class="view-sub">Recurring money in and out</div></div>
      ${cycleNavHtml()}
    </div>
    <div class="card">
      <h3 class="card-title">Income sources · ≈${money(incomeForCycle(ym))} this cycle</h3>
      ${incomeRows || `<div class="list-empty">No income sources yet.</div>`}
      <div style="margin-top:10px;"><button class="btn primary small" data-action="add-income">+ Add income</button></div>
    </div>
    <div class="card">
      <h3 class="card-title">Recurring bills — ${ymLabel(ym)}</h3>
      <div class="field-help">Bills auto-appear every cycle. "Mark paid" logs a transaction in the bill's category for this cycle, so it counts against that budget without re-entering it.</div>
      ${billRows || `<div class="list-empty">No recurring bills yet.</div>`}
      <div style="margin-top:10px;"><button class="btn primary small" data-action="add-bill">+ Add bill</button></div>
    </div>
  `;
}

function renderDebts() {
  const debts = Store.data.debts;
  const snow = simulateStrategy('snowball');
  const aval = simulateStrategy('avalanche');

  const debtCards = debts.map(d => {
    const bal = debtBalance(d);
    const paid = debtPaid(d.id);
    const pct = d.startBalance > 0 ? (paid / d.startBalance) * 100 : 0;
    const proj = projectPayoff(bal, d.rate, avgMonthlyPayment(d));
    const payments = Store.data.debtPayments.filter(p => p.debtId === d.id).sort((a, b) => b.date.localeCompare(a.date));
    return `
      <div class="card">
        <div class="debt-head">
          <div>
            <div class="title" style="font-weight:800;">${escapeHtml(d.name)}</div>
            <div class="debt-meta">${d.rate}% APR · min ${money(d.minPayment)}/mo · avg payment ${money(avgMonthlyPayment(d))}/mo</div>
          </div>
          <div class="row-actions">
            <button data-action="edit-debt" data-id="${d.id}" title="Edit">✎</button>
            <button data-action="del-debt" data-id="${d.id}" title="Delete">🗑</button>
          </div>
        </div>
        <div class="debt-bar">
          <div class="cat-bar-top">
            <span class="cat-bar-nums">paid <b>${money(paid)}</b></span>
            <span class="cat-bar-nums">remaining <b>${money(bal)}</b></span>
          </div>
          <div class="bar"><div class="bar-fill" style="width:${pct.toFixed(1)}%;background:#f97316;"></div></div>
        </div>
        <div class="debt-meta">
          ${bal <= 0 ? '🎉 Paid off!' : proj
            ? `Projected payoff: <b>${payoffDateLabel(proj.months)}</b> (${proj.months} mo, ≈${money(proj.interest)} interest at current pace)`
            : `At the current payment pace this balance never pays off — payments don't outpace interest.`}
        </div>
        <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap;">
          <button class="btn small primary" data-action="log-payment" data-id="${d.id}">+ Log payment</button>
          ${payments.length ? `<button class="btn small" data-action="view-payments" data-id="${d.id}">History (${payments.length})</button>` : ''}
        </div>
      </div>`;
  }).join('');

  return `
    <div class="view-header">
      <div><h2 class="view-title">Debts</h2><div class="view-sub">Balances, payments, and payoff projections</div></div>
    </div>
    ${(snow && aval) ? `
      <div class="card">
        <h3 class="card-title">Payoff strategy comparison — same total monthly (${money(snow.monthly)})</h3>
        <div class="strategy-grid">
          <div class="strategy-box">
            <h4>❄️ Snowball <span style="color:var(--text-muted);font-weight:400;">(smallest balance first)</span></h4>
            <div class="big">${snow.months} months</div>
            <div class="note">debt-free ${payoffDateLabel(snow.months)} · ≈${money(snow.interest)} total interest</div>
          </div>
          <div class="strategy-box">
            <h4>🏔️ Avalanche <span style="color:var(--text-muted);font-weight:400;">(highest rate first)</span></h4>
            <div class="big">${aval.months} months</div>
            <div class="note">debt-free ${payoffDateLabel(aval.months)} · ≈${money(aval.interest)} total interest</div>
          </div>
        </div>
        <div class="rollover-note">Avalanche saves ≈${money(Math.max(0, snow.interest - aval.interest))} in interest vs snowball; snowball clears individual debts sooner for momentum.</div>
      </div>` : ''}
    ${debtCards || `<div class="card"><div class="list-empty">No debts tracked. Congratulations — or add one below.</div></div>`}
    <button class="btn primary" data-action="add-debt">+ Add debt</button>
  `;
}

/* ---------- Render dispatch ---------- */
function render() {
  document.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.tab === state.tab));
  const app = document.getElementById('app');
  if (state.tab === 'dashboard') app.innerHTML = renderDashboard();
  else if (state.tab === 'budget') app.innerHTML = renderBudget();
  else if (state.tab === 'transactions') app.innerHTML = renderTransactions();
  else if (state.tab === 'incomebills') app.innerHTML = renderIncomeBills();
  else if (state.tab === 'debts') app.innerHTML = renderDebts();
}

/* ============================================================
   Modals (add/edit forms)
   ============================================================ */
function openCatModal(cat) {
  const isEdit = !!cat;
  openModal(`
    <div class="modal-title">${isEdit ? 'Edit category' : 'New category'}<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group"><label class="field-label">Name</label><input type="text" class="field-input" id="mCatName" value="${isEdit ? escapeHtml(cat.name) : ''}" /></div>
    <div class="field-group"><label class="field-label">Budget per cycle</label><input type="number" step="0.01" min="0" class="field-input" id="mCatBudget" value="${isEdit ? cat.budget : ''}" placeholder="0.00" /></div>
    <div class="field-group"><label class="field-label">Color</label><input type="color" id="mCatColor" value="${isEdit ? cat.color : CAT_COLORS[Store.data.categories.length % CAT_COLORS.length]}" /></div>
    <label class="inline-check"><input type="checkbox" id="mCatRollover" ${isEdit && cat.rollover ? 'checked' : ''} /> Unspent amount rolls over to next cycle</label>
    <div class="field-help">Rollover suits accumulating goals (savings, annual bills). Non-rollover categories reset to their budget every cycle. Overspending a rollover category carries the shortfall forward too.</div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="mCatSave">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `);
  document.getElementById('mCatSave').addEventListener('click', () => {
    const name = document.getElementById('mCatName').value.trim();
    if (!name) { showToast('Name is required'); return; }
    const patch = {
      name,
      budget: num(document.getElementById('mCatBudget').value),
      color: document.getElementById('mCatColor').value,
      rollover: document.getElementById('mCatRollover').checked,
    };
    if (isEdit) Object.assign(cat, patch);
    else Store.data.categories.push({ id: makeId(), ...patch });
    Store.save(); closeModal(); render();
  });
}

function openIncomeModal(inc) {
  const isEdit = !!inc;
  const freqOpts = FREQUENCIES.map(f => `<option value="${f.id}" ${isEdit && inc.frequency === f.id ? 'selected' : ''}>${f.label}</option>`).join('');
  openModal(`
    <div class="modal-title">${isEdit ? 'Edit income' : 'New income source'}<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group"><label class="field-label">Name</label><input type="text" class="field-input" id="mIncName" value="${isEdit ? escapeHtml(inc.name) : ''}" placeholder="Salary, side hustle..." /></div>
    <div class="field-group"><label class="field-label">Amount</label><input type="number" step="0.01" min="0" class="field-input" id="mIncAmount" value="${isEdit ? inc.amount : ''}" placeholder="0.00" /></div>
    <div class="field-group"><label class="field-label">Frequency</label><select class="field-select" id="mIncFreq">${freqOpts}</select></div>
    <div class="field-group" id="mIncDateWrap" style="display:${isEdit && inc.frequency === 'oneoff' ? 'block' : 'none'};">
      <label class="field-label">Date (one-off)</label><input type="date" class="field-input" id="mIncDate" value="${isEdit && inc.date ? inc.date : todayStr()}" />
    </div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="mIncSave">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `);
  document.getElementById('mIncFreq').addEventListener('change', (e) => {
    document.getElementById('mIncDateWrap').style.display = e.target.value === 'oneoff' ? 'block' : 'none';
  });
  document.getElementById('mIncSave').addEventListener('click', () => {
    const name = document.getElementById('mIncName').value.trim();
    if (!name) { showToast('Name is required'); return; }
    const frequency = document.getElementById('mIncFreq').value;
    const patch = {
      name, frequency,
      amount: num(document.getElementById('mIncAmount').value),
      date: frequency === 'oneoff' ? document.getElementById('mIncDate').value : null,
    };
    if (isEdit) Object.assign(inc, patch);
    else Store.data.incomes.push({ id: makeId(), ...patch });
    Store.save(); closeModal(); render();
  });
}

function openBillModal(bill) {
  const isEdit = !!bill;
  openModal(`
    <div class="modal-title">${isEdit ? 'Edit bill' : 'New recurring bill'}<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group"><label class="field-label">Name</label><input type="text" class="field-input" id="mBillName" value="${isEdit ? escapeHtml(bill.name) : ''}" placeholder="Rent, Spotify..." /></div>
    <div class="field-group"><label class="field-label">Amount</label><input type="number" step="0.01" min="0" class="field-input" id="mBillAmount" value="${isEdit ? bill.amount : ''}" placeholder="0.00" /></div>
    <div class="field-group"><label class="field-label">Due day of month (1–31)</label><input type="number" min="1" max="31" class="field-input" id="mBillDue" value="${isEdit ? bill.dueDay : 1}" /></div>
    <div class="field-group"><label class="field-label">Counts against category</label><select class="field-select" id="mBillCat">${catOptions(isEdit ? bill.categoryId : undefined)}</select></div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="mBillSave">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `);
  document.getElementById('mBillSave').addEventListener('click', () => {
    const name = document.getElementById('mBillName').value.trim();
    if (!name) { showToast('Name is required'); return; }
    const patch = {
      name,
      amount: num(document.getElementById('mBillAmount').value),
      dueDay: Math.min(31, Math.max(1, parseInt(document.getElementById('mBillDue').value, 10) || 1)),
      categoryId: document.getElementById('mBillCat').value,
    };
    if (isEdit) Object.assign(bill, patch);
    else Store.data.bills.push({ id: makeId(), ...patch });
    Store.save(); closeModal(); render();
  });
}

function openTxModal(tx) {
  openModal(`
    <div class="modal-title">Edit transaction<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group"><label class="field-label">Date</label><input type="date" class="field-input" id="mTxDate" value="${tx.date}" /></div>
    <div class="field-group"><label class="field-label">Amount</label><input type="number" step="0.01" min="0" class="field-input" id="mTxAmount" value="${tx.amount}" /></div>
    <div class="field-group"><label class="field-label">Category</label><select class="field-select" id="mTxCat">${catOptions(tx.categoryId)}</select></div>
    <div class="field-group"><label class="field-label">Note</label><input type="text" class="field-input" id="mTxNote" value="${escapeHtml(tx.note || '')}" /></div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="mTxSave">Save</button>
    </div>
  `);
  document.getElementById('mTxSave').addEventListener('click', () => {
    Object.assign(tx, {
      date: document.getElementById('mTxDate').value || tx.date,
      amount: num(document.getElementById('mTxAmount').value),
      categoryId: document.getElementById('mTxCat').value,
      note: document.getElementById('mTxNote').value,
    });
    Store.save(); closeModal(); render();
  });
}

function openDebtModal(debt) {
  const isEdit = !!debt;
  openModal(`
    <div class="modal-title">${isEdit ? 'Edit debt' : 'New debt'}<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group"><label class="field-label">Name</label><input type="text" class="field-input" id="mDebtName" value="${isEdit ? escapeHtml(debt.name) : ''}" placeholder="Car loan, credit card..." /></div>
    <div class="field-group"><label class="field-label">Starting balance</label><input type="number" step="0.01" min="0" class="field-input" id="mDebtBal" value="${isEdit ? debt.startBalance : ''}" placeholder="0.00" /></div>
    <div class="field-group"><label class="field-label">Interest rate (APR %)</label><input type="number" step="0.01" min="0" class="field-input" id="mDebtRate" value="${isEdit ? debt.rate : ''}" placeholder="e.g. 19.9" /></div>
    <div class="field-group"><label class="field-label">Minimum payment / month</label><input type="number" step="0.01" min="0" class="field-input" id="mDebtMin" value="${isEdit ? debt.minPayment : ''}" placeholder="0.00" /></div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="mDebtSave">${isEdit ? 'Save' : 'Add'}</button>
    </div>
  `);
  document.getElementById('mDebtSave').addEventListener('click', () => {
    const name = document.getElementById('mDebtName').value.trim();
    if (!name) { showToast('Name is required'); return; }
    const patch = {
      name,
      startBalance: num(document.getElementById('mDebtBal').value),
      rate: num(document.getElementById('mDebtRate').value),
      minPayment: num(document.getElementById('mDebtMin').value),
    };
    if (isEdit) Object.assign(debt, patch);
    else Store.data.debts.push({ id: makeId(), ...patch });
    Store.save(); closeModal(); render();
  });
}

function openPaymentModal(debt) {
  openModal(`
    <div class="modal-title">Log payment — ${escapeHtml(debt.name)}<button class="modal-close" data-action="close-modal">✕</button></div>
    <div class="field-group"><label class="field-label">Date</label><input type="date" class="field-input" id="mPayDate" value="${todayStr()}" /></div>
    <div class="field-group"><label class="field-label">Amount</label><input type="number" step="0.01" min="0" class="field-input" id="mPayAmount" value="${debt.minPayment || ''}" /></div>
    <div class="field-help">Debt payments are tracked in their own ledger (not as category transactions) so they aren't double-counted against a spending category. If you also budget a "Debt Payoff" category, log it there separately only if you want it counted in spending.</div>
    <div class="modal-actions">
      <button class="btn" data-action="close-modal">Cancel</button>
      <button class="btn primary" id="mPaySave">Log</button>
    </div>
  `);
  document.getElementById('mPaySave').addEventListener('click', () => {
    const amount = num(document.getElementById('mPayAmount').value);
    if (amount <= 0) { showToast('Amount must be positive'); return; }
    Store.data.debtPayments.push({ id: makeId(), debtId: debt.id, date: document.getElementById('mPayDate').value || todayStr(), amount });
    Store.save(); closeModal(); render();
    showToast('Payment logged');
  });
}

function openPaymentsHistoryModal(debt) {
  const payments = Store.data.debtPayments.filter(p => p.debtId === debt.id).sort((a, b) => b.date.localeCompare(a.date));
  openModal(`
    <div class="modal-title">Payments — ${escapeHtml(debt.name)}<button class="modal-close" data-action="close-modal">✕</button></div>
    ${payments.map(p => `
      <div class="list-row">
        <div class="grow"><div class="title">${p.date}</div></div>
        <span class="amount pos">${money(p.amount)}</span>
        <div class="row-actions"><button data-action="del-payment" data-id="${p.id}" title="Delete">🗑</button></div>
      </div>`).join('')}
  `);
}

/* ============================================================
   Event delegation
   ============================================================ */
document.getElementById('app').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const action = btn.dataset.action;
  const id = btn.dataset.id;

  if (action === 'cycle-prev') { state.cycle = addYm(state.cycle, -1); render(); }
  else if (action === 'cycle-next') { state.cycle = addYm(state.cycle, 1); render(); }
  else if (action === 'cycle-now') { state.cycle = currentYm(); render(); }

  else if (action === 'add-cat') openCatModal(null);
  else if (action === 'edit-cat') openCatModal(catById(id));
  else if (action === 'del-cat') {
    const used = Store.data.transactions.filter(t => t.categoryId === id).length;
    if (!confirm(used ? `Delete this category? ${used} transaction(s) will become uncategorized.` : 'Delete this category?')) return;
    Store.data.categories = Store.data.categories.filter(c => c.id !== id);
    Store.save(); render();
  }

  else if (action === 'add-tx') {
    const amount = num(document.getElementById('txAmount').value);
    if (amount <= 0) { showToast('Amount must be positive'); return; }
    Store.data.transactions.push({
      id: makeId(), createdAt: new Date().toISOString(),
      date: document.getElementById('txDate').value || todayStr(),
      amount,
      categoryId: document.getElementById('txCat').value,
      note: document.getElementById('txNote').value.trim(),
    });
    Store.save(); render(); showToast('Added');
  }
  else if (action === 'edit-tx') { const tx = Store.data.transactions.find(t => t.id === id); if (tx) openTxModal(tx); }
  else if (action === 'del-tx') {
    if (!confirm('Delete this transaction?')) return;
    Store.data.transactions = Store.data.transactions.filter(t => t.id !== id);
    Store.save(); render();
  }

  else if (action === 'add-income') openIncomeModal(null);
  else if (action === 'edit-income') { const inc = Store.data.incomes.find(i => i.id === id); if (inc) openIncomeModal(inc); }
  else if (action === 'del-income') {
    if (!confirm('Delete this income source?')) return;
    Store.data.incomes = Store.data.incomes.filter(i => i.id !== id);
    Store.save(); render();
  }

  else if (action === 'add-bill') {
    if (!Store.data.categories.length) { showToast('Add a category first'); return; }
    openBillModal(null);
  }
  else if (action === 'edit-bill') { const b = Store.data.bills.find(b => b.id === id); if (b) openBillModal(b); }
  else if (action === 'del-bill') {
    if (!confirm('Delete this recurring bill? Past logged payments stay as transactions.')) return;
    Store.data.bills = Store.data.bills.filter(b => b.id !== id);
    Store.save(); render();
  }
  else if (action === 'pay-bill') {
    const bill = Store.data.bills.find(b => b.id === id);
    if (!bill) return;
    Store.data.transactions.push({
      id: makeId(), createdAt: new Date().toISOString(),
      date: billDueDate(bill, state.cycle),
      amount: bill.amount, categoryId: bill.categoryId,
      note: bill.name, billId: bill.id,
    });
    Store.save(); render(); showToast(`${bill.name} marked paid`);
  }
  else if (action === 'unpay-bill') {
    const bill = Store.data.bills.find(b => b.id === id);
    const tx = bill && billPaymentTx(bill, state.cycle);
    if (tx) {
      Store.data.transactions = Store.data.transactions.filter(t => t.id !== tx.id);
      Store.save(); render();
    }
  }

  else if (action === 'add-debt') openDebtModal(null);
  else if (action === 'edit-debt') { const d = Store.data.debts.find(d => d.id === id); if (d) openDebtModal(d); }
  else if (action === 'del-debt') {
    if (!confirm('Delete this debt and its payment history?')) return;
    Store.data.debts = Store.data.debts.filter(d => d.id !== id);
    Store.data.debtPayments = Store.data.debtPayments.filter(p => p.debtId !== id);
    Store.save(); render();
  }
  else if (action === 'log-payment') { const d = Store.data.debts.find(d => d.id === id); if (d) openPaymentModal(d); }
  else if (action === 'view-payments') { const d = Store.data.debts.find(d => d.id === id); if (d) openPaymentsHistoryModal(d); }
});

/* Payment-history deletes live inside the modal, outside #app. */
document.getElementById('modal-root').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action="del-payment"]');
  if (!btn) return;
  if (!confirm('Delete this payment?')) return;
  Store.data.debtPayments = Store.data.debtPayments.filter(p => p.id !== btn.dataset.id);
  Store.save(); closeModal(); render();
});

/* ---------- Export / Import ---------- */
document.getElementById('exportBtn').addEventListener('click', () => {
  const blob = new Blob([JSON.stringify(Store.data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `budget-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  showToast('Backup downloaded');
});
document.getElementById('importBtn').addEventListener('click', () => document.getElementById('importFile').click());
document.getElementById('importFile').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || !Array.isArray(parsed.categories) || !Array.isArray(parsed.transactions)) throw new Error('Invalid file');
      Store.data = parsed;
      Store.save(); showToast('Data imported'); render();
    } catch (err) { showToast('Import failed — invalid file'); }
  };
  reader.readAsText(file);
});

/* ---------- Init ---------- */
Store.load();
const initialHash = location.hash.replace(/^#/, '');
if (TABS.includes(initialHash)) state.tab = initialHash;
else location.hash = '#dashboard';
render();

window.addEventListener('storage', (e) => {
  if (e.key === STORAGE_KEY) { Store.load(); render(); }
});
