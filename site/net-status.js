/* Gullak connection screen.
   Shows the LatticeLoader (React Bits, MIT licence, ported here to plain JavaScript)
   when the internet drops, when a page is slow to load, or when the next page is
   slow to open after a link is tapped. Nothing is sent anywhere; it only listens
   to the browser's own online/offline and page-load events. */
(function () {
  'use strict';
  if (window.__arthNetStatus) return;
  window.__arthNetStatus = true;

  // ---------- LatticeLoader, plain JavaScript port ----------
  var PATTERNS = {
    arrow: { 3: { cells: [1, 2, 3, 0, 1, 2, 1, 2, 3], loop: 7.2, scale: 1 } },
    dots: { 3: { cells: [0, 1, 2, 0, 1, 2, 0, 1, 2], loop: 3, scale: 2.4 } },
    ripple: { 3: { cells: [2, 1, 2, 1, 0, 1, 2, 1, 2], loop: 4.8, scale: 1.5 } },
    spiral: { 3: { cells: [0, 1, 2, 7, 8, 3, 6, 5, 4], loop: 9, scale: 1.2, lit: 0.35 } },
    orbit: {
      3: { cells: [0, 1, 2, 7, null, 3, 6, 5, 4], loop: 8, scale: 1.2 },
      4: { cells: [0, 1, 2, 3, 11, null, null, 4, 10, null, null, 5, 9, 8, 7, 6], loop: 6, scale: 1.2, lit: 0.45 }
    },
    snake: {
      3: { cells: [0, 1, 2, 5, 4, 3, 6, 7, 8], loop: 9, scale: 1, lit: 0.35 },
      4: { cells: [0, 1, 2, 3, 7, 6, 5, 4, 8, 9, 10, 11, 15, 14, 13, 12], loop: 16, scale: 1, lit: 0.25 }
    },
    sweep: { 4: { cells: [0, 1, 2, 3, 1, 2, 3, 4, 2, 3, 4, 5, 3, 4, 5, 6], loop: 5, scale: 1, lit: 0.45 } },
    spin: { 4: { cells: [0, 0, 1, 1, 0, 0, 1, 1, 3, 3, 2, 2, 3, 3, 2, 2], loop: 4, scale: 1.6, lit: 0.35 } },
    rain: { 4: { cells: [0, 2, 1, 3, 1, 3, 2, 4, 2, 4, 3, 5, 3, 5, 4, 6], loop: 4, scale: 1.2, lit: 0.35 } },
    pulse: { 4: { cells: [2, 1, 1, 2, 1, 0, 0, 1, 1, 0, 0, 1, 2, 1, 1, 2], loop: 2.4, scale: 2.5, lit: 0.45 } }
  };
  var DEFAULT_PATTERN = { 3: 'orbit', 4: 'sweep' };
  var MARKS = {
    3: { done: [2, 3, 5, 7], error: [0, 2, 4, 6, 8] },
    4: { done: [7, 8, 10, 13], error: [0, 3, 5, 6, 9, 10, 12, 15] }
  };
  function fmt(ds) {
    return ds < 600 ? (ds / 10).toFixed(1) + 's' : Math.floor(ds / 600) + 'm ' + ((ds % 600) / 10).toFixed(1) + 's';
  }
  function spoken(ds) {
    return ds < 600
      ? (ds / 10).toFixed(1) + ' seconds'
      : Math.floor(ds / 600) + ' minutes ' + ((ds % 600) / 10).toFixed(1) + ' seconds';
  }
  function el(tag, cls) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    return e;
  }
  function flag(e, name, on) {
    if (on) e.setAttribute(name, '');
    else e.removeAttribute(name);
  }

  // Same props and defaults as the React component (named patterns only).
  function createLatticeLoader(opts) {
    var o = {
      label: 'Thinking', doneLabel: 'Done in', errorLabel: 'Failed after', status: 'working',
      pattern: 'orbit', grid: 3, shape: 'round', color: 'currentColor', doneColor: '#D2B47C',
      errorColor: '#ef4444', cellSize: 6, gap: 2, fontSize: 14, step: 90, idleOpacity: 0.15,
      glow: false, glowColor: '', showTimer: true
    };
    for (var k in opts) if (Object.prototype.hasOwnProperty.call(opts, k)) o[k] = opts[k];
    var n = o.grid === 4 ? 4 : 3;
    var pat = (PATTERNS[o.pattern] && PATTERNS[o.pattern][n]) || PATTERNS[DEFAULT_PATTERN[n]][n];
    var d = o.step * pat.scale;
    var cycle = Math.round(pat.loop * d);

    var root = el('span', 'lattice-loader');
    root.setAttribute('role', 'status');
    root.setAttribute('data-shape', o.shape);
    flag(root, 'data-glow', o.glow);
    var st = root.style;
    st.setProperty('--ll-n', n);
    st.setProperty('--ll-cell', o.cellSize + 'px');
    st.setProperty('--ll-gap', o.gap + 'px');
    st.setProperty('--ll-font', o.fontSize + 'px');
    st.setProperty('--ll-color', o.color);
    st.setProperty('--ll-idle', o.idleOpacity);
    st.setProperty('--ll-glow', o.glowColor || o.color);
    st.setProperty('--ll-cycle', cycle + 'ms');

    var grid = el('span', 'lattice-loader__grid');
    grid.setAttribute('aria-hidden', 'true');
    var run = el('span', 'lattice-loader__layer lattice-loader__run');
    var markLayer = el('span', 'lattice-loader__layer lattice-loader__mark');
    var markCells = [];
    pat.cells.forEach(function (unit) {
      var c = el('span', 'lattice-loader__cell');
      if (unit == null) c.setAttribute('data-hole', '');
      else c.style.animationDelay = Math.round(unit * d) + 'ms';
      if (pat.lit && pat.lit !== 0.62) c.setAttribute('data-lit', String(Math.round(pat.lit * 100)));
      run.appendChild(c);
      var m = el('span', 'lattice-loader__cell');
      markLayer.appendChild(m);
      markCells.push(m);
    });
    grid.appendChild(run);
    grid.appendChild(markLayer);

    var lab = el('span', 'lattice-loader__label');
    lab.setAttribute('aria-hidden', 'true');
    var texts = {};
    ['working', 'done', 'error'].forEach(function (s) {
      var t = el('span', 'lattice-loader__text');
      lab.appendChild(t);
      texts[s] = t;
    });
    var timer = null;
    if (o.showTimer) {
      timer = el('span', 'lattice-loader__timer');
      timer.setAttribute('aria-hidden', 'true');
      timer.textContent = '0.0s';
    }
    var sr = el('span', 'lattice-loader__sr');
    root.appendChild(grid);
    root.appendChild(lab);
    if (timer) root.appendChild(timer);
    root.appendChild(sr);

    var ds = 0, tick = null, mark = 'done';
    function paint(v) { ds = v; if (timer) timer.textContent = fmt(v); }
    function stopClock() { if (tick) { clearInterval(tick); tick = null; } }

    function update(next) {
      var prev = o.status;
      for (var k2 in next) if (Object.prototype.hasOwnProperty.call(next, k2)) o[k2] = next[k2];
      texts.working.textContent = o.label;
      texts.done.textContent = o.doneLabel;
      texts.error.textContent = o.errorLabel;
      var s = o.status;
      if (s !== 'working') mark = s;
      root.setAttribute('data-status', s);
      var mc = s === 'error' ? o.errorColor : o.doneColor;
      st.setProperty('--ll-mark', mc);
      st.setProperty('--ll-mark-glow', o.glowColor || mc);
      markCells.forEach(function (c, i) { flag(c, 'data-on', MARKS[n][mark].indexOf(i) !== -1); });
      flag(texts.working, 'data-active', s === 'working');
      flag(texts.done, 'data-active', s === 'done');
      flag(texts.error, 'data-active', s === 'error');
      if (s === 'working' && (prev !== 'working' || !tick || next.restart)) {
        stopClock();
        var startedAt = performance.now();
        paint(0);
        tick = setInterval(function () { paint(Math.floor((performance.now() - startedAt) / 100)); }, 100);
        sr.textContent = o.label + ', in progress';
      } else if (s !== 'working') {
        stopClock();
        sr.textContent = (s === 'done' ? o.doneLabel : o.errorLabel) + (o.showTimer ? ' ' + spoken(ds) : '');
      }
    }
    update({});
    return { el: root, update: update, stop: stopClock };
  }
  window.createLatticeLoader = createLatticeLoader;

  // ---------- Connection screen ----------
  var screen = null, loader = null, titleEl = null, bodyEl = null;
  var mode = null;            // 'offline' | 'load' | 'nav' | null
  var hideTimer = null, navTimer = null, loadTimer = null;
  var pendingHref = null;     // link tapped while offline

  function build() {
    if (screen) return;
    screen = el('div', 'net-screen');
    screen.setAttribute('aria-live', 'polite');
    var card = el('div', 'net-screen__card');
    var holder = el('div', 'net-screen__loader');
    loader = createLatticeLoader({
      pattern: 'orbit', grid: 3, shape: 'round', color: '#F4F1EA',
      doneColor: '#D2B47C', errorColor: '#ef4444',
      cellSize: 8, gap: 3, fontSize: 16, step: 90, idleOpacity: 0.15, showTimer: true
    });
    holder.appendChild(loader.el);
    titleEl = el('p', 'net-screen__title');
    bodyEl = el('p', 'net-screen__body');
    card.appendChild(holder);
    card.appendChild(titleEl);
    card.appendChild(bodyEl);
    screen.appendChild(card);
    (document.body || document.documentElement).appendChild(screen);
  }

  function show(m, opts) {
    build();
    if (screen.parentNode !== document.body && document.body) document.body.appendChild(screen);
    clearTimeout(hideTimer);
    var fresh = mode !== m;
    mode = m;
    loader.update({
      status: 'working', label: opts.label, doneLabel: opts.doneLabel,
      errorLabel: 'Still waiting', restart: fresh
    });
    titleEl.textContent = opts.title;
    bodyEl.textContent = opts.body;
    screen.setAttribute('data-open', '');
  }

  function finish(opts, delay) {
    if (!screen || !mode) return;
    loader.update({ status: 'done' });
    if (opts.title) titleEl.textContent = opts.title;
    if (opts.body != null) bodyEl.textContent = opts.body;
    var was = mode;
    hideTimer = setTimeout(function () {
      if (mode !== was) return;
      close();
    }, delay);
  }

  function close() {
    clearTimeout(hideTimer);
    mode = null;
    if (!screen) return;
    screen.removeAttribute('data-open');
    loader.stop();
  }

  function showOffline() {
    clearTimeout(navTimer);
    show('offline', {
      label: 'Waiting for connection',
      doneLabel: 'Back online in',
      title: 'You are offline',
      body: pendingHref
        ? 'The page you tapped will open as soon as your internet is back.'
        : 'Your work on this page is safe. Gullak does its calculations in your browser, so nothing is lost. This screen closes by itself when your internet is back.'
    });
  }

  window.addEventListener('offline', showOffline);
  window.addEventListener('online', function () {
    if (mode !== 'offline') return;
    if (pendingHref) {
      var href = pendingHref;
      pendingHref = null;
      loader.update({ status: 'done' });
      titleEl.textContent = 'You are back online';
      bodyEl.textContent = 'Opening the page now.';
      setTimeout(function () { window.location.href = href; }, 500);
      return;
    }
    finish({ title: 'You are back online', body: 'Carry on from where you left off.' }, 1400);
  });

  // Slow first load: only shown if the page has not finished after 1.2 seconds.
  if (document.readyState !== 'complete') {
    loadTimer = setTimeout(function () {
      if (document.readyState === 'complete' || mode) return;
      show('load', {
        label: 'Loading', doneLabel: 'Loaded in', title: 'Slow connection',
        body: 'This page is taking longer than usual to load. Please wait a moment.'
      });
    }, 1200);
    window.addEventListener('load', function () {
      clearTimeout(loadTimer);
      if (mode === 'load') finish({ title: 'Ready', body: '' }, 700);
    });
  }

  // Slow next page: shown only if the new page has not appeared after 1.5 seconds.
  document.addEventListener('click', function (e) {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var a = e.target && e.target.closest ? e.target.closest('a[href]') : null;
    if (!a || a.hasAttribute('download')) return;
    var t = a.getAttribute('target');
    if (t && t !== '_self') return;
    var url;
    try { url = new URL(a.href, window.location.href); } catch (err) { return; }
    if (url.origin !== window.location.origin) return;
    if (url.pathname === window.location.pathname && url.search === window.location.search && url.hash) return;
    if (navigator.onLine === false) {
      e.preventDefault();
      pendingHref = url.href;
      showOffline();
      return;
    }
    clearTimeout(navTimer);
    navTimer = setTimeout(function () {
      if (mode) return;
      show('nav', {
        label: 'Opening', doneLabel: 'Opened in', title: 'Slow connection',
        body: 'The next page is taking longer than usual. Please wait a moment.'
      });
    }, 1500);
  });

  // Coming back to a page from the browser's back/forward cache.
  window.addEventListener('pageshow', function (e) {
    clearTimeout(navTimer);
    if (e.persisted && mode === 'nav') close();
    if (navigator.onLine === false) showOffline();
  });

  function startOfflineCheck() { if (navigator.onLine === false) showOffline(); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', startOfflineCheck);
  else startOfflineCheck();
})();
