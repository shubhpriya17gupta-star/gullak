// Runs tools/apps-script/Code.gs against small fakes of Sheets, Firebase and the Apps Script services.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
let fail = 0;
const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, '| got', JSON.stringify(a), '| want', JSON.stringify(b)); };

function fakeSheet(rows) {
  return {
    getLastRow: () => rows.length,
    appendRow: (r) => { rows.push(r.slice()); },
    deleteRow: (r) => { rows.splice(r - 1, 1); },
    setFrozenRows: () => {},
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = []; for (let j = 0; j < (nc || 1); j++) row.push(rows[r - 1 + i][c - 1 + j]); o.push(row); } return o; },
      getValue: () => rows[r - 1][c - 1],
      setValue: (v) => { rows[r - 1][c - 1] = v; },
    }),
  };
}

function make(opts) {
  const tabs = { Accounts: [], Visitors: [] };             // rows[0] is the header once created
  const made = {};
  const cache = {};
  const users = opts.users || {};                          // idToken -> firebase user record
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: (n) => (made[n] || null), insertSheet: (n) => (made[n] = fakeSheet(tabs[n])) }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    CacheService: { getScriptCache: () => ({ get: (k) => (k in cache ? cache[k] : null), put: (k, v) => { cache[k] = v; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => (opts.noKey ? null : 'KEY123') }) },
    UrlFetchApp: { fetch: (url, o) => { const tok = JSON.parse(o.payload).idToken; const u = users[tok]; return { getResponseCode: () => (u ? 200 : 400), getContentText: () => JSON.stringify(u ? { users: [u] } : { error: {} }) }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
  };
  const fn = new Function(...Object.keys(g), src + '\nreturn {doPost,text,dayKey};');
  const m = fn(...Object.values(g));
  const post = (body) => JSON.parse(m.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).s);
  return { post, rows: tabs.Accounts, vrows: tabs.Visitors, text: m.text, dayKey: m.dayKey, cache };
}

const asha = { localId: 'uid-asha', email: 'Asha@Example.com', displayName: 'Asha', emailVerified: false, providerUserInfo: [{ providerId: 'password' }] };
const evil = { localId: 'uid-evil', email: 'e@example.com', displayName: '=HYPERLINK("http://x","click")', emailVerified: true, providerUserInfo: [{ providerId: 'google.com' }] };
const t = make({ users: { tokA: asha, tokE: evil } });

eq('bad token rejected', t.post({ idToken: 'nope', consent: true }), { ok: false });
eq('missing token rejected', t.post({ consent: true }), { ok: false });
eq('garbage body rejected', t.post('not json'), { ok: false });
eq('nothing written yet', t.rows.length, 0);

eq('new sign-up accepted', t.post({ idToken: 'tokA', consent: true, action: 'signup', source: 'Main.dc.html' }), { ok: true });
eq('header + 1 row', t.rows.length, 2);
const r = t.rows[1];
eq('uid stored', r[0], 'uid-asha');
eq('email lower-cased', r[1], 'asha@example.com');
eq('method', r[3], 'password');
eq('verified no', r[4], 'no');
eq('visits starts at 1', r[7], 1);
eq('consent yes', r[8], 'yes');

eq('same person signs in again', t.post({ idToken: 'tokA', consent: false, action: 'signin' }), { ok: true, returning: true });
eq('still one data row', t.rows.length, 2);
eq('visits 2', t.rows[1][7], 2);
eq('consent kept', t.rows[1][8], 'yes');

eq('formula name accepted', t.post({ idToken: 'tokE', consent: true }), { ok: true });
eq('formula name neutralised', t.rows[2][2], '\'=HYPERLINK("http://x","click")');
eq('two people, two rows', t.rows.length, 3);

eq('long source trimmed', t.text('x'.repeat(100), 60).length, 60);
eq('plus/minus/at neutralised', ['+1', '-1', '@a'].map((s) => t.text(s, 10)).join(' '), "'+1 '-1 '@a");

eq('delete needs a valid token', t.post({ idToken: 'nope', action: 'delete' }), { ok: false });
eq('rows untouched by bad delete', t.rows.length, 3);
eq('delete own row', t.post({ idToken: 'tokA', action: 'delete' }), { ok: true, deleted: true });
eq('only that row removed', t.rows.map((x) => x[0]), ['UID', 'uid-evil']);
eq('delete again is harmless', t.post({ idToken: 'tokA', action: 'delete' }), { ok: true, deleted: true });
eq('other person kept', t.rows.length, 2);

