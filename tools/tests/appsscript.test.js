// Runs tools/apps-script/Code.gs against small fakes of Sheets, Firebase and the Apps Script services.
const fs = require('fs'), path = require('path');
const src = fs.readFileSync(path.join(__dirname, '../apps-script/Code.gs'), 'utf8');
let fail = 0;
const eq = (n, a, b) => { const ok = JSON.stringify(a) === JSON.stringify(b); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, '| got', JSON.stringify(a), '| want', JSON.stringify(b)); };

function make(opts) {
  const rows = [];                                         // rows[0] is the header once created
  let sheetExists = false;
  const sheetObj = {
    getLastRow: () => rows.length,
    appendRow: (r) => { rows.push(r.slice()); },
    setFrozenRows: () => {},
    getRange: (r, c, nr, nc) => ({
      getValues: () => { const o = []; for (let i = 0; i < (nr || 1); i++) { const row = []; for (let j = 0; j < (nc || 1); j++) row.push(rows[r - 1 + i][c - 1 + j]); o.push(row); } return o; },
      getValue: () => rows[r - 1][c - 1],
      setValue: (v) => { rows[r - 1][c - 1] = v; },
    }),
  };
  const users = opts.users || {};                          // idToken -> firebase user record
  const g = {
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => (sheetExists ? sheetObj : null), insertSheet: () => { sheetExists = true; return sheetObj; } }) },
    LockService: { getScriptLock: () => ({ waitLock() {}, releaseLock() {} }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: () => (opts.noKey ? null : 'KEY123') }) },
    UrlFetchApp: { fetch: (url, o) => { const tok = JSON.parse(o.payload).idToken; const u = users[tok]; return { getResponseCode: () => (u ? 200 : 400), getContentText: () => JSON.stringify(u ? { users: [u] } : { error: {} }) }; } },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (s) => ({ s, setMimeType() { return this; } }) },
  };
  const fn = new Function(...Object.keys(g), src + '\nreturn {doPost,text};');
  const m = fn(...Object.values(g));
  const post = (body) => JSON.parse(m.doPost({ postData: { contents: typeof body === 'string' ? body : JSON.stringify(body) } }).s);
  return { post, rows, text: m.text };
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

const t2 = make({ users: { tokA: asha }, noKey: true });
eq('no FIREBASE_API_KEY property => nothing written', t2.post({ idToken: 'tokA', consent: true }), { ok: false });

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
