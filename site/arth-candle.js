/* Gullak Candlesticks: "The Lab".
   1. One candle in 3D on a 2D canvas, lit from the upper left. Its open, close, high and
      low come from the page's sliders (data attributes on #candle). The four levels can be
      grabbed and dragged; dragging moves the matching slider, so the page stays the source
      of truth and keyboard users keep the sliders.
   2. Arrow buttons for the pattern film strip.
   Candles here are illustrations on an arbitrary scale, not prices. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var BG = '#111316', IV = '244,241,234', GOLD = '210,180,124';
  var UP = [86, 190, 146], DN = [226, 106, 106];

  function ready(sel, fn) {
    var n = 0;
    (function check() {
      var el = document.querySelector('#dc-root ' + sel);
      if (el) return fn(el);
      if (n++ < 600) setTimeout(check, 40);
    })();
  }

  ready('#candle', function (host) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    var tgt = { o: 36, c: 66, uw: 8, lw: 6 }, cur = { o: 36, c: 66, uw: 8, lw: 6 };
    function read() {
      var h = document.querySelector('#dc-root #candle') || host;
      if (h !== host) { host = h; host.insertBefore(canvas, host.firstChild); resize(); }
      ['o', 'c', 'uw', 'lw'].forEach(function (k) { var v = parseFloat(host.getAttribute('data-' + k)); if (isFinite(v)) tgt[k] = v; });
      kick();
    }
    new MutationObserver(read).observe(document.querySelector('#dc-root') || document.body, { attributes: true, subtree: true, attributeFilter: ['data-o', 'data-c', 'data-uw', 'data-lw'], childList: true });

    // ---------- projection ----------
    var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, F = 0;
    var REST = -0.42, cam = { yaw: reduce ? REST : -1.25, pitch: 0.2 }, aim = { yaw: REST, pitch: 0.2 };
    var DIST = 14, TALL = 7, P0 = 0, P1 = 102;
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      cx = W * 0.42; cy = H * 0.5;
      F = Math.min(W * 2.4, H * 1.9);
      kick();
    }
    function proj(x, y, z, o) {
      var c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
      var x1 = x * c - z * s, z1 = x * s + z * c, yc = y - TALL / 2;
      var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var y2 = yc * cp - z1 * sp, z2 = yc * sp + z1 * cp;
      var dep = DIST - z2;
      o = o || [0, 0];
      o[0] = cx + F * x1 / dep; o[1] = cy - F * y2 / dep;
      return o;
    }
    var yOf = function (p) { return (p - P0) / (P1 - P0) * TALL; };
    var pOfScreen = function (sy) { // screen y back to price, on the candle's axis
      var a = proj(0, 0, 0)[1], b = proj(0, TALL, 0)[1];
      return P0 + (a - sy) / (a - b) * (P1 - P0);
    };

    // light from the upper left, slightly in front (camera space: x right, y up, z towards viewer)
    var L = (function () { var v = [-0.55, 0.62, 0.56], m = Math.hypot(v[0], v[1], v[2]); return [v[0] / m, v[1] / m, v[2] / m]; })();
    function shade(rgb, nx, ny, nz, a) {
      var c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
      var rx = nx * c - nz * s, rz = nx * s + nz * c;
      var dif = Math.max(0, rx * L[0] + ny * L[1] + rz * L[2]);
      var k = 0.28 + 0.78 * dif;
      return 'rgba(' + Math.round(rgb[0] * k) + ',' + Math.round(rgb[1] * k) + ',' + Math.round(rgb[2] * k) + ',' + a + ')';
    }
    function quad(pts, fill, stroke) {
      var a = 0;
      for (var i = 0; i < 4; i++) { var p = pts[i], q = pts[(i + 1) % 4]; a += p[0] * q[1] - q[0] * p[1]; }
      if (a >= 0) return; // turned away (canvas y runs down)
      ctx.beginPath(); ctx.moveTo(pts[0][0], pts[0][1]);
      for (i = 1; i < 4; i++) ctx.lineTo(pts[i][0], pts[i][1]);
      ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.stroke(); }
    }
    function prism(hw, y0, y1, rgb, alpha, edge) {
      var P = function (x, y, z) { return proj(x, y, z, [0, 0]); };
      var A = P(-hw, y0, hw), B = P(hw, y0, hw), C = P(hw, y1, hw), D = P(-hw, y1, hw);
      var E = P(-hw, y0, -hw), Fq = P(hw, y0, -hw), G = P(hw, y1, -hw), Hq = P(-hw, y1, -hw);
      quad([Fq, E, Hq, G], shade(rgb, 0, 0, -1, alpha), edge);
      quad([E, A, D, Hq], shade(rgb, -1, 0, 0, alpha), edge);
      quad([B, Fq, G, C], shade(rgb, 1, 0, 0, alpha), edge);
      quad([E, Fq, B, A], shade(rgb, 0, -1, 0, alpha), edge);
      quad([D, C, G, Hq], shade(rgb, 0, 1, 0, alpha), edge);
      quad([A, B, C, D], shade(rgb, 0, 0, 1, alpha), edge);
    }

    var grab = null, hoverLv = null;
    function levels() {
      var hi = Math.max(cur.o, cur.c) + cur.uw, lo = Math.min(cur.o, cur.c) - cur.lw;
      return [{ k: 'high', p: hi, t: 'HIGH' }, { k: 'open', p: cur.o, t: 'OPEN' }, { k: 'close', p: cur.c, t: 'CLOSE' }, { k: 'low', p: lo, t: 'LOW' }];
    }

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      var up = cur.c >= cur.o, rgb = up ? UP : DN;
      var p = [0, 0], q = [0, 0], i;

      // floor: a ring of fine lines and a soft pool of the candle's colour
      var g0 = proj(0, 0, 0);
      var gl = ctx.createRadialGradient(g0[0], g0[1], 2, g0[0], g0[1], W * 0.42);
      gl.addColorStop(0, 'rgba(' + rgb.join(',') + ',0.10)'); gl.addColorStop(1, 'rgba(' + rgb.join(',') + ',0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);
      for (var r = 1; r <= 4; r++) {
        ctx.beginPath();
        for (i = 0; i <= 48; i++) { var a = i / 48 * Math.PI * 2; proj(Math.cos(a) * r * 0.75, 0, Math.sin(a) * r * 0.75, p); if (i) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }
        ctx.strokeStyle = 'rgba(' + IV + ',' + (0.09 - r * 0.015).toFixed(3) + ')'; ctx.lineWidth = 1; ctx.stroke();
      }

      // wick, then body
      var lv = levels(), yH = yOf(lv[0].p), yL = yOf(lv[3].p);
      var yT = yOf(Math.max(cur.o, cur.c)), yB = yOf(Math.min(cur.o, cur.c));
      if (yT - yB < 0.06) { var mid = (yT + yB) / 2; yT = mid + 0.03; yB = mid - 0.03; }
      var wickRGB = [Math.min(255, rgb[0] + 30), Math.min(255, rgb[1] + 30), Math.min(255, rgb[2] + 30)];
      prism(0.055, yH, yT, wickRGB, 0.95, null);
      prism(0.055, yL, yB, wickRGB, 0.95, null);
      prism(0.44, yB, yT, rgb, 0.96, 'rgba(' + IV + ',0.18)');

      // level guides on the right, with grab handles
      var right = proj(0.44, 0, 0.44)[0];
      var lx = Math.max(right + 26, W * 0.62);
      ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace"; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      var used = [];
      lv.forEach(function (l) {
        proj(0, yOf(l.p), 0, p);
        var on = grab === l.k || hoverLv === l.k;
        var ty = p[1];
        // keep labels from sitting on top of each other when levels are close
        used.forEach(function (u) { if (Math.abs(ty - u) < 14) ty = u + (ty >= u ? 14 : -14); });
        used.push(ty);
        ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(' + (on ? GOLD : IV) + ',' + (on ? 0.9 : 0.28) + ')'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(right + 6, p[1]); ctx.lineTo(lx - 8, ty); ctx.stroke(); ctx.setLineDash([]);
        ctx.beginPath(); ctx.arc(lx, ty, on ? 5 : 3.5, 0, Math.PI * 2);
        ctx.fillStyle = on ? 'rgba(' + GOLD + ',1)' : BG; ctx.fill();
        ctx.strokeStyle = 'rgba(' + GOLD + ',' + (on ? 1 : 0.7) + ')'; ctx.lineWidth = 1.4; ctx.stroke();
        ctx.fillStyle = 'rgba(' + (on ? GOLD : IV) + ',' + (on ? 1 : 0.72) + ')';
        ctx.fillText(l.t, lx + 12, ty);
        l.sy = p[1]; l.ty = ty; l.lx = lx;
      });
      handles = lv;
    }
    var handles = [];

    // ---------- loop: only while something is moving ----------
    var running = false, raf = 0, to = 0;
    function frame() {
      running = false;
      var k = reduce || grab ? 1 : 0.2, moving = false;
      ['o', 'c', 'uw', 'lw'].forEach(function (key) {
        var dv = tgt[key] - cur[key];
        if (Math.abs(dv) > 0.02) { cur[key] += dv * k; moving = true; } else cur[key] = tgt[key];
      });
      var ky = reduce ? 1 : 0.07;
      cam.yaw += (aim.yaw - cam.yaw) * ky; cam.pitch += (aim.pitch - cam.pitch) * ky;
      if (Math.abs(aim.yaw - cam.yaw) + Math.abs(aim.pitch - cam.pitch) > 0.0008) moving = true;
      draw();
      if (moving) kick();
    }
    function tick() { cancelAnimationFrame(raf); clearTimeout(to); frame(); }
    function kick() { if (running) return; running = true; raf = requestAnimationFrame(tick); to = setTimeout(tick, 120); }

    // ---------- writing back through the page's own sliders ----------
    function slider(label) { return document.querySelector('#dc-root input[type=range][aria-label="' + label + '"]'); }
    function put(label, v) {
      var el = slider(label); if (!el) return;
      var s = String(Math.round(v));
      if (el.value === s) return;
      el.value = s; el.dispatchEvent(new Event('input', { bubbles: true }));
    }
    function dragTo(sy) {
      var pr = pOfScreen(sy);
      var o = tgt.o, c = tgt.c;
      if (grab === 'open') put('Open price', clamp(pr, 15, 85));
      else if (grab === 'close') put('Close price', clamp(pr, 15, 85));
      else if (grab === 'high') put('Top wick', clamp(pr - Math.max(o, c), 0, 15));
      else if (grab === 'low') put('Bottom wick', clamp(Math.min(o, c) - pr, 0, 15));
    }
    function levelAt(px, py) {
      var best = null, bd = 18;
      handles.forEach(function (l) {
        var d1 = Math.abs(py - l.ty) + (px > l.lx - 30 ? 0 : 6);      // on the label or handle
        var d2 = Math.abs(py - l.sy) + (Math.abs(px - cx) < W * 0.14 ? 2 : 40); // on the candle itself
        var d = Math.min(d1, d2);
        if (d < bd) { bd = d; best = l.k; }
      });
      return best;
    }
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      if (grab) { dragTo(py); e.preventDefault(); return; }
      if (!reduce && fine) { aim.yaw = REST + ((px / r.width) - 0.5) * 0.9; aim.pitch = 0.2 + ((py / r.height) - 0.5) * 0.12; }
      var h = levelAt(px, py);
      if (h !== hoverLv) { hoverLv = h; host.style.cursor = h ? 'ns-resize' : ''; }
      kick();
    });
    host.addEventListener('pointerleave', function () { if (!grab) { hoverLv = null; aim.yaw = REST; aim.pitch = 0.2; kick(); } });
    host.addEventListener('pointerdown', function (e) {
      var r = host.getBoundingClientRect(), px = e.clientX - r.left, py = e.clientY - r.top;
      var h = levelAt(px, py);
      if (!h) return;
      grab = h; hoverLv = h; host.setPointerCapture(e.pointerId); e.preventDefault(); dragTo(py); kick();
    });
    function end() { if (!grab) return; grab = null; kick(); }
    host.addEventListener('pointerup', end);
    host.addEventListener('pointercancel', end);

    addEventListener('resize', resize);
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) kick(); }).observe(host);
    resize(); read(); cur.o = tgt.o; cur.c = tgt.c; cur.uw = tgt.uw; cur.lw = tgt.lw; kick();
  });

  // ---------- film strip arrows ----------
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-strip]') : null;
    if (!b) return;
    var s = document.querySelector('#dc-root #strip');
    if (!s) return;
    var dir = b.getAttribute('data-strip') === 'next' ? 1 : -1;
    s.scrollBy({ left: dir * s.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
