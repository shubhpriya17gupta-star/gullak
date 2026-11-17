// Checks site/arth-save.js (Save my results) without a browser or Firebase:
// record shape and limits (the same ones firestore.rules enforces), stable ids, safe restore,
// the pending result kept during sign-in (used once, expires), and how each tool page is wired.
const fs = require('fs'), path = require('path'), vm = require('vm');
const SITE = path.join(__dirname, '../../site');
let fail = 0;
const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, '| got', JSON.stringify(a), '| want', JSON.stringify(b)); };

function fakeEl() {
  return { children: [], style: {}, setAttribute() {}, appendChild(c) { this.children.push(c); return c; }, addEventListener() {}, remove() {},
    querySelector: () => fakeEl(), querySelectorAll: () => [], textContent: '', innerHTML: '', hidden: false, className: '' };
}
function load(opts) {
  const store = Object.assign({}, opts.store || {});
  const toasts = [];
  const win = {
    localStorage: { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => { store[k] = String(v); }, removeItem: (k) => { delete store[k]; } },
    location: { search: opts.search || '', pathname: '/Workspace.dc.html', hash: '', href: '' },
    history: { replaceState() {} },
    document: { readyState: 'complete', createElement: fakeEl, head: fakeEl(), body: fakeEl(), addEventListener() {} },
    console: { warn() {}, log() {} },
    URLSearchParams, setTimeout, clearTimeout, Promise, JSON, Date, Math, Object, Array, String, Number,
  };
  win.window = win;
  if (opts.user !== undefined) win.ArthAuth = { configured: () => true, ready: Promise.resolve(), user: () => opts.user, firebase: () => Promise.reject(new Error('no firebase in tests')) };
  vm.createContext(win);
  vm.runInContext(fs.readFileSync(path.join(SITE, 'arth-save.js'), 'utf8'), win);
  const S = win.ArthSave;
  const realToast = S.toast;
  return { S, store, toasts, win, realToast };
}

/* ---------- pure helpers ---------- */
const { S } = load({});
const T = S._t;
const RULE_ID = /^[a-z]+-[a-z0-9]{1,40}$/;

const a = T.clean({ tool: 'recovery', title: '25.00% fall', summary: 's', inputs: [{ k: 'Fall', v: '25.00%' }], outputs: [], state: { mode: 'pct', loss: '25' } });
const b = T.clean({ tool: 'recovery', title: '25.00% fall', summary: 's', inputs: [], outputs: [], state: { mode: 'pct', loss: '25' } });
const c = T.clean({ tool: 'recovery', title: '30.00% fall', summary: 's', inputs: [], outputs: [], state: { mode: 'pct', loss: '30' } });
eq('same inputs give the same id (no duplicate records)', a.id, b.id);
eq('different inputs give a different id', a.id === c.id, false);
eq('id matches the Firestore rule', RULE_ID.test(a.id) && a.id.startsWith('recovery-'), true);
eq('only the fields the rules allow', Object.keys(a).sort(), ['id', 'inputs', 'methodVersion', 'outputs', 'state', 'summary', 'title', 'tool', 'v']);
eq('unknown tool rejected', T.clean({ tool: 'candles', title: 'x', state: {} }), null);
eq('missing state rejected', T.clean({ tool: 'planner', title: 'x' }), null);
eq('missing title rejected', T.clean({ tool: 'planner', title: '', state: {} }), null);
eq('nothing to save (null) rejected', T.clean(null), null);
eq('fixed practice id kept', T.clean({ tool: 'practice', id: 'practice-progress', title: 'P', state: { blob: '{}' } }).id, 'practice-progress');
eq('id for another tool rejected', T.clean({ tool: 'practice', id: 'planner-abc', title: 'P', state: {} }), null);
const big = T.clean({ tool: 'planner', title: 'x'.repeat(500), summary: 'y'.repeat(900), inputs: Array.from({ length: 60 }, (_, i) => ({ k: 'k' + i, v: 'v'.repeat(900) })), outputs: [{ k: '', v: 'dropped' }, null], state: {} });
eq('title capped at 120', big.title.length, 120);
eq('summary capped at 300', big.summary.length, 300);
eq('at most 40 rows', big.inputs.length, 40);
eq('row value capped at 600', big.inputs[0].v.length, 600);
eq('empty rows dropped', big.outputs.length, 0);
eq('values kept as given (never recalculated)', a.inputs[0].v, '25.00%');

