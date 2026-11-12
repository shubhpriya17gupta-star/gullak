/* Planner results: chart hover, count-up figures and section entrances.
   Display only. It never computes a value: hovering moves the year slider (#yr),
   and the page's own logic renders every number. Count-up only animates the text
   the page already rendered, and always ends on that exact text. */
(function () {
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.documentElement.classList.add('rz-js');

  /* hover or drag on the chart -> set the year slider, the page does the rest */
  function setYearFrom(plot, clientX) {
    var t = parseInt(plot.getAttribute('data-t'), 10);
    var yr = document.getElementById('yr');
    if (!t || !yr) return;
    var b = plot.getBoundingClientRect();
    var frac = (clientX - b.left) / b.width;
    var y = Math.round(frac * t);
    /* data-times lists each point's position along the axis (0 to 1), so a part-year at the end
       is matched by its real place on the chart instead of by index */
    var times = (plot.getAttribute('data-times') || '').split('|').map(parseFloat);
    if (times.length === t + 1 && times.every(function (x) { return isFinite(x); })) {
      var best = 1;
      for (var i = 1; i <= t; i++) if (Math.abs(times[i] - frac) < Math.abs(times[best] - frac)) best = i;
      y = best;
    }
    y = Math.max(1, Math.min(t, y));
    if (String(y) === yr.value) return;
    yr.value = String(y);
    yr.dispatchEvent(new Event('input', { bubbles: true }));
  }
  document.addEventListener('pointermove', function (e) {
    var plot = e.target.closest && e.target.closest('.gx-plot');
    if (plot) setYearFrom(plot, e.clientX);
  }, { passive: true });
  document.addEventListener('pointerdown', function (e) {
    var plot = e.target.closest && e.target.closest('.gx-plot');
    if (plot) setYearFrom(plot, e.clientX);
  }, { passive: true });

  /* count-up: animate the first number in a .cu element from its previous value to the new one */
  var NUM = /\d[\d,]*(\.\d+)?/;
  function fmt(n, dec) { return n.toLocaleString('en-IN', { minimumFractionDigits: dec, maximumFractionDigits: dec }); }
  function textNode(el) { var w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT), c; while ((c = w.nextNode())) if (c.nodeValue.trim()) return c; return null; }
  function run(el) {
    var node = textNode(el);
    if (!node) return;
    var target = node.nodeValue;
    if (el._w === target) return;              // our own frame
    var prevText = el._final;
    el._final = target;
    if (reduce) return;
    var m = target.match(NUM);
    if (!m) return;
    var to = parseFloat(m[0].replace(/,/g, ''));
    var dec = m[1] ? m[1].length - 1 : 0;
    var pm = prevText ? prevText.match(NUM) : null;
    var from = pm ? parseFloat(pm[0].replace(/,/g, '')) : 0;
    if (from === to) return;
    var start = performance.now(), dur = 900, id = (el._id || 0) + 1;
    el._id = id;
    function frame(now) {
      if (el._id !== id || !node.isConnected) return;   // the page rendered something newer
      var k = Math.min(1, (now - start) / dur);
      var e = 1 - Math.pow(1 - k, 3);
      var v = from + (to - from) * e;
      var s = k < 1 ? target.replace(NUM, fmt(dec ? v : Math.round(v), dec)) : target;
      el._w = s;
      node.nodeValue = s;
      if (k < 1) requestAnimationFrame(frame); else el._w = null;
    }
    requestAnimationFrame(frame);
  }

  /* entrances: reveal [data-rv] blocks as they scroll in, including ones rendered later */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
  }, { rootMargin: '0px 0px -8% 0px' }) : null;

  function scan() {
    document.querySelectorAll('.rz [data-rv]:not([data-rvs])').forEach(function (el) {
      el.setAttribute('data-rvs', '1');
      if (io && !reduce) io.observe(el); else el.classList.add('in');
    });
    document.querySelectorAll('.rz .cu').forEach(run);
  }

  function start() {
    var root = document.getElementById('dc-root') || document.body;
    var queued = false;
    new MutationObserver(function () {
      if (queued) return;
      queued = true;
      setTimeout(function () { queued = false; scan(); }, 30);
    }).observe(root, { childList: true, subtree: true, characterData: true });
    scan();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
