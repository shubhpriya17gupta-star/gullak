/**
 * Gullak accounts -> Google Sheet.
 * Paste this whole file into Extensions > Apps Script of the Sheet. Setup: docs/SETUP-signup.md
 *
 * The page sends a Firebase ID token. This script asks Firebase who the token belongs to,
 * so only real, signed-in people can add rows and nobody can post made-up emails.
 * One row per person (matched by their Firebase UID); signing in again updates "Last seen" and "Visits".
 * action "delete" (sent by Delete my account, with that person's own token) removes their row.
 *
 * Visitors tab (no sign-in needed): every browser gets a random visitor ID. action "visit" keeps one
 * row per visitor (first/last seen, days active, pages used, first source, device). action "lead"
 * adds the name and email someone typed into the "Get new tools by email" card, with their consent.
 * A sign-in that carries a visitor ID links that row to the account UID.
 *
 * One-time: Project Settings (gear) > Script properties > add  FIREBASE_API_KEY = your Firebase web apiKey.
 */
const SHEET = 'Accounts';
const HEAD = ['UID', 'Email', 'Name', 'Sign-in method', 'Email verified', 'First seen', 'Last seen', 'Visits', 'Consent', 'Source page'];
const COL = { UID: 1, EMAIL: 2, NAME: 3, METHOD: 4, VERIFIED: 5, FIRST: 6, LAST: 7, VISITS: 8, CONSENT: 9, SOURCE: 10 };

function doPost(e) {
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ ok: false }); }
  if (!d || typeof d !== 'object') return out({ ok: false });
  if (d.action === 'visit' || d.action === 'lead') return visitor(d);
  const u = verify(String(d.idToken || ''));
  if (!u) return out({ ok: false });

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = sheet();
    const now = new Date();
    const email = String(u.email || '').toLowerCase();
    const name = text(u.displayName || '', 60);
    const method = (u.providerUserInfo || []).map(function (p) { return p.providerId; }).join(', ') || 'unknown';
    const source = text(d.source || '', 60);
    const consent = d.consent === true;

    const last = sh.getLastRow();
    const uids = last > 1 ? sh.getRange(2, COL.UID, last - 1, 1).getValues() : [];
    if (d.action === 'delete') {                            // "Delete my account" in My Gullak: remove this person's row only
      for (let i = uids.length - 1; i >= 0; i--) if (uids[i][0] === u.localId) sh.deleteRow(i + 2);
      unlinkVisitors(u.localId);
      return out({ ok: true, deleted: true });
    }
    linkVisitor(d.vid, u.localId, email, name);
    for (let i = 0; i < uids.length; i++) {
      if (uids[i][0] === u.localId) {                       // returning person
        const r = i + 2;
        sh.getRange(r, COL.EMAIL).setValue(text(email, 254));
        if (name) sh.getRange(r, COL.NAME).setValue(name);
        sh.getRange(r, COL.METHOD).setValue(method);
        sh.getRange(r, COL.VERIFIED).setValue(u.emailVerified ? 'yes' : 'no');
        sh.getRange(r, COL.LAST).setValue(now);
        sh.getRange(r, COL.VISITS).setValue((Number(sh.getRange(r, COL.VISITS).getValue()) || 1) + 1);
        if (consent) sh.getRange(r, COL.CONSENT).setValue('yes');
        return out({ ok: true, returning: true });
      }
    }
    sh.appendRow([u.localId, text(email, 254), name, method, u.emailVerified ? 'yes' : 'no', now, now, 1, consent ? 'yes' : 'no', source]);
    return out({ ok: true });
  } finally {
    lock.releaseLock();
  }
}

/* ---------------- Visitors (anonymous, no sign-in) ---------------- */
const VSHEET = 'Visitors';
const VHEAD = ['Visitor ID', 'Email', 'Name', 'Updates consent', 'Email given on', 'First seen', 'Last seen', 'Days active', 'Pages used', 'First source', 'Device', 'Account UID'];
const V = { ID: 1, EMAIL: 2, NAME: 3, CONSENT: 4, LEAD: 5, FIRST: 6, LAST: 7, DAYS: 8, PAGES: 9, SOURCE: 10, DEVICE: 11, UID: 12 };
const PAGES = { 'Main.dc.html': 'Home', 'Workspace.dc.html': 'Planner', 'Recovery.dc.html': 'Break-even', 'TradeCost.dc.html': 'Charges',
  'Candlesticks.dc.html': 'Candlesticks', 'Practice.dc.html': 'Practice desk', 'Methodology.html': 'Methodology', 'Glossary.html': 'Glossary', 'MyGullak.html': 'My Gullak' };
const DEVICES = ['mobile', 'tablet', 'desktop'];
const EMAIL_RE = /^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-zA-Z]{2,24}$/;