const t2 = make({ users: { tokA: asha }, noKey: true });
eq('no FIREBASE_API_KEY property => nothing written', t2.post({ idToken: 'tokA', consent: true }), { ok: false });

/* ---------- Visitors tab ---------- */
const V1 = 'a'.repeat(32), V2 = 'b'.repeat(32);
const v = make({ users: { tokA: asha } });
eq('visit: bad visitor id rejected', v.post({ action: 'visit', vid: 'short', page: 'Main.dc.html' }), { ok: false });
eq('visit: nothing written', v.vrows.length, 0);
eq('first visit accepted', v.post({ action: 'visit', vid: V1, page: 'Workspace.dc.html', src: 'google.com', device: 'mobile' }), { ok: true });
eq('visitors header + 1 row', v.vrows.length, 2);
eq('visitor row', [v.vrows[1][0], v.vrows[1][1], v.vrows[1][7], v.vrows[1][8], v.vrows[1][9], v.vrows[1][10]], [V1, '', 1, 'Planner', 'google.com', 'mobile']);
eq('accounts tab untouched', v.rows.length, 0);
eq('second page same day', v.post({ action: 'visit', vid: V1, page: 'TradeCost.dc.html', device: 'mobile' }), { ok: true, returning: true });
eq('pages listed once each', v.vrows[1][8], 'Planner, Charges');
eq('same day => days stays 1', v.vrows[1][7], 1);
v.vrows[1][6] = new Date(Date.now() - 3 * 86400000);   // last seen 3 days ago
v.post({ action: 'visit', vid: V1, page: 'Workspace.dc.html', device: 'desktop' });
eq('new day => days 2', v.vrows[1][7], 2);
eq('page not repeated', v.vrows[1][8], 'Planner, Charges');
eq('device updated', v.vrows[1][10], 'desktop');
eq('first source kept', v.vrows[1][9], 'google.com');
v.post({ action: 'visit', vid: V2, page: 'evil.html', src: '=IMPORTXML("x")', device: 'toaster' });
eq('unknown page/device dropped, formula source neutralised', [v.vrows[2][8], v.vrows[2][10], v.vrows[2][9]], ['', '', '\'=IMPORTXML("x")']);

eq('lead needs consent', v.post({ action: 'lead', vid: V1, email: 'ravi@example.in', consent: false }), { ok: false });
eq('lead needs a real email', v.post({ action: 'lead', vid: V1, email: 'not-an-email', consent: true }), { ok: false });
eq('lead accepted', v.post({ action: 'lead', vid: V1, email: ' Ravi@Example.in ', name: 'Ravi', consent: true }), { ok: true, returning: true });
eq('lead on same row', [v.vrows.length, v.vrows[1][1], v.vrows[1][2], v.vrows[1][3]], [3, 'ravi@example.in', 'Ravi', 'yes']);
const V3 = 'c'.repeat(32);
eq('lead from an unseen visitor makes a row', v.post({ action: 'lead', vid: V3, email: 'x@y.co', consent: true }), { ok: true });
eq('that row has the email', v.vrows[3][1], 'x@y.co');

eq('sign-in with vid accepted', v.post({ idToken: 'tokA', consent: true, action: 'signup', vid: V2 }), { ok: true });
eq('visitor row linked to account', [v.vrows[2][11], v.vrows[2][1], v.vrows[2][2]], ['uid-asha', 'asha@example.com', 'Asha']);
eq('lead email not overwritten by link', (v.post({ idToken: 'tokA', action: 'signin', vid: V1 }), v.vrows[1][1]), 'ravi@example.in');
eq('delete account removes linked visitor rows', v.post({ idToken: 'tokA', action: 'delete' }), { ok: true, deleted: true });
eq('only unlinked visitor left', v.vrows.map((x) => x[0]), ['Visitor ID', V3]);

const lim = make({});
const V4 = 'd'.repeat(32);
for (let i = 0; i < 40; i++) lim.post({ action: 'visit', vid: V4, page: 'Main.dc.html' });
eq('hourly cap per visitor', lim.post({ action: 'visit', vid: V4, page: 'Main.dc.html' }), { ok: false, limited: true });
eq('IST day boundary', [lim.dayKey(Date.UTC(2026, 0, 1, 18, 29)), lim.dayKey(Date.UTC(2026, 0, 1, 18, 31))], ['2026-01-01', '2026-01-02']);

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
