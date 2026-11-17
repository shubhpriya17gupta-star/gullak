/* Gullak "Save my results".
   Stores a finished result in the visitor's own account: Firestore users/{uid}/savedResults/{id}.
   Saving is always an explicit click, and the first save explains what is stored.

   Signed out: the result is kept in this browser (localStorage "arth.pending", at most 6 hours)
   while the person signs in or signs up, then saved once when they come back, and the copy removed.
   Nothing here calculates: each page hands over its inputs and the figures it already displayed.
   Load this file without "defer", before support.js, so pages can call it as soon as they mount. */
(function () {
  'use strict';
  var PENDING = 'arth.pending', OK = 'arth.saveok.', MAX_AGE = 6 * 3600 * 1000, TIMEOUT = 15000;
  var TOOLS = {
    planner: { name: 'Planner', page: 'Workspace.dc.html' },
    recovery: { name: 'Break-even calculator', page: 'Recovery.dc.html' },
    tradecost: { name: 'Charges calculator', page: 'TradeCost.dc.html' },
    practice: { name: 'Practice desk', page: 'Practice.dc.html' }
  };
  var MSG = {
    saving: 'Saving your result...',
    saved: 'Your result has been saved to My Gullak.',
    exists: 'This result is already saved in My Gullak.',
    updated: 'Your practice progress has been saved to My Gullak.',
    failed: 'We couldn\'t save your result. Your current results are still available. Please try again.',
    off: 'Saving is not available right now. Your current results are still available.',
    notReady: 'Finish the calculation first, then save it.',
    cancelled: 'You are not signed in, so your result was not saved. It is still here: choose "Save my results" to try again.'
  };

  /* ---------- pure helpers (tested in tools/tests/save.test.js) ---------- */
  function hash(str) {                       // cyrb53: short, stable id for identical results
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0; i < str.length; i++) { var c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  /* copy only the keys the template has, with the template's type; a null in the template accepts a number, string or null */
  function pick(tpl, src) {
    var out = {};
    src = src && typeof src === 'object' ? src : {};
    Object.keys(tpl).forEach(function (k) {
      var t = tpl[k], v = src[k];
      if (t && typeof t === 'object') out[k] = pick(t, v);
      else if (t === null) out[k] = typeof v === 'number' || (typeof v === 'string' && v.length <= 200) ? v : null;
      else if (typeof v === typeof t && (typeof v !== 'string' || v.length <= 200)) out[k] = v;
      else out[k] = t;
    });
    return out;
  }
  function str(v, n) { return String(v == null ? '' : v).slice(0, n); }
  function rows(list) {
    return (Array.isArray(list) ? list : []).slice(0, 40).filter(function (r) { return r && r.k; })
      .map(function (r) { return { k: str(r.k, 80), v: str(r.v, 600) }; });
  }
  /* the exact shape the Firestore rules accept, or null */
  function clean(rec) {
    if (!rec || !TOOLS[rec.tool] || !rec.title || !rec.state || typeof rec.state !== 'object') return null;
    var id = rec.id || rec.tool + '-' + hash(rec.tool + JSON.stringify(rec.state));
    if (!/^[a-z]+-[a-z0-9]{1,40}$/.test(id) || id.indexOf(rec.tool + '-') !== 0) return null;
    return { id: id, tool: rec.tool, title: str(rec.title, 120), summary: str(rec.summary, 300), inputs: rows(rec.inputs), outputs: rows(rec.outputs),
             state: rec.state, methodVersion: str(rec.methodVersion || 'unversioned', 60), v: 1 };
  }
  function fresh(p, now) { return !!(p && p.rec && p.at && now - p.at >= 0 && now - p.at < MAX_AGE); }

  /* ---------- browser storage (never required) ---------- */
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function takePending(tool) {
    var p = lsGet(PENDING);
    if (!p) return null;
    if (!fresh(p, Date.now())) { lsSet(PENDING, null); return null; }   // expired: drop it
    if (p.rec.tool !== tool) return null;
    lsSet(PENDING, null);                                                 // claimed: it can only be used once
    return p;
  }

  /* ---------- account and database ---------- */
  function authApi() {
    return new Promise(function (res) {
      if (window.ArthAuth) return res(window.ArthAuth);
      if (document.readyState !== 'loading') return setTimeout(function () { res(window.ArthAuth || null); }, 0);
      document.addEventListener('DOMContentLoaded', function () { res(window.ArthAuth || null); });
    });
  }
  function signedIn() { return authApi().then(function (A) { return A ? A.ready.then(function () { return A.configured() ? A.user() : null; }) : null; }); }
  var dbP = null;
  function db() {
    if (!dbP) dbP = authApi().then(function (A) {
      if (!A) throw codeErr('arth/not-configured');
      return A.firebase();
    }).then(function (fb) {
      return import(fb.sdk + 'firebase-firestore.js').then(function (m) { return { m: m, db: m.getFirestore(fb.app), auth: fb.auth }; });
    });
    dbP.catch(function () { dbP = null; });
    return dbP;
  }
  function codeErr(c) { var e = new Error(c); e.code = c; return e; }
  function withTimeout(p) { return Promise.race([p, new Promise(function (_, rej) { setTimeout(function () { rej(codeErr('arth/timeout')); }, TIMEOUT); })]); }
  function mine(x) { var u = x.auth.currentUser; if (!u) throw codeErr('arth/signed-out'); return u.uid; }
  function col(x) { return x.m.collection(x.db, 'users', mine(x), 'savedResults'); }

  /* create, or (practice progress only) update; never a second copy of the same result */
  function write(rec) {
    return withTimeout(db().then(function (x) {
      var m = x.m, ref = m.doc(col(x), rec.id);
      return m.getDoc(ref).then(function (snap) {
        if (snap.exists()) {
          if (rec.tool !== 'practice') return 'exists';
          return m.updateDoc(ref, { title: rec.title, summary: rec.summary, inputs: rec.inputs, outputs: rec.outputs, state: rec.state, methodVersion: rec.methodVersion, updatedAt: m.serverTimestamp() }).then(function () { return 'updated'; });
        }
        var data = Object.assign({}, rec, { createdAt: m.serverTimestamp(), updatedAt: m.serverTimestamp() });
        return m.setDoc(ref, data).then(function () { return rec.tool === 'practice' ? 'updated' : 'saved'; });
      });
    }));
  }

  /* ---------- small UI: one status line and one dialog, in Gullak's colours ---------- */
  var css = '' +
    '.as-toast{position:fixed;left:50%;bottom:20px;transform:translateX(-50%);z-index:2147483002;width:min(560px,calc(100vw - 32px));display:flex;gap:14px;align-items:center;justify-content:space-between;' +
      'background:#111316;color:#F4F1EA;border:1px solid rgba(210,180,124,.45);border-radius:14px;padding:14px 16px;font:500 15px/1.45 Geist,system-ui,sans-serif;box-shadow:0 18px 40px rgba(0,0,0,.28)}' +
    '.as-toast[hidden]{display:none}.as-toast.err{border-color:#E58B7E}.as-toast a{color:#D2B47C;white-space:nowrap;font-weight:600}' +
    '.as-toast button{flex:none;background:transparent;border:0;color:#B0B3B8;font-size:20px;line-height:1;cursor:pointer;padding:4px 6px;border-radius:8px}' +
    '.as-dlg{width:min(460px,calc(100vw - 32px));border:1px solid rgba(244,241,234,.14);border-radius:18px;padding:26px;background:#191B1F;color:#F4F1EA;font-family:Geist,system-ui,sans-serif}' +
    '.as-dlg::backdrop{background:rgba(10,11,13,.6)}' +
    '.as-dlg h2{margin:0 0 10px;font:400 26px/1.15 "Source Serif 4",Georgia,serif;letter-spacing:-.01em}' +
    '.as-dlg p{margin:0 0 12px;color:#B0B3B8;font-size:15px;line-height:1.55}.as-dlg p strong{color:#F4F1EA;font-weight:500}' +
    '.as-dlg .as-row{display:flex;flex-direction:column;gap:10px;margin-top:18px}' +
    '.as-dlg .as-b{min-height:48px;border-radius:999px;font:600 15px Geist,system-ui,sans-serif;cursor:pointer;border:1px solid rgba(244,241,234,.28);background:transparent;color:#F4F1EA}' +
    '.as-dlg .as-b:hover{border-color:#D2B47C}.as-dlg .as-gold{background:#D2B47C;color:#111316;border-color:#D2B47C}.as-dlg .as-gold:hover{background:#E2C894}' +
    '.as-dlg .as-q{border:0;color:#B0B3B8;font-weight:500;min-height:40px}' +
    '.as-dlg .as-b:focus-visible,.as-toast button:focus-visible,.as-toast a:focus-visible{outline:2px solid #D2B47C;outline-offset:2px}';
  var toastEl = null, toastTimer = 0;
  function ui() {
    if (toastEl) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);
    toastEl = document.createElement('div'); toastEl.className = 'as-toast'; toastEl.hidden = true;
    toastEl.setAttribute('role', 'status'); toastEl.setAttribute('aria-live', 'polite');
    document.body.appendChild(toastEl);
  }
  function toast(text, opt) {
    ui(); opt = opt || {};
    clearTimeout(toastTimer);
    toastEl.className = 'as-toast' + (opt.err ? ' err' : '');
    toastEl.innerHTML = '';
    var span = document.createElement('span'); span.textContent = text; toastEl.appendChild(span);
    if (opt.link) { var a = document.createElement('a'); a.href = 'MyGullak.html'; a.textContent = 'Open My Gullak'; toastEl.appendChild(a); }
    var x = document.createElement('button'); x.type = 'button'; x.setAttribute('aria-label', 'Close message'); x.innerHTML = '&times;';
    x.addEventListener('click', function () { toastEl.hidden = true; }); toastEl.appendChild(x);
    toastEl.hidden = false;
    if (!opt.stay) toastTimer = setTimeout(function () { toastEl.hidden = true; }, opt.err ? 12000 : 8000);
  }
  /* buttons: [{ label, value, kind: 'gold'|'line'|'quiet' }]; resolves with the chosen value, or null */
  function ask(title, paras, buttons) {
    ui();
    return new Promise(function (resolve) {
      var d = document.createElement('dialog'); d.className = 'as-dlg';
      d.setAttribute('aria-labelledby', 'as-h');
      var h = '<h2 id="as-h"></h2>' + paras.map(function () { return '<p></p>'; }).join('') + '<div class="as-row"></div>';
      d.innerHTML = h;
      d.querySelector('h2').textContent = title;
      var ps = d.querySelectorAll('p');
      paras.forEach(function (t, i) { ps[i].textContent = t; });
      var row = d.querySelector('.as-row'), done = false;
      function finish(v) { if (done) return; done = true; try { d.close(); } catch (e) {} d.remove(); resolve(v); }
      buttons.forEach(function (b) {
        var el = document.createElement('button'); el.type = 'button';
        el.className = 'as-b' + (b.kind === 'gold' ? ' as-gold' : b.kind === 'quiet' ? ' as-q' : '');
        el.textContent = b.label; el.addEventListener('click', function () { finish(b.value); });
        row.appendChild(el);
      });
      d.addEventListener('cancel', function () { finish(null); });
      document.body.appendChild(d);
      if (d.showModal) d.showModal(); else { finish(window.confirm(title + '\n\n' + paras.join('\n\n')) ? buttons[0].value : null); }
    });
  }
  var NOTICE = 'Your result will be saved securely to your Gullak account so you can revisit it later.';
  var WHAT = 'We store the figures you entered on this page and the results shown, with the date. Nothing else. Only you can see them, and you can delete them at any time from My Gullak.';
  var WHAT_P = 'We store this browser\'s practice-desk progress (simulated account, orders and practice money), with the date. Nothing else. Only you can see it, and you can delete it at any time from My Gullak.';

  /* ---------- the save button ---------- */
  var busy = false;
  function save(raw) {
    if (busy) return Promise.resolve('busy');                     // repeated clicks while saving
    var rec = clean(raw);
    if (!rec) { toast(MSG.notReady, { err: true }); return Promise.resolve('invalid'); }
    busy = true;
    return authApi().then(function (A) {
      if (!A || !A.configured()) { toast(MSG.off, { err: true }); return 'off'; }
      return A.ready.then(function () {
        var u = A.user(), what = rec.tool === 'practice' ? WHAT_P : WHAT;
        if (!u) {
          return ask(rec.tool === 'practice' ? 'Save your practice progress' : 'Save your results',
            ['Create a free account to save your results. ' + NOTICE, what],
            [{ label: 'Create a free account', value: 'signup', kind: 'gold' }, { label: 'I already have an account', value: 'signin' }, { label: 'Not now', value: null, kind: 'quiet' }]
          ).then(function (choice) {
            if (!choice) return 'cancelled';
            lsSet(PENDING, { at: Date.now(), rec: rec, consent: true });
            location.href = 'SignIn.html?' + (choice === 'signup' ? 'mode=signup&' : '') + 'save=1&next=' + encodeURIComponent(TOOLS[rec.tool].page);
            return 'redirect';
          });
        }
        if (lsGet(OK + u.uid)) return store(rec);
        return ask('Save to My Gullak?', [NOTICE, what],
          [{ label: rec.tool === 'practice' ? 'Save my progress' : 'Save my result', value: 'yes', kind: 'gold' }, { label: 'Cancel', value: null, kind: 'quiet' }]
        ).then(function (yes) {
          if (!yes) return 'cancelled';
          lsSet(OK + u.uid, 1);
          return store(rec);
        });
      });
    }).then(function (r) { busy = false; return r; }, function (e) { busy = false; throw e; });
  }
  function store(rec) {
    toast(MSG.saving, { stay: true });
    return write(rec).then(function (r) {
      toast(r === 'exists' ? MSG.exists : r === 'updated' ? MSG.updated : MSG.saved, { link: true });
      return r;
    }, function (e) {
      console.warn('Gullak: save failed', e && (e.code || e.message));   // no inputs, tokens or passwords are logged
      toast(MSG.failed, { err: true });
      return 'failed';
    });
  }

  /* ---------- on page load: finish a pending save, or open a saved result ----------
     restore(state, record) puts the inputs back on the page; it is called before saving, so the
     results are visible even if the save then fails. opt.confirmOpen: ask before replacing local data. */
  function resume(tool, restore, opt) {
    opt = opt || {};
    var q = new URLSearchParams(location.search), openId = q.get('open');
    if (openId) {
      try { q.delete('open'); history.replaceState(null, '', location.pathname + (q.toString() ? '?' + q : '') + location.hash); } catch (e) {}
      return signedIn().then(function (u) {
        if (!u) { toast('Sign in to open your saved results.', { err: true }); return; }
        return get(openId).then(function (doc) {
          if (!doc || doc.tool !== tool) { toast('That saved result could not be found. It may have been deleted.', { err: true }); return; }
          var go = opt.confirmOpen ? ask(opt.confirmOpen.title, opt.confirmOpen.paras, [{ label: opt.confirmOpen.yes, value: 1, kind: 'gold' }, { label: 'Cancel', value: null, kind: 'quiet' }]) : Promise.resolve(1);
          return go.then(function (yes) { if (yes) { restore(doc.state, doc); toast('Showing your saved result from My Gullak.'); } });
        }, function (e) { console.warn('Gullak: could not open saved result', e && (e.code || e.message)); toast('We couldn\'t open that saved result. Please try again.', { err: true }); });
      });
    }
    var p = takePending(tool);
    if (!p) return Promise.resolve();
    if (restore && tool !== 'practice') restore(p.rec.state, p.rec);
    return signedIn().then(function (u) {
      if (!u) { toast(MSG.cancelled, { err: true }); return; }
      if (p.consent) lsSet(OK + u.uid, 1);
      busy = true;
      return store(p.rec).then(function (r) { busy = false; return r; });
    });
  }

  /* ---------- My Gullak ---------- */
  function list() {
    return withTimeout(db().then(function (x) {
      return x.m.getDocs(col(x)).then(function (qs) {
        var out = []; qs.forEach(function (d) { out.push(norm(d.data())); });
        out.sort(function (a, b) { return b.time - a.time; });
        return out;
      });
    }));
  }
  function norm(d) {
    var ts = d.updatedAt || d.createdAt;
    d.time = ts && ts.toMillis ? ts.toMillis() : 0;
    d.created = d.createdAt && d.createdAt.toMillis ? d.createdAt.toMillis() : d.time;
    return d;
  }
  function get(id) {
    if (!/^[a-z]+-[a-z0-9]{1,40}$/.test(id || '')) return Promise.resolve(null);
    return withTimeout(db().then(function (x) { return x.m.getDoc(x.m.doc(col(x), id)).then(function (s) { return s.exists() ? norm(s.data()) : null; }); }));
  }
  function remove(id) { return withTimeout(db().then(function (x) { return x.m.deleteDoc(x.m.doc(col(x), id)); })); }
  function removeAll() {
    return withTimeout(db().then(function (x) {
      return x.m.getDocs(col(x)).then(function (qs) {
        var b = x.m.writeBatch(x.db), n = 0;
        qs.forEach(function (d) { b.delete(d.ref); n++; });
        return n ? b.commit().then(function () { return n; }) : 0;
      });
    }));
  }

  window.ArthSave = { tools: TOOLS, save: save, resume: resume, pick: pick, list: list, get: get, remove: remove, removeAll: removeAll, ask: ask, toast: toast,
                      _t: { hash: hash, pick: pick, clean: clean, fresh: fresh, MAX_AGE: MAX_AGE } };
})();