function okVid(v) { return typeof v === 'string' && /^[a-f0-9]{32}$/.test(v); }
/** Calendar day in India, so "Days active" counts IST days. */
function dayKey(t) { return new Date(new Date(t).getTime() + 5.5 * 3600000).toISOString().slice(0, 10); }

/** Anyone can post here, so: strict visitor ID, fixed page names, short text, and a per-visitor hourly cap. */
function visitor(d) {
  if (!okVid(d.vid)) return out({ ok: false });
  const cache = CacheService.getScriptCache();
  const ck = d.action.charAt(0) + ':' + d.vid, n = Number(cache.get(ck)) || 0;   // visits and leads have separate caps
  if (n >= (d.action === 'lead' ? 5 : 40)) return out({ ok: false, limited: true });
  cache.put(ck, String(n + 1), 3600);

  let email = '', name = '';
  if (d.action === 'lead') {
    email = String(d.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email) || d.consent !== true) return out({ ok: false });
    name = text(d.name || '', 60);
  }

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sh = vsheet(), now = new Date();
    const r = findRow(sh, d.vid);
    const page = PAGES[d.page] || '';
    if (!r) {
      sh.appendRow([d.vid, email ? text(email, 254) : '', name, email ? 'yes' : '', email ? now : '', now, now, 1, page,
        text(d.src || 'direct', 80), DEVICES.indexOf(d.device) >= 0 ? d.device : '', '']);
      return out({ ok: true });
    }
    if (d.action === 'lead') {
      sh.getRange(r, V.EMAIL).setValue(text(email, 254));
      if (name) sh.getRange(r, V.NAME).setValue(name);
      sh.getRange(r, V.CONSENT).setValue('yes');
      sh.getRange(r, V.LEAD).setValue(now);
      return out({ ok: true, returning: true });
    }
    const last = sh.getRange(r, V.LAST).getValue();
    if (!last || dayKey(last) !== dayKey(now)) sh.getRange(r, V.DAYS).setValue((Number(sh.getRange(r, V.DAYS).getValue()) || 0) + 1);
    sh.getRange(r, V.LAST).setValue(now);
    if (page) {
      const used = String(sh.getRange(r, V.PAGES).getValue() || '');
      if (used.split(', ').indexOf(page) < 0) sh.getRange(r, V.PAGES).setValue(used ? used + ', ' + page : page);
    }
    if (DEVICES.indexOf(d.device) >= 0) sh.getRange(r, V.DEVICE).setValue(d.device);
    return out({ ok: true, returning: true });
  } finally {
    lock.releaseLock();
  }
}

/** Called inside the accounts lock: a signed-in person's visitor row gets their UID, and their email/name if it had none. */
function linkVisitor(vid, uid, email, name) {
  if (!okVid(vid)) return;
  const sh = vsheet(), r = findRow(sh, vid);
  if (!r) return;
  sh.getRange(r, V.UID).setValue(uid);
  if (!sh.getRange(r, V.EMAIL).getValue()) sh.getRange(r, V.EMAIL).setValue(text(email, 254));
  if (name && !sh.getRange(r, V.NAME).getValue()) sh.getRange(r, V.NAME).setValue(name);
}

/** Delete my account: the visitor rows linked to that account go too. */
function unlinkVisitors(uid) {
  const sh = vsheet(), last = sh.getLastRow();
  if (last < 2) return;
  const ids = sh.getRange(2, V.UID, last - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) if (ids[i][0] === uid) sh.deleteRow(i + 2);
}

function findRow(sh, vid) {
  const last = sh.getLastRow();
  if (last < 2) return 0;
  const ids = sh.getRange(2, V.ID, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) if (ids[i][0] === vid) return i + 2;
  return 0;
}

function vsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(VSHEET) || ss.insertSheet(VSHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(VHEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Ask Firebase who this ID token belongs to. Returns the user record, or null if the token is not valid. */
function verify(idToken) {
  if (!idToken || idToken.length > 4000) return null;
  const key = PropertiesService.getScriptProperties().getProperty('FIREBASE_API_KEY');
  if (!key) return null;
  const res = UrlFetchApp.fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + encodeURIComponent(key), {
    method: 'post', contentType: 'application/json', payload: JSON.stringify({ idToken: idToken }), muteHttpExceptions: true
  });
  if (res.getResponseCode() !== 200) return null;
  const users = JSON.parse(res.getContentText()).users;
  return users && users[0] && users[0].localId ? users[0] : null;
}

function sheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEAD);
    sh.setFrozenRows(1);
  }
  return sh;
}

/** Limit length and stop spreadsheet formulas: a cell starting with = + - @ would be run by Sheets. */
function text(s, max) {
  s = String(s || '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
