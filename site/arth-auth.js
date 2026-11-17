/* Gullak accounts: Firebase email+password and Google sign-in (offered only when saving a result), left sidebar,
   and (optionally) a gate. Every sign-up or sign-in is also sent to Google Sheets through
   Apps Script (cfg.endpoint). Settings live in auth-config.js. Setup: docs/SETUP-signup.md.

   window.ArthAuth is the small API the Sign in page uses. A display-only copy of the user
   (name, email) is cached in localStorage key "arth.user" so the header does not flicker;
   Firebase remains the source of truth and is never replaced by this cache. */
(function () {
  'use strict';
  var cfg = window.ARTH_AUTH || {};
  var fb = cfg.firebase || {};
  var configured = !!(fb.apiKey && fb.authDomain && fb.projectId && fb.appId);
  var SDK = 'https://www.gstatic.com/firebasejs/10.12.2/';
  var KEY = 'arth.user';
  /* Netlify serves "Workspace.dc.html" as "/workspace.dc" (no .html, lower case), so match the address to the real file name */
  var FILES = ['Main.dc.html', 'Workspace.dc.html', 'Recovery.dc.html', 'TradeCost.dc.html', 'Candlesticks.dc.html', 'Practice.dc.html', 'Methodology.html', 'SignIn.html', 'MyGullak.html'];
  var rawPage = location.pathname.split('/').pop();
  var keyPage = rawPage.toLowerCase().replace(/\.html$/, '');
  var page = FILES.filter(function (f) { return f.toLowerCase().replace(/\.html$/, '') === keyPage; })[0] || rawPage || 'Main.dc.html';
  var here = page + location.search;
  var onSignIn = /SignIn\.html$/i.test(page);

  var current = null;
  try { current = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) {}
  if (current && !current.uid) current = null;               // an old email-only entry is not a real account
  var listeners = [];
  var mods = null, auth = null, app = null;

  function slim(u) { return u ? { uid: u.uid, name: u.displayName || '', email: u.email || '', verified: !!u.emailVerified } : null; }
  function store(u) { try { if (u) localStorage.setItem(KEY, JSON.stringify(u)); else localStorage.removeItem(KEY); } catch (e) {} }
  function emit() { listeners.forEach(function (fn) { try { fn(current); } catch (e) {} }); }

  /* ---------- gate (runs before anything else) ----------
     The home page, methodology and sign-in pages stay public. The tools need an account. */
  var TOOLS = { 'Workspace.dc.html': 'the Planner', 'Recovery.dc.html': 'the break-even calculator', 'TradeCost.dc.html': 'the charges calculator',
                'Candlesticks.dc.html': 'the candlestick lab', 'Practice.dc.html': 'the practice desk' };
  var gated = !!(cfg.gate && TOOLS[page]);
  function toSignIn() { location.replace('SignIn.html?next=' + encodeURIComponent(here)); }
  // the gate only applies once accounts are configured, so a missing Firebase setup can never lock everyone out
  if (gated && configured && !current) { toSignIn(); return; }

  /* ---------- Firebase ---------- */
  var ready = !configured ? Promise.resolve(current) :
    Promise.all([import(SDK + 'firebase-app.js'), import(SDK + 'firebase-auth.js')]).then(function (m) {
      mods = { app: m[0], auth: m[1] };
      app = mods.app.initializeApp({ apiKey: fb.apiKey, authDomain: fb.authDomain, projectId: fb.projectId, appId: fb.appId });
      auth = mods.auth.getAuth(app);
      return new Promise(function (resolve) {
        var first = true;
        mods.auth.onAuthStateChanged(auth, function (u) {
          current = slim(u); store(current); emit();
          if (gated && !current) toSignIn();
          if (first) { first = false; resolve(current); }
        });
      });
    }).catch(function (e) {
      console.warn('Gullak: could not load Firebase, so sign-in is unavailable right now.', e);
      configured = false;
      return current;
    });

  /* send the verified identity to the Google Sheet. The server checks the token with Firebase, so
     the sheet cannot be filled with made-up rows. A failure here never blocks the person. */
  /* the anonymous visitor ID from arth-track.js, so the Visitors row is linked to this account */
  function vid() { try { var v = localStorage.getItem('arth.vid'); return /^[a-f0-9]{32}$/.test(v || '') ? v : ''; } catch (e) { return ''; } }
  function sync(user, action, consent) {
    if (!cfg.endpoint || !user) return Promise.resolve();
    return user.getIdToken().then(function (tok) {
      // text/plain avoids a CORS preflight; Apps Script reads the body as JSON
      return fetch(cfg.endpoint, { method: 'POST', mode: 'no-cors', headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify({ idToken: tok, action: action, consent: !!consent, source: page.slice(0, 60), vid: vid() }) });
    }).catch(function (e) { console.warn('Gullak: could not reach the sign-up sheet.', e); });
  }
  function need() {
    return ready.then(function () {
      if (!configured || !auth) { var e = new Error('not configured'); e.code = 'arth/not-configured'; throw e; }
    });
  }
  function finish(user, action, consent) {
    current = slim(user); store(current); emit();
    return sync(user, action, consent).then(function () { return current; });
  }

  window.ArthAuth = {
    configured: function () { return configured; },
    tools: TOOLS,
    page: page,
    ready: ready,
    user: function () { return current; },
    onChange: function (fn) { listeners.push(fn); },
    signUp: function (name, email, password, consent) {
      return need().then(function () { return mods.auth.createUserWithEmailAndPassword(auth, email, password); }).then(function (cred) {
        var u = cred.user;
        return mods.auth.updateProfile(u, { displayName: name }).catch(function () {}).then(function () {
          mods.auth.sendEmailVerification(u).catch(function () {});
          return finish(u, 'signup', consent);
        });
      });
    },
    signIn: function (email, password) {
      return need().then(function () { return mods.auth.signInWithEmailAndPassword(auth, email, password); }).then(function (cred) { return finish(cred.user, 'signin', false); });
    },
    /* allowNew=false (Sign in tab): a Google account with no Gullak account yet is removed again,
       because it has not given consent. Use the Sign up tab to create it. */
    google: function (allowNew) {
      return need().then(function () { return mods.auth.signInWithPopup(auth, new mods.auth.GoogleAuthProvider()); }).then(function (cred) {
        var info = mods.auth.getAdditionalUserInfo(cred);
        var isNew = !!(info && info.isNewUser);
        if (isNew && !allowNew) {
          return cred.user.delete().catch(function () {}).then(function () { var e = new Error('no account'); e.code = 'arth/no-account'; throw e; });
        }
        return finish(cred.user, isNew ? 'signup' : 'signin', isNew && allowNew);
      });
    },
    reset: function (email) {
      return need().then(function () { return mods.auth.sendPasswordResetEmail(auth, email); });
    },
    /* for arth-save.js: the same Firebase app, so saved results use this sign-in */
    firebase: function () {
      return need().then(function () { return { app: app, auth: auth, sdk: SDK }; });
    },
    /* My Gullak > Delete my account. The caller deletes saved results first. The Sheet row is removed
       (while the token is still valid), then the Firebase account. Firebase may ask for a fresh sign-in. */
    deleteAccount: function () {
      return need().then(function () {
        var u = auth.currentUser;
        if (!u) { var e = new Error('signed out'); e.code = 'arth/signed-out'; throw e; }
        return sync(u, 'delete', false).then(function () { return u.delete(); }).then(function () { current = null; store(null); emit(); });
      });
    },
    signOut: function () {
      return ready.then(function () {
        current = null; store(null);
        var done = auth ? mods.auth.signOut(auth).catch(function () {}) : Promise.resolve();
        return done.then(function () { emit(); });
      });
    },
    friendly: function (e) {
      var c = e && e.code || '';
      var map = {
        'arth/not-configured': 'Sign-in is not switched on yet. Please try again later.',
        'arth/no-account': 'There is no Gullak account for that Google login yet. Choose Sign up, tick the box, then continue with Google.',
        'auth/invalid-email': 'That email address does not look right.',
        'auth/email-already-in-use': 'An account with this email already exists. Try signing in instead.',
        'auth/weak-password': 'Choose a stronger password, at least 8 characters.',
        'auth/user-not-found': 'Email or password is not correct.',
        'auth/wrong-password': 'Email or password is not correct.',
        'auth/invalid-credential': 'Email or password is not correct.',
        'auth/invalid-login-credentials': 'Email or password is not correct.',
        'auth/too-many-requests': 'Too many attempts. Please wait a few minutes, or reset your password.',
        'auth/network-request-failed': 'Could not reach the server. Check your internet and try again.',
        'auth/popup-blocked': 'Your browser blocked the Google pop-up. Allow pop-ups for this site and try again.',
        'auth/popup-closed-by-user': 'The Google window was closed before finishing.',
        'auth/cancelled-popup-request': 'The Google window was closed before finishing.',
        'auth/unauthorized-domain': 'This website address is not approved for sign-in yet. The site owner needs to add it in Firebase.',
        'auth/operation-not-allowed': 'This sign-in method is not switched on yet. The site owner needs to enable it in Firebase.',
        'auth/user-disabled': 'This account has been disabled.',
        'auth/requires-recent-login': 'For your safety, please sign out, sign in again, then choose Delete my account once more.'
      };
      return map[c] || 'Something went wrong. Please try again.';
    }
  };

  if (onSignIn) return;

  /* anonymous visitor log + "Get new tools by email" card */
  (function () { var s = document.createElement('script'); s.src = './arth-track.js'; s.async = true; document.head.appendChild(s); })();

  /* ---------- header buttons + left sidebar ---------- */
  var PAGES = [
    ['Home', 'Main.dc.html'], ['Planner', 'Workspace.dc.html'], ['Break-even calculator', 'Recovery.dc.html'],
    ['Charges calculator', 'TradeCost.dc.html'], ['Candlestick lab', 'Candlesticks.dc.html'], ['Practice desk', 'Practice.dc.html'],
    ['Methodology', 'Methodology.html']
  ];
  var MORE = [['Sources and data', 'Main.dc.html#sources'], ['Disclaimers', 'Main.dc.html#disclaimers']];

  var css = '' +
    '.ax-wrap{display:flex;align-items:center;gap:12px;flex:none}' +
    '@media (max-width:1000px){header.hd nav,.nav .nav-links{display:none!important}}' +   /* narrow screens: every page is in the side menu, so the cramped link row goes */
    '.ax-tg{flex:none;width:42px;height:42px;display:inline-flex;align-items:center;justify-content:center;border-radius:12px;border:0;background:transparent;color:#F4F1EA;cursor:pointer;padding:0}' +
    '.ax-tg:hover{background:rgba(244,241,234,.08)}' +
    '.ax-tg i{display:block;width:18px;height:1.6px;background:currentColor;border-radius:2px;position:relative}' +
    '.ax-tg i::before,.ax-tg i::after{content:"";position:absolute;left:0;width:18px;height:1.6px;background:currentColor;border-radius:2px}' +
    '.ax-tg i::before{top:-6px}.ax-tg i::after{top:6px}' +
    '.ax-ah{display:flex;align-items:center;gap:10px;flex:none}' +
    '.ax-b{display:inline-flex;align-items:center;justify-content:center;min-height:42px;padding:0 17px;border-radius:999px;font:500 14.5px Geist,system-ui,sans-serif;text-decoration:none;white-space:nowrap;cursor:pointer;border:1px solid transparent}' +
    '.ax-b-line{color:#F4F1EA;border-color:rgba(244,241,234,.32);background:transparent}.ax-b-line:hover{border-color:#D2B47C}' +
    '.ax-b-gold{color:#111316;background:#D2B47C}.ax-b-gold:hover{background:#E2C894}' +
    '.ax-me{display:inline-flex;align-items:center;gap:10px;min-height:42px;padding:0 14px 0 6px;border-radius:999px;border:1px solid rgba(244,241,234,.28);background:transparent;color:#F4F1EA;font:500 14.5px Geist,system-ui,sans-serif;cursor:pointer;max-width:200px}' +
    '.ax-me:hover{border-color:#D2B47C}.ax-me span:last-child{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ax-av{flex:none;width:30px;height:30px;border-radius:50%;background:#D2B47C;color:#111316;display:inline-flex;align-items:center;justify-content:center;font:600 14px Geist,system-ui,sans-serif;text-transform:uppercase}' +
    '.ax-sb{position:fixed;top:0;left:0;bottom:0;z-index:2147483001;width:min(300px,78vw);display:flex;flex-direction:column;background:#111316;color:#F4F1EA;transform:translateX(-102%);visibility:hidden;transition:transform .3s cubic-bezier(.16,1,.3,1),visibility 0s .3s;font-family:Geist,system-ui,sans-serif}' +
    '.ax-sb.on{transform:none;visibility:visible;transition:transform .3s cubic-bezier(.16,1,.3,1),visibility 0s}' +
    '.ax-sh{display:flex;align-items:center;justify-content:space-between;padding:16px 18px 8px}' +
    '.ax-sh a{display:inline-flex;align-items:center;gap:10px;color:#F4F1EA;text-decoration:none;font:400 22px "Source Serif 4",Georgia,serif}' +
    '.ax-x{width:40px;height:40px;border-radius:10px;border:0;background:transparent;color:#B0B3B8;font-size:24px;line-height:1;cursor:pointer}' +
    '.ax-x:hover{background:rgba(244,241,234,.08);color:#fff}' +
    '.ax-st{padding:6px 18px 10px}.ax-st .ax-b{width:100%}' +
    '.ax-ac{padding:10px 18px 14px}' +
    '.ax-ac p{margin:0 0 12px;font-size:14px;line-height:1.5;color:#B0B3B8}' +
    '.ax-ac .ax-row{display:flex;gap:10px}.ax-ac .ax-b{flex:1;padding:0 12px}' +
    '.ax-who{display:flex;align-items:center;gap:12px;min-width:0}.ax-who>div{min-width:0}' +
    '.ax-who strong{display:block;font-weight:600;font-size:15.5px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ax-who small{display:block;font-size:13px;color:#B0B3B8;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}' +
    '.ax-nav{flex:1 1 auto;overflow-y:auto;padding:10px 10px 6px}' +
    '.ax-nav h3{margin:18px 12px 6px;font:500 11px "Geist Mono",ui-monospace,monospace;letter-spacing:.16em;text-transform:uppercase;color:#8A8E94}' +
    '.ax-nav a{display:block;padding:11px 12px;border-radius:10px;color:#C9CBCF;text-decoration:none;font-size:15.5px}' +
    '.ax-nav a:hover{background:rgba(244,241,234,.07);color:#fff}' +
    '.ax-nav a[aria-current="page"]{color:#F4F1EA;font-weight:500;background:rgba(244,241,234,.07);box-shadow:inset 2px 0 0 #D2B47C}' +
    '.ax-ft{padding:14px 18px 20px}' +
    '.ax-out{width:100%;min-height:46px;border-radius:999px;border:1px solid rgba(244,241,234,.32);background:transparent;color:#F4F1EA;font:500 15px Geist,system-ui,sans-serif;cursor:pointer}' +
    '.ax-out:hover{border-color:#E58B7E;color:#E58B7E}' +
    '.ax-ft p{margin:0 0 12px;font-size:14px;line-height:1.5;color:#B0B3B8}' +
    '.ax-ft .ax-row{display:flex;gap:10px}.ax-ft .ax-b{flex:1;padding:0 12px}' +
    '.ax-ft small{display:block;margin-top:10px;color:#8A8E94;font-size:12px;line-height:1.5}' +
    '.ax-tg:focus-visible,.ax-b:focus-visible,.ax-me:focus-visible,.ax-x:focus-visible,.ax-out:focus-visible,.ax-nav a:focus-visible,.ax-sh a:focus-visible{outline:2px solid #D2B47C;outline-offset:2px}' +
    '.nav .nav-links{gap:4px 22px}' +
    /* signed out the account slot is empty: hide it so the page links sit at the far right, on one line */
    '.ax-ah:empty{display:none}' +
    '@media (min-width:1001px){header.hd>div{flex-wrap:nowrap!important}header.hd nav,.nav .nav-links{flex-wrap:nowrap!important;white-space:nowrap;margin-left:auto}}' +
    '@media (min-width:1001px) and (max-width:1180px){header.hd nav,.nav .nav-links{gap:4px 18px!important}}' +
    '@media (max-width:760px){.ax-ah .ax-b-gold{display:none}.ax-ah .ax-b-line{min-height:38px;padding:0 14px;border-color:transparent;font-size:14px}.ax-me span:last-child{display:none}.ax-me{padding:0 6px}}' +
    '@media (max-width:900px){.nav .menu-btn{display:none!important}}' +   /* the sidebar replaces the home page\'s own mobile menu */
    /* phones: no room to move the page, so the menu overlaps it; an invisible area (no dimming) closes it when the page is tapped */
    '.ax-bk{position:fixed;inset:0;z-index:2147483000;display:none}@media (max-width:999px){html.ax-open .ax-bk{display:block}}' +
    /* wide screens: the page moves over to make room, so nothing is covered or dimmed */
    '@media (min-width:1000px){html.ax-has body{transition:margin-left .3s cubic-bezier(.16,1,.3,1)}html.ax-open body{margin-left:300px}html.ax-open .ax-ah{display:none}}' +
    '@media (prefers-reduced-motion:reduce){.ax-sb,html.ax-has body{transition:none!important}}';

  var logo = '<svg width="28" height="28" viewBox="0 0 64 64" aria-hidden="true"><path d="M13.56 26A22 22 0 0 1 50.44 26Z" fill="#F4F1EA"></path><path d="M11.51 30A22 22 0 0 0 20.91 57H43.09A22 22 0 0 0 52.49 30Z" fill="#F4F1EA"></path><circle cx="32" cy="8" r="5" fill="#D2B47C"></circle></svg>';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function label(u) { return u.name || (u.email ? u.email.split('@')[0] : 'Account'); }

  var toggle, grp, sb, lastFocus;

  function renderHeader() {
    if (!grp) return;
    if (current) {
      grp.innerHTML = '<button type="button" class="ax-me" aria-label="Open menu, signed in as ' + esc(current.email) + '"><span class="ax-av" aria-hidden="true">' + esc(label(current).charAt(0)) + '</span><span>' + esc(label(current)) + '</span></button>';
      grp.firstChild.addEventListener('click', openSb);
    } else {
      grp.innerHTML = '';                                      // no account needed; sign-in is offered only when someone saves a result
    }
  }

  function renderSb() {
    var h = '<div class="ax-sh"><a href="Main.dc.html">' + logo + 'Gullak</a><button type="button" class="ax-x" aria-label="Close menu">&times;</button></div>';
    h += '<div class="ax-st"><a class="ax-b ax-b-gold" href="Workspace.dc.html">Start planning</a></div>';
    if (current) {
      h += '<div class="ax-ac"><div class="ax-who"><span class="ax-av" aria-hidden="true">' + esc(label(current).charAt(0)) + '</span><div><strong>' + esc(label(current)) + '</strong><small>' + esc(current.email) + '</small></div></div>' +
        '<div class="ax-row" style="margin-top:12px"><a class="ax-b ax-b-line" href="MyGullak.html"' + (page === 'MyGullak.html' ? ' aria-current="page"' : '') + '>My Gullak: saved results</a></div></div>';
    }
    h += '<nav class="ax-nav" aria-label="All pages"><h3>Pages</h3>';
    (current ? PAGES : PAGES.concat([['Saved results', 'MyGullak.html']])).forEach(function (p) { h += '<a href="' + p[1] + '"' + (p[1] === page ? ' aria-current="page"' : '') + '>' + p[0] + '</a>'; });
    h += '<h3>Trust</h3>';
    MORE.forEach(function (p) { h += '<a href="' + p[1] + '">' + p[0] + '</a>'; });
    h += '</nav>';
    h += '<div class="ax-ft">' + (current
      ? '<button type="button" class="ax-out">Sign out</button>'
      : '<p>Every tool is free to use, no account needed.</p>') +
      '<small>Investor education, not investment advice.</small></div>';
    sb.innerHTML = h;
    sb.querySelector('.ax-x').addEventListener('click', closeSb);
    var out = sb.querySelector('.ax-out');
    if (out) out.addEventListener('click', function () { window.ArthAuth.signOut().then(function () { closeSb(); if (gated && configured) toSignIn(); }); });
  }

  /* the page keeps scrolling and stays clickable while the menu is open; charts are told the width changed */
  function settle() { setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 340); }
  function openSb() {
    if (sb.classList.contains('on')) return closeSb();
    lastFocus = document.activeElement;
    sb.classList.add('on');
    document.documentElement.classList.add('ax-open');
    toggle.setAttribute('aria-expanded', 'true'); toggle.setAttribute('aria-label', 'Close menu');
    settle();
  }
  function closeSb() {
    sb.classList.remove('on');
    document.documentElement.classList.remove('ax-open');
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-label', 'Open menu');
    if (sb.contains(document.activeElement)) { if (lastFocus && lastFocus.focus) lastFocus.focus(); else toggle.focus(); }
    settle();
  }

  function place() {
    var header = document.querySelector('#dc-root header') || document.querySelector('header');
    var box = header && (header.querySelector(':scope > div') || header);
    if (!box) {                                                // no header on this page: plain fixed menu button
      if (!toggle.isConnected) {
        toggle.style.cssText = 'position:fixed;top:12px;left:12px;z-index:60;background:rgba(17,19,22,.92)';
        document.body.appendChild(toggle);
      }
      return;
    }
    toggle.style.cssText = '';
    var brand = null, kids = box.children;
    for (var i = 0; i < kids.length; i++) if (kids[i] !== toggle && !kids[i].classList.contains('ax-wrap') && !kids[i].classList.contains('ax-ah')) { brand = kids[i]; break; }
    var wrap = box.querySelector(':scope > .ax-wrap');
    if (!wrap) { wrap = document.createElement('div'); wrap.className = 'ax-wrap'; box.insertBefore(wrap, brand || box.firstChild); }
    if (toggle.parentNode !== wrap) wrap.insertBefore(toggle, wrap.firstChild);
    if (brand && brand.parentNode !== wrap) wrap.appendChild(brand);
    if (grp.parentNode !== box) {
      box.appendChild(grp);                                    // always the last thing in the header
    }
  }

  function mount() {
    if (document.getElementById('ax-sb')) return;
    var st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

    toggle = document.createElement('button');
    toggle.type = 'button'; toggle.className = 'ax-tg'; toggle.setAttribute('aria-label', 'Open menu');
    toggle.setAttribute('aria-expanded', 'false'); toggle.setAttribute('aria-controls', 'ax-sb');
    toggle.innerHTML = '<i></i>';
    toggle.addEventListener('click', openSb);

    grp = document.createElement('div'); grp.className = 'ax-ah';

    place();
    // the page is drawn by a script that can re-render the header; put the buttons back if they are removed
    var raf = 0;
    new MutationObserver(function () {
      if (raf || (toggle.isConnected && grp.isConnected)) return;
      raf = requestAnimationFrame(function () { raf = 0; place(); });
    }).observe(document.body, { childList: true, subtree: true });

    var bk = document.createElement('div'); bk.className = 'ax-bk'; bk.addEventListener('click', closeSb); document.body.appendChild(bk);
    sb = document.createElement('aside'); sb.id = 'ax-sb'; sb.className = 'ax-sb';
    sb.setAttribute('aria-label', 'Menu');
    document.body.appendChild(sb);
    document.documentElement.classList.add('ax-has');
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && sb.classList.contains('on')) closeSb(); });

    function paint() { renderHeader(); renderSb(); }
    paint();
    window.ArthAuth.onChange(paint);
  }
  /* pages drawn by the page runtime (#dc-root) must be left alone until it has finished drawing */
  function whenDrawn(fn) {
    var tries = 0;
    (function check() {
      if (!document.querySelector('x-dc') || document.querySelector('#dc-root [data-arth-ready]')) return fn();
      if (tries++ > 600) return fn();
      setTimeout(check, 40);
    })();
  }
  /* the page is drawn after it loads, so the browser's own jump to #sources / #disclaimers finds nothing; jump again once drawn */
  function jumpToHash() {
    var id = ''; try { id = decodeURIComponent(location.hash.slice(1)); } catch (e) {}
    var go = function () { var el = id && document.getElementById(id); if (el) el.scrollIntoView(); };
    go(); setTimeout(go, 300); setTimeout(go, 900);
  }
  function start() { mount(); jumpToHash(); }
  if (document.body) whenDrawn(start); else document.addEventListener('DOMContentLoaded', function () { whenDrawn(start); });
})();
