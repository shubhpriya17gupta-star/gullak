/* Gullak visitor log + "Get new tools by email" card. Loaded by arth-auth.js on every page except Sign in.
   No account needed. Each browser gets a random ID (localStorage "arth.vid", no personal data). One "visit"
   per page per day goes to the "Visitors" tab of the Google Sheet through cfg.endpoint (tools/apps-script/Code.gs).
   Browsers that send Global Privacy Control or Do Not Track are not logged.
   The card shows once, centred over a tool page, after about 10 seconds of use. Closing it (the small x or Esc) hides it for 30 days,
   a sent email hides it for good, and signed-in people never see it. */
(function () {
  'use strict';
  var A = window.ArthAuth, cfg = window.ARTH_AUTH || {};
  if (!A || !cfg.endpoint) return;
  var page = A.page;
  var DAY = 86400000, WAIT = 10, SNOOZE = 30 * DAY;

  function get(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v) { try { localStorage.setItem(k, v); return true; } catch (e) { return false; } }

  var vid = get('arth.vid');
  if (!/^[a-f0-9]{32}$/.test(vid || '')) {
    if (!window.crypto || !crypto.getRandomValues) return;
    var b = new Uint8Array(16); crypto.getRandomValues(b);
    vid = Array.prototype.map.call(b, function (x) { return (x + 256).toString(16).slice(1); }).join('');
    if (!set('arth.vid', vid) || get('arth.vid') !== vid) return;   // no storage: every page would look like a new person
  }

  function send(body) {
    body.vid = vid;
    try {
      // text/plain avoids a CORS preflight; Apps Script reads the body as JSON
      fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', keepalive: true, headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) })
        .catch(function () {});
    } catch (e) {}
  }
  function today() { return new Date(Date.now() + 19800000).toISOString().slice(0, 10); }   // IST date

  function source() {
    var q = new URLSearchParams(location.search), utm = ['utm_source', 'utm_medium', 'utm_campaign'].map(function (k) { return q.get(k) || ''; });
    if (utm[0]) return ('utm: ' + utm.filter(Boolean).join(' / ')).slice(0, 80);
    try {
      var h = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, '') : '';
      if (h && h !== location.hostname.replace(/^www\./, '')) return h;
    } catch (e) {}
    return 'direct';
  }
  function device() {
    var coarse = window.matchMedia && matchMedia('(pointer:coarse)').matches;
    var short = Math.min(screen.width || 0, screen.height || 0);
    return coarse ? (short < 600 ? 'mobile' : 'tablet') : 'desktop';
  }

  /* ---------- visit log: once per page per day ---------- */
  var optOut = navigator.globalPrivacyControl === true || navigator.doNotTrack === '1' || window.doNotTrack === '1';
  if (!optOut) {
    var seen = {}, d = today();
    try { seen = JSON.parse(get('arth.seen') || '{}') || {}; } catch (e) {}
    if (seen[page] !== d) {
      var keep = {};
      Object.keys(seen).forEach(function (k) { if (seen[k] === d) keep[k] = d; });   // forget older days
      keep[page] = d;
      set('arth.seen', JSON.stringify(keep));
      send({ action: 'visit', page: page, src: source(), device: device() });
    }
  }

  /* ---------- "Get new tools by email" card (tool pages only) ---------- */
  function wanted() {
    return !!(A.tools && A.tools[page]) && !A.user() && get('arth.lead') !== 'done' && !(Number(get('arth.leadSnooze')) > Date.now());
  }
  if (!wanted()) return;

  var shown = 0, card = null;
  var tick = setInterval(function () {
    if (document.visibilityState !== 'visible') return;
    if (++shown < WAIT) return;
    clearInterval(tick);
    if (wanted()) show();
  }, 1000);

  var css = '' +
    '.ag-bg{position:fixed;inset:0;z-index:2147482000;display:flex;align-items:center;justify-content:center;padding:16px;background:rgba(17,19,22,.62);-webkit-backdrop-filter:blur(3px);backdrop-filter:blur(3px);animation:ag-fade .25s ease-out}' +
    '.ag-card{position:relative;width:min(460px,100%);max-height:calc(100vh - 32px);overflow-y:auto;box-sizing:border-box;padding:34px 32px 28px;border-radius:20px;background:#FFFFFF;color:#111316;box-shadow:0 30px 80px rgba(0,0,0,.35);font-family:Geist,system-ui,sans-serif;animation:ag-in .35s cubic-bezier(.16,1,.3,1)}' +
    '@keyframes ag-fade{from{opacity:0}to{opacity:1}}@keyframes ag-in{from{opacity:0;transform:translateY(16px) scale(.98)}to{opacity:1;transform:none}}' +
    '@media (prefers-reduced-motion:reduce){.ag-bg,.ag-card{animation:none}}' +
    '.ag-card *{box-sizing:border-box}' +
    '.ag-card h2{margin:0 0 8px;font:400 28px/1.15 "Source Serif 4",Georgia,serif;letter-spacing:-.01em;color:#111316}' +
    '.ag-card p{margin:0 0 22px;font-size:15.5px;line-height:1.55;color:#55595F}' +
    /* close is deliberately quiet, but kept at 3:1 contrast so it can still be found */
    '.ag-x{position:absolute;top:10px;right:10px;width:32px;height:32px;border-radius:8px;border:0;background:transparent;color:#8A8E94;font-size:20px;line-height:1;cursor:pointer;opacity:.85}' +
    '.ag-x:hover{opacity:1;color:#55595F}' +
    '.ag-in{display:block;width:100%;min-height:50px;margin:0 0 12px;padding:0 16px;border-radius:12px;border:1px solid rgba(17,19,22,.22);background:#FFFFFF;color:#111316;font:400 16px Geist,system-ui,sans-serif}' +
    '.ag-in::placeholder{color:#8A8E94}.ag-in:focus{outline:none;border-color:#B8955A;box-shadow:0 0 0 3px rgba(210,180,124,.30)}' +
    '.ag-ok{display:flex;gap:10px;align-items:flex-start;margin:6px 0 20px;font-size:14px;line-height:1.5;color:#3D4146;cursor:pointer}' +
    '.ag-ok input{flex:none;width:18px;height:18px;margin:2px 0 0;accent-color:#111316}' +
    '.ag-err{margin:-8px 0 12px;font-size:14px;color:#B3261E}.ag-err:empty{display:none}' +
    '.ag-b{display:block;width:100%;min-height:52px;padding:0 18px;border-radius:999px;border:0;font:600 16px Geist,system-ui,sans-serif;cursor:pointer;background:#D2B47C;color:#111316}.ag-b:hover{background:#C6A66B}' +
    '.ag-x:focus-visible,.ag-b:focus-visible,.ag-ok input:focus-visible{outline:2px solid #111316;outline-offset:2px}' +
    '@media (max-width:520px){.ag-card{padding:30px 22px 22px}.ag-card h2{font-size:24px}}';

  var bg = null, before = null, overflow = '';
  function close(snooze) {
    if (snooze) set('arth.leadSnooze', String(Date.now() + SNOOZE));
    if (!bg) return;
    bg.remove(); bg = null; card = null;
    document.documentElement.style.overflow = overflow;
    if (before && before.focus && before.isConnected) before.focus();
  }

  function show() {
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    bg = document.createElement('div'); bg.className = 'ag-bg';
    card = document.createElement('div');
    card.className = 'ag-card';
    card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true'); card.setAttribute('aria-labelledby', 'ag-h');
    card.innerHTML =
      '<button type="button" class="ag-x" aria-label="Close">&times;</button>' +
      '<h2 id="ag-h">Get new Gullak tools by email</h2>' +
      '<p>Free, like everything here. No spam, and you can unsubscribe any time.</p>' +
      '<form novalidate>' +
        '<input class="ag-in" name="name" type="text" autocomplete="name" maxlength="60" placeholder="Name (optional)" aria-label="Name (optional)">' +
        '<input class="ag-in" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" placeholder="Email" aria-label="Email" required>' +
        '<label class="ag-ok"><input type="checkbox" name="ok" required><span>Yes, email me about new tools and guides. I can unsubscribe any time.</span></label>' +
        '<div class="ag-err" role="alert"></div>' +
        '<button type="submit" class="ag-b">Keep me posted</button>' +
      '</form>';
    bg.appendChild(card);
    document.body.appendChild(bg);
    before = document.activeElement;
    overflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';        // the page behind does not scroll while it is open

    var f = card.querySelector('form'), err = card.querySelector('.ag-err');
    card.querySelector('.ag-x').addEventListener('click', function () { close(true); });
    f.email.focus({ preventScroll: true });
    card.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') return close(true);
      if (e.key !== 'Tab') return;                              // keep keyboard focus inside the card
      var all = card.querySelectorAll('button, input'), first = all[0], last = all[all.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = f.email.value.trim(), name = f.name.value.trim();
      if (!/^[^\s@<>"']{1,64}@[^\s@<>"']{1,190}\.[a-zA-Z]{2,24}$/.test(email)) { err.textContent = 'Please enter a valid email address.'; f.email.focus(); return; }
      if (!f.ok.checked) { err.textContent = 'Please tick the box so we may email you.'; f.ok.focus(); return; }
      send({ action: 'lead', email: email, name: name, consent: true });
      set('arth.lead', 'done');
      card.innerHTML = '<h2 id="ag-h" style="margin:0">Thanks. You are on the list.</h2>';
      setTimeout(function () { close(false); }, 3000);
    });
  }

  /* someone who signs in while the card is open does not need it */
  A.onChange(function (u) { if (u) { clearInterval(tick); close(false); } });
})();
