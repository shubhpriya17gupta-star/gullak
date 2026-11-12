/* Gullak Trade cost: "The Receipt".
   1. A 3D waterfall drawn on a 2D canvas: the profit before charges, then each deduction
      (brokerage, GST, tax, cess) as a block that steps the running total down, ending
      at what you keep. Every block is on the same scale, so small charges stay small.
   2. The receipt slip under the stage "prints" again whenever the trade changes.
   All figures come from the page's exact BigInt engine through data attributes
   (paise as integers, and the page's own formatted text); this file only draws them. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var ease = function (t) { return 1 - Math.pow(1 - t, 3); };
  var BG = '#111316', ROSE = '233,160,160', GOLD = '210,180,124', IV = '244,241,234';

  var NAMES = ['PROFIT', 'BROKERAGE', 'GST', 'AFTER CHARGES', 'TAX', 'CESS', 'YOU KEEP'];
  var SHORT = ['PROFIT', 'BROK.', 'GST', 'NET', 'TAX', 'CESS', 'KEEP'];
  // a worked example for the empty state: 100 shares bought at 500, sold at 600, short-term
  var EXAMPLE = [1000000, 4000, 720, 995280, 199056, 7962, 788262];

  function ready(sel, fn) {
    var n = 0;
    (function check() {
      var el = document.querySelector('#dc-root ' + sel);
      if (el) return fn(el);
      if (n++ < 600) setTimeout(check, 40);
    })();
  }

  // ---------------- the waterfall ----------------
  ready('#cascade', function (host) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var d = { state: 'empty', v: EXAMPLE.slice(), t: [], kind: [] };
    // spans: [from, to] of the running total for each of the 7 blocks
    function spans(v) {
      var g = v[0], b = v[1], s = v[2], a = v[3], t = v[4], c = v[5], k = v[6];
      return [[0, g], [g, g - b], [g - b, g - b - s], [0, a], [a, a - t], [a - t, a - t - c], [0, k]];
    }
    var tgt = spans(EXAMPLE), cur = spans(EXAMPLE);
    var tgtOn = 0, on = 0, pourAt = -1e9, wasOk = false;
    var sc = { lo: 0, hi: 1 }, scT = { lo: 0, hi: 1 };

    function read() {
      var h = document.querySelector('#dc-root #cascade') || host;
      if (h !== host) { host = h; host.insertBefore(canvas, host.firstChild); resize(); }
      d.state = host.getAttribute('data-state') || 'empty';
      var ok = d.state === 'ok';
      var raw = (host.getAttribute('data-v') || '').split(';');
      var v = ok && raw.length === 7 ? raw.map(Number) : EXAMPLE.slice();
      if (v.some(function (x) { return !isFinite(x); })) v = EXAMPLE.slice();
      d.v = v;
      d.t = (host.getAttribute('data-t') || '').split('|');
      tgt = spans(v);
      var lo = 0, hi = 0;
      tgt.forEach(function (p) { lo = Math.min(lo, p[0], p[1]); hi = Math.max(hi, p[0], p[1]); });
      if (hi - lo <= 0) hi = lo + 1;
      scT.lo = lo; scT.hi = hi;
      tgtOn = ok ? 1 : 0;
      if (ok && !wasOk) { pourAt = performance.now(); cur = tgt.map(function (p) { return [p[0], p[1]]; }); sc.lo = lo; sc.hi = hi; }
      wasOk = ok;
      kick();
    }
    new MutationObserver(read).observe(document.querySelector('#dc-root') || document.body, { attributes: true, subtree: true, attributeFilter: ['data-v', 'data-t', 'data-state'], childList: true });

    // ---------- projection ----------
    var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, F = 0, narrow = false;
    var cam = { yaw: -0.26, pitch: 0.3 }, aim = { yaw: -0.26, pitch: 0.3 }, DIST = 15, TALL = 4.2;
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      narrow = W < 600;
      cx = W * 0.5; cy = H * (narrow ? 0.62 : 0.55);
      F = narrow ? Math.min(W * 1.16, H * 1.9) : Math.min(W * 1.02, H * 1.9);
      kick();
    }
    function proj(x, y, z, o) {
      var c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
      var x1 = x * c - z * s, z1 = x * s + z * c, yc = y - TALL / 2;
      var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var y2 = yc * cp - z1 * sp, z2 = yc * sp + z1 * cp;
      var dep = DIST - z2;
      o = o || [0, 0, 0];
      o[0] = cx + F * x1 / dep; o[1] = cy - F * y2 / dep; o[2] = dep;
      return o;
    }
    var SLOT = 10 / 7, BW = SLOT * 0.62, BD = 0.9;
    function xOf(i) { return -5 + SLOT * (i + 0.5); }
    function yOf(v) { return (v - sc.lo) / (sc.hi - sc.lo) * TALL; }

    // ---------- drawing ----------
    var hover = -1;
    function colourOf(i) {
      if (i === 1 || i === 2) return ROSE;
      if (i === 4 || i === 5) return GOLD;
      if (i === 6) return d.v[6] < 0 ? ROSE : GOLD;
      return IV;
    }
    function face(pts, fill, stroke, lw) {
      // back-face cull using the screen-space winding
      var a = 0;
      for (var i = 0; i < pts.length; i++) { var p = pts[i], q = pts[(i + 1) % pts.length]; a += p[0] * q[1] - q[0] * p[1]; }
      if (a >= 0) return; // canvas y runs down, so faces turned towards the viewer wind negative
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath();
      ctx.fillStyle = fill; ctx.fill();
      ctx.strokeStyle = stroke; ctx.lineWidth = lw; ctx.stroke();
    }
    function box(i, y0, y1, col, alpha, hi) {
      var x0 = xOf(i) - BW / 2, x1 = xOf(i) + BW / 2;
      var lo = Math.min(y0, y1), up = Math.max(y0, y1);
      if (up - lo < 0.03) { var m = (up + lo) / 2; lo = m - 0.015; up = m + 0.015; }
      var z0 = 0, z1 = -BD;
      var P = function (x, y, z) { return proj(x, y, z, [0, 0, 0]); };
      var A = P(x0, lo, z0), B = P(x1, lo, z0), C = P(x1, up, z0), D = P(x0, up, z0);
      var E = P(x0, lo, z1), Fp = P(x1, lo, z1), G = P(x1, up, z1), Hh = P(x0, up, z1);
      var e = hi ? 1 : 0.85;
      var s = function (a) { return 'rgba(' + col + ',' + (a * alpha).toFixed(3) + ')'; };
      // far faces first, then the near ones
      face([Fp, E, Hh, G], s(0.05), s(0.25), 1);       // back
      face([E, A, D, Hh], s(0.08), s(0.4 * e), 1);      // left
      face([B, Fp, G, C], s(0.08), s(0.4 * e), 1);      // right
      face([E, Fp, B, A], s(0.06), s(0.3), 1);          // bottom
      face([D, C, G, Hh], s(hi ? 0.42 : 0.3), s(0.75 * e), 1); // top
      face([A, B, C, D], s(hi ? 0.24 : 0.15), s(e), hi ? 1.8 : 1.3); // front
      return { top: Math.min(D[1], C[1], G[1], Hh[1]), cx: (A[0] + B[0]) / 2, bottom: Math.max(A[1], B[1]) };
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      var ok = d.state === 'ok';
      var alpha = lerp(0.42, 1, on);
      var now = performance.now();

      // back wall: fine value lines, and the zero line carried across it and the floor
      var zb = -BD - 0.9, i, p = [0, 0, 0], q = [0, 0, 0];
      ctx.lineWidth = 1;
      for (i = 0; i <= 6; i++) {
        var yy = TALL * i / 6;
        proj(-5.2, yy, zb, p); proj(5.2, yy, zb, q);
        ctx.strokeStyle = 'rgba(' + IV + ',0.06)';
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      for (i = 0; i <= 7; i++) {
        var xx = -5 + SLOT * i;
        proj(xx, 0, zb, p); proj(xx, TALL, zb, q);
        ctx.strokeStyle = 'rgba(' + IV + ',0.04)';
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      var y0w = yOf(0);
      ctx.strokeStyle = 'rgba(' + IV + ',' + (0.22 + 0.18 * on).toFixed(3) + ')';
      ctx.beginPath(); proj(-5.2, y0w, zb, p); ctx.moveTo(p[0], p[1]); proj(5.2, y0w, zb, q); ctx.lineTo(q[0], q[1]);
      proj(5.2, y0w, 0.6, q); ctx.lineTo(q[0], q[1]); proj(-5.2, y0w, 0.6, q); ctx.lineTo(q[0], q[1]); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = 'rgba(' + IV + ',0.025)'; ctx.fill();
      ctx.font = "500 10.5px 'Geist Mono', ui-monospace, monospace";
      ctx.fillStyle = 'rgba(' + IV + ',0.45)'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
      proj(-5.2, y0w, 0.6, p); ctx.fillText('₹0', Math.max(p[0] - 8, 22), p[1]);

      // the blocks, poured in order
      var tops = [];
      for (i = 0; i < 7; i++) {
        var pr = reduce || !ok ? 1 : ease(clamp((now - pourAt - i * 120) / 520, 0, 1));
        var a0 = yOf(cur[i][0]), a1 = yOf(cur[i][1]);
        var a1p = lerp(a0, a1, pr);
        if (pr <= 0) { tops.push(null); continue; }
        tops.push(box(i, a0, a1p, colourOf(i), alpha * (pr < 1 ? 0.5 + 0.5 * pr : 1), hover === i));
      }

      // connectors: a dashed step line from each block's end level to the next block
      ctx.setLineDash([3, 5]); ctx.lineWidth = 1;
      ctx.strokeStyle = 'rgba(' + IV + ',' + (0.18 + 0.22 * on).toFixed(3) + ')';
      for (i = 0; i < 6; i++) {
        if (!tops[i] || !tops[i + 1]) continue;
        if (i === 2 || i === 5) continue; // subtotals start again from zero
        var lv = yOf(cur[i][1]);
        proj(xOf(i) + BW / 2, lv, 0, p); proj(xOf(i + 1) - BW / 2, lv, 0, q);
        ctx.beginPath(); ctx.moveTo(p[0], p[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
      }
      ctx.setLineDash([]);

      // names along the bottom, values over each block
      var base = 0;
      for (i = 0; i < 7; i++) base = Math.max(base, proj(xOf(i), 0, 0.3, p)[1]);
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.font = (narrow ? "500 9.5px " : "500 10.5px ") + "'Geist Mono', ui-monospace, monospace";
      for (i = 0; i < 7; i++) {
        proj(xOf(i), 0, 0.3, p);
        var hiI = hover === i;
        ctx.fillStyle = 'rgba(' + (hiI ? colourOf(i) : IV) + ',' + (hiI ? 1 : 0.55 * alpha + 0.1).toFixed(3) + ')';
        ctx.fillText(narrow ? SHORT[i] : NAMES[i], p[0], base + 12);
      }
      if (ok && !narrow) {
        // totals carry their value above; deductions hang from the running total, so theirs goes underneath
        ctx.font = "600 11.5px 'Geist Mono', ui-monospace, monospace";
        for (i = 0; i < 7; i++) {
          if (!tops[i] || !d.t[i]) continue;
          var ded = i === 1 || i === 2 || i === 4 || i === 5;
          ctx.fillStyle = 'rgba(' + colourOf(i) + ',' + (hover === -1 || hover === i ? 1 : 0.55) + ')';
          if (ded) { ctx.textBaseline = 'top'; ctx.fillText(d.t[i], tops[i].cx, tops[i].bottom + 8); }
          else { ctx.textBaseline = 'bottom'; ctx.fillText(d.t[i], tops[i].cx, tops[i].top - 8); }
        }
      }
      // phones (and hovering): one caption for the chosen block
      var pick = hover >= 0 ? hover : (narrow && ok ? 6 : -1);
      if (ok && pick >= 0 && d.t[pick] && (narrow || hover >= 0)) {
        ctx.font = "600 12px 'Geist Mono', ui-monospace, monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(' + colourOf(pick) + ',1)';
        if (narrow) ctx.fillText(NAMES[pick] + ' · ' + d.t[pick], W / 2, H - 14);
      }
      if (!ok) {
        ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'bottom';
        ctx.fillStyle = 'rgba(' + IV + ',0.5)';
        ctx.fillText(narrow ? 'EXAMPLE TRADE · ENTER YOURS' : 'EXAMPLE: 100 SHARES, BOUGHT AT ₹500, SOLD AT ₹600 · ENTER YOUR OWN', W / 2, H - 16);
      }
    }

    // ---------- loop: only while something is moving ----------
    var running = false, raf = 0, to = 0, born = performance.now();
    function frame() {
      running = false;
      var k = reduce ? 1 : 0.16, moving = false;
      for (var i = 0; i < 7; i++) for (var j = 0; j < 2; j++) {
        var dv = tgt[i][j] - cur[i][j];
        cur[i][j] += dv * k;
        if (Math.abs(dv) > (scT.hi - scT.lo) * 0.0005) moving = true; else cur[i][j] = tgt[i][j];
      }
      sc.lo += (scT.lo - sc.lo) * k; sc.hi += (scT.hi - sc.hi) * k;
      if (Math.abs(scT.lo - sc.lo) + Math.abs(scT.hi - sc.hi) > (scT.hi - scT.lo) * 0.0005) moving = true;
      on += (tgtOn - on) * (reduce ? 1 : 0.12); if (Math.abs(tgtOn - on) > 0.002) moving = true;
      cam.yaw += (aim.yaw - cam.yaw) * 0.08; cam.pitch += (aim.pitch - cam.pitch) * 0.08;
      if (Math.abs(aim.yaw - cam.yaw) + Math.abs(aim.pitch - cam.pitch) > 0.0005) moving = true;
      var t = performance.now();
      if (!reduce && (t - pourAt < 7 * 120 + 600 || t - born < 400)) moving = true;
      draw();
      if (moving) kick();
    }
    function tick() { cancelAnimationFrame(raf); clearTimeout(to); frame(); }
    function kick() { if (running) return; running = true; raf = requestAnimationFrame(tick); to = setTimeout(tick, 120); }

    // ---------- pointer: gentle parallax; hovering or tapping a block picks it ----------
    function slotAt(px) {
      // nearest block centre on screen, measured on the front edge at the zero line
      var best = -1, bd = 1e9, p = [0, 0, 0];
      for (var i = 0; i < 7; i++) { proj(xOf(i), yOf(0), 0, p); var dd = Math.abs(px - p[0]); if (dd < bd) { bd = dd; best = i; } }
      return bd < (W / 7) * 0.6 ? best : -1;
    }
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (!reduce && fine) { aim.yaw = -0.26 + ((px / r.width) - 0.5) * 0.24; aim.pitch = 0.3 + ((py / r.height) - 0.5) * 0.08; }
      var h = d.state === 'ok' ? slotAt(px) : -1;
      if (h !== hover && e.pointerType === 'mouse') { hover = h; }
      kick();
    });
    host.addEventListener('pointerleave', function (e) { if (e.pointerType === 'mouse') hover = -1; aim.yaw = -0.26; aim.pitch = 0.3; kick(); });
    host.addEventListener('pointerdown', function (e) {
      if (e.pointerType === 'mouse' || d.state !== 'ok') return;
      var r = host.getBoundingClientRect(); hover = slotAt(e.clientX - r.left); kick();
    });

    addEventListener('resize', resize);
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) kick(); }).observe(host);
    resize(); read(); kick();
  });

  // ---------------- the receipt prints again when the trade changes ----------------
  ready('#feed', function (feed) {
    var last = null, timer = 0;
    function print() {
      var f = document.querySelector('#dc-root #feed');
      var slip = f && f.querySelector('.slip');
      if (!slip || reduce) return;
      slip.classList.remove('print'); void slip.offsetWidth; slip.classList.add('print');
    }
    function check() {
      var f = document.querySelector('#dc-root #feed');
      if (!f) return;
      var k = f.getAttribute('data-key');
      if (k === last) return;
      var first = last === null; last = k;
      if (first) return;
      clearTimeout(timer);
      timer = setTimeout(print, 650); // wait until typing pauses
    }
    new MutationObserver(check).observe(document.querySelector('#dc-root') || document.body, { attributes: true, subtree: true, attributeFilter: ['data-key'], childList: true });
    check();
    // first time the receipt scrolls into view, print it once
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { print(); io.disconnect(); } }, { threshold: 0.3 });
    io.observe(feed);
  });
})();