const tpl = { f: { pv: '', yunit: 'years' }, obj: null, drop: 25, a: { t4: null } };
eq('restore keeps known fields', T.pick(tpl, { f: { pv: '1,00,000', yunit: 'months' }, obj: 2, drop: 40, a: { t4: 'never' } }), { f: { pv: '1,00,000', yunit: 'months' }, obj: 2, drop: 40, a: { t4: 'never' } });
eq('restore drops unknown fields and wrong types', T.pick(tpl, { f: { pv: 5, evil: 'x' }, obj: { x: 1 }, drop: '40', extra: 1 }), { f: { pv: '', yunit: 'years' }, obj: null, drop: 25, a: { t4: null } });
eq('restore of nothing gives the blank form', T.pick(tpl, null), { f: { pv: '', yunit: 'years' }, obj: null, drop: 25, a: { t4: null } });
eq('over-long text not restored', T.pick({ x: '' }, { x: 'z'.repeat(201) }).x, '');

const now = Date.now();
eq('pending fresh', T.fresh({ at: now - 1000, rec: {} }, now), true);
eq('pending expires after 6 hours', T.fresh({ at: now - T.MAX_AGE - 1, rec: {} }, now), false);
eq('pending from the future ignored', T.fresh({ at: now + 60000, rec: {} }, now), false);

/* ---------- the pending result kept during sign-in ---------- */
(async () => {
  const rec = T.clean({ tool: 'recovery', title: 't', summary: 's', inputs: [], outputs: [], state: { mode: 'pct', loss: '25', orig: '', cur: '', rate: '' } });
  const pend = JSON.stringify({ at: Date.now(), rec, consent: true });

  // came back without signing in (cancelled): results restored, nothing saved, copy removed
  let L = load({ user: null, store: { 'arth.pending': pend } });
  let got = null;
  await L.S.resume('recovery', (st) => { got = st; });
  eq('cancelled: results restored', got && got.loss, '25');
  eq('cancelled: pending removed', 'arth.pending' in L.store, false);

  // a pending result for another tool is left alone
  L = load({ user: null, store: { 'arth.pending': pend } });
  got = null;
  await L.S.resume('planner', (st) => { got = st; });
  eq('other tool: not restored', got, null);
  eq('other tool: pending kept', 'arth.pending' in L.store, true);

  // expired: dropped, not restored
  L = load({ user: null, store: { 'arth.pending': JSON.stringify({ at: Date.now() - T.MAX_AGE - 5, rec, consent: true }) } });
  got = null;
  await L.S.resume('recovery', (st) => { got = st; });
  eq('expired: not restored', got, null);
  eq('expired: removed', 'arth.pending' in L.store, false);

  // signed in on return: restored first, then saved once (the database is unreachable here, so the save fails honestly)
  L = load({ user: { uid: 'u1' }, store: { 'arth.pending': pend } });
  got = null;
  const r = await L.S.resume('recovery', (st) => { got = st; });
  eq('signed in: results restored before saving', got && got.loss, '25');
  eq('signed in: pending used once', 'arth.pending' in L.store, false);
  eq('signed in: consent remembered for this account', L.store['arth.saveok.u1'], '1');
  eq('failed write is reported as failed, never as saved', r, 'failed');
  got = null;
  await L.S.resume('recovery', (st) => { got = st; });
  eq('second visit does not save again', got, null);

  // nothing to save yet
  L = load({ user: { uid: 'u1' } });
  eq('unfinished calculation is not saved', await L.S.save(null), 'invalid');

  /* ---------- page wiring ---------- */
  const pages = { 'Workspace.dc.html': 'planner', 'Recovery.dc.html': 'recovery', 'TradeCost.dc.html': 'tradecost', 'Practice.dc.html': 'practice' };
  for (const [file, tool] of Object.entries(pages)) {
    const html = fs.readFileSync(path.join(SITE, file), 'utf8');
    const iSave = html.indexOf('<script src="./arth-save.js"></script>'), iSup = html.indexOf('<script src="./support.js"></script>');
    eq(file + ': arth-save.js loads before support.js, without defer', iSave > 0 && iSave < iSup, true);
    eq(file + ': has a save button', /onClick="\{\{saveMine\}\}"/.test(html), true);
    eq(file + ': resumes a pending save on load', html.includes("ArthSave.resume('" + tool + "'"), true);
    const js = html.match(/data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1];
    let parsed = true; try { new Function('DCLogic', js); } catch (e) { parsed = e.message; }
    eq(file + ': page script still parses', parsed, true);
  }
  const auth = fs.readFileSync(path.join(SITE, 'auth-config.js'), 'utf8');
  eq('every tool is open without an account (gate: false)', /gate:\s*false/.test(auth), true);
  const rules = fs.readFileSync(path.join(__dirname, '../../firestore.rules'), 'utf8');
  eq('rules: owner-only paths', rules.includes('match /users/{uid}/savedResults/{resultId}') && rules.includes('request.auth.uid == uid'), true);
  eq('rules: no open test-mode rule', /allow\s+read\s*,\s*write\s*:\s*if\s+true/.test(rules), false);

  console.log(fail ? 'FAILURES ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
})();
