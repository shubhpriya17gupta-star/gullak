/**
 * Gullak accounts -> Google Sheet.
 * Paste this whole file into Extensions > Apps Script of the Sheet. Setup: docs/SETUP-signup.md
 *
 * The page sends a Firebase ID token. This script asks Firebase who the token belongs to,
 * so only real, signed-in people can add rows and nobody can post made-up emails.
 * One row per person (matched by their Firebase UID); signing in again updates "Last seen" and "Visits".
 *
 * One-time: Project Settings (gear) > Script properties > add  FIREBASE_API_KEY = your Firebase web apiKey.
 */
const SHEET = 'Accounts';
const HEAD = ['UID', 'Email', 'Name', 'Sign-in method', 'Email verified', 'First seen', 'Last seen', 'Visits', 'Consent', 'Source page'];
const COL = { UID: 1, EMAIL: 2, NAME: 3, METHOD: 4, VERIFIED: 5, FIRST: 6, LAST: 7, VISITS: 8, CONSENT: 9, SOURCE: 10 };

function doPost(e) {
  let d;
  try { d = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (err) { return out({ ok: false }); }
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
