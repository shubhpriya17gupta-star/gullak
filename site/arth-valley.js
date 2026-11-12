/* Gullak Recovery: "The Valley".
   A 3D ridge-line canyon drawn on a 2D canvas. The front ridge is the user's own result:
   a plateau at the starting value, the fall (its run is proportional to the fall %),
   the valley floor (what is left), and the climb back (its run is proportional to the
   gain % needed, and it curves the way compounding does). Ridges behind it give depth.
   The valley floor can be dragged (or moved with the arrow keys) to set the fall.
   All figures come from the page's exact BigInt engine through data attributes;
   this file only draws them. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var BG = '#111316', ROSE = '233,160,160', GOLD = '210,180,124', IV = '244,241,234';
  var MONO = "500 12px 'Geist Mono', ui-monospace, monospace";

  function ready(fn) {
    var n = 0;
    (function check() {
      var el = document.querySelector('#dc-root #valley');
      if (el) return fn(el);
      if (n++ < 600) setTimeout(check, 40);
    })();
  }

  ready(function (host) {
    var canvas = document.createElement('canvas');
    canvas.setAttribute('aria-hidden', 'true');
    host.insertBefore(canvas, host.firstChild);
    var ctx = canvas.getContext('2d');
    if (!ctx) return;

    // ---------- state read from the page ----------
    var d = {};
    function read() {
      var h = document.querySelector('#dc-root #valley') || host;
      if (h !== host) { host = h; host.insertBefore(canvas, host.firstChild); resize(); }
      d.state = host.getAttribute('data-state') || 'empty';
      d.mode = host.getAttribute('data-mode') || 'pct';
      d.fall = parseFloat(host.getAttribute('data-fall')) || 0;
      d.gain = parseFloat(host.getAttribute('data-gain')) || 0;
      d.years = parseInt(host.getAttribute('data-years'), 10) || 0;
      d.rate = parseFloat(host.getAttribute('data-rate')) || 0;
      d.start = host.getAttribute('data-start') || '';
      d.floor = host.getAttribute('data-floor') || '';
      d.fallText = host.getAttribute('data-falltext') || '';
      d.gainText = host.getAttribute('data-gaintext') || '';
      // target shape: an empty page shows a quiet 25% example; "nothing left" drops to zero
      var f = d.state === 'ok' ? d.fall / 100 : d.state === 'message' ? 1 : 0.25;
      tgt.f = clamp(f, 0, 1);
      tgt.g = d.state === 'ok' ? d.gain / 100 : d.state === 'message' ? 0 : 1 / 3;
      tgt.on = d.state === 'empty' ? 0 : 1;
      host.setAttribute('aria-valuenow', d.state === 'ok' ? d.fall.toFixed(2) : '0');
      host.setAttribute('aria-valuetext', d.state === 'ok' ? ('Fall ' + d.fallText + ', gain needed ' + d.gainText) : 'No fall entered');
      kick();
    }
    var tgt = { f: 0.25, g: 1 / 3, on: 0 };
    var cur = { f: 0.25, g: 1 / 3, on: 0 };
    new MutationObserver(read).observe(document.querySelector('#dc-root') || document.body, { attributes: true, subtree: true, attributeFilter: ['data-fall', 'data-gain', 'data-state', 'data-years', 'data-rate', 'data-mode', 'data-start', 'data-floor'], childList: true });

    // ---------- projection ----------
    var W = 0, H = 0, dpr = 1, cx = 0, cy = 0, F = 0, narrow = false;
    var cam = { yaw: -0.18, pitch: 0.36, dist: 15 };
    var aim = { yaw: -0.18, pitch: 0.36 };
    function resize() {
      W = host.clientWidth; H = host.clientHeight;
      dpr = Math.min(devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      narrow = W < 600;
      cx = W * 0.5; cy = H * (narrow ? 0.64 : 0.54);
      F = narrow ? Math.min(W * 1.32, H * 2.1) : Math.min(W * 1.05, H * 2.1);
      kick();
    }
    function proj(x, y, z, o) {
      var c = Math.cos(cam.yaw), s = Math.sin(cam.yaw);
      var x1 = x * c - z * s, z1 = x * s + z * c, yc = y - 1.6;
      var cp = Math.cos(cam.pitch), sp = Math.sin(cam.pitch);
      var y2 = yc * cp - z1 * sp, z2 = yc * sp + z1 * cp;
      var dep = cam.dist - z2;
      o[0] = cx + F * x1 / dep; o[1] = cy - F * y2 / dep;
      return o;
    }

    // ---------- the valley profile ----------
    // x runs from -5 to 5. Plateau, fall, floor, climb, plateau.
    var Y0 = 3.2, N = 140;
    function profile(f, g, u) { // u in 0..1 across the width -> height
      var plat = 0.12, flat = 0.03;
      var avail = 1 - 2 * plat - flat;
      var tot = Math.max(f + g, 1e-6);
      var rf = Math.max(0.03, avail * f / tot), rg = Math.max(0.03, avail - rf);
      if (f <= 0.0001) return Y0;
      var a = plat, b = a + rf, c = b + flat, e = c + rg;
      var yf = Y0 * (1 - Math.min(f, 0.999));
      if (u <= a) return Y0;
      if (u <= b) { var t = (u - a) / rf; return lerp(Y0, yf, 0.5 - 0.5 * Math.cos(Math.PI * t)); }
      if (u <= c) return yf;
      if (u <= e) {
        var t2 = (u - c) / rg;
        if (f >= 0.999) return yf + (Y0 * 0.04) * t2; // nothing left: no way back up
        return yf * Math.pow(Y0 / yf, t2);           // compounding climb
      }
      return f >= 0.999 ? yf + Y0 * 0.04 : Y0;
    }
    function keyPoints(f, g) {
      var plat = 0.12, flat = 0.03, avail = 1 - 2 * plat - flat, tot = Math.max(f + g, 1e-6);
      var rf = Math.max(0.03, avail * f / tot), rg = Math.max(0.03, avail - rf);
      var a = plat, b = a + rf, c = b + flat, e = c + rg;
      return { a: a, b: b, c: c, e: e, rf: rf, rg: rg };
    }

    var RIDGES = 12;
    var A = new Float32Array(N * 2), B = new Float32Array(N * 2), tmp = [0, 0];
    var start = performance.now();
    var handle = { x: -1, y: -1, top: 0, bottom: 0 };

    function draw() {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      var intro = reduce ? 1 : clamp((performance.now() - start - 150) / 1400, 0, 1);
      var f = cur.f, g = cur.g;

      // soft light pooled in the valley floor
      var kp = keyPoints(f, g);
      var floorU = (kp.b + kp.c) / 2;
      proj((floorU - 0.5) * 10, Y0 * (1 - Math.min(f, 0.999)), 0, tmp);
      var gl = ctx.createRadialGradient(tmp[0], tmp[1], 4, tmp[0], tmp[1], Math.max(W, H) * 0.45);
      gl.addColorStop(0, 'rgba(' + GOLD + ',' + (0.14 * intro).toFixed(3) + ')');
      gl.addColorStop(1, 'rgba(' + GOLD + ',0)');
      ctx.fillStyle = gl; ctx.fillRect(0, 0, W, H);

      // ridges back to front; each one masks what is behind it
      for (var k = RIDGES - 1; k >= 0; k--) {
        var z = -k * 0.62;
        var lift = k * 0.18, rough = k === 0 ? 0 : 0.06 + k * 0.012;
        var reveal = clamp(intro * 1.5 - (k / RIDGES) * 0.5, 0, 1);
        if (reveal <= 0) continue;
        var m = Math.max(2, Math.round(reveal * N));
        for (var j = 0; j < N; j++) {
          var u = j / (N - 1);
          var y = profile(f, g, u) + lift + rough * Math.sin(u * 17 + k * 1.7) * Math.sin(u * 5.3 - k);
          proj((u - 0.5) * 10, y, z, tmp); A[j * 2] = tmp[0]; A[j * 2 + 1] = tmp[1];
          proj((u - 0.5) * 10, -0.4, z, tmp); B[j * 2] = tmp[0]; B[j * 2 + 1] = tmp[1];
        }
        ctx.beginPath(); ctx.moveTo(B[0], B[1]);
        for (j = 0; j < m; j++) ctx.lineTo(A[j * 2], A[j * 2 + 1]);
        ctx.lineTo(B[(m - 1) * 2], B[(m - 1) * 2 + 1]); ctx.closePath();
        if (k === 0) {
          var fg = ctx.createLinearGradient(0, cy - H * 0.3, 0, H);
          fg.addColorStop(0, 'rgba(26,28,32,1)'); fg.addColorStop(1, BG);
          ctx.fillStyle = fg;
        } else ctx.fillStyle = BG;
        ctx.fill();
        if (k > 0) {
          ctx.beginPath(); ctx.moveTo(A[0], A[1]);
          for (j = 1; j < m; j++) ctx.lineTo(A[j * 2], A[j * 2 + 1]);
          ctx.strokeStyle = 'rgba(' + IV + ',' + (lerp(0.34, 0.07, k / (RIDGES - 1))).toFixed(3) + ')';
          ctx.lineWidth = 1; ctx.stroke();
        } else {
          // front ridge in three colours: plateau, fall (rose), climb (champagne)
          var seg = function (u0, u1, col, w) {
            var j0 = Math.max(0, Math.floor(u0 * (N - 1))), j1 = Math.min(m - 1, Math.ceil(u1 * (N - 1)));
            if (j1 <= j0) return;
            ctx.beginPath(); ctx.moveTo(A[j0 * 2], A[j0 * 2 + 1]);
            for (var q = j0 + 1; q <= j1; q++) ctx.lineTo(A[q * 2], A[q * 2 + 1]);
            ctx.strokeStyle = col; ctx.lineWidth = w; ctx.stroke();
          };
          var on = cur.on;
          seg(0, kp.a, 'rgba(' + IV + ',' + lerp(0.4, 0.85, on).toFixed(3) + ')', 1.6);
          seg(kp.a, kp.c, 'rgba(' + ROSE + ',' + lerp(0.35, 0.95, on).toFixed(3) + ')', 2.2);
          seg(kp.c, kp.e, 'rgba(' + GOLD + ',' + lerp(0.35, 1, on).toFixed(3) + ')', 2.4);
          seg(kp.e, 1, 'rgba(' + IV + ',' + lerp(0.4, 0.85, on).toFixed(3) + ')', 1.6);
        }
      }
      if (intro < 1) return;

      // the starting level, carried across the valley as a dashed line
      var p0 = proj(-5, Y0, 0, [0, 0]), p1 = proj(5, Y0, 0, [0, 0]);
      ctx.setLineDash([3, 6]); ctx.strokeStyle = 'rgba(' + IV + ',0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]); ctx.lineTo(p1[0], p1[1]); ctx.stroke(); ctx.setLineDash([]);

      var la = cur.on;
      ctx.font = MONO; ctx.textBaseline = 'bottom';
      // start label
      var ps = proj(-5 + 0.4, Y0, 0, [0, 0]);
      ctx.textAlign = 'left'; ctx.fillStyle = 'rgba(' + IV + ',' + (0.4 + 0.45 * la).toFixed(3) + ')';
      ctx.fillText(d.state === 'ok' ? 'START · ' + d.start : 'START', ps[0], ps[1] - 10);

      // floor handle and label
      var fx = (floorU - 0.5) * 10, fy = Y0 * (1 - Math.min(f, 0.999));
      var ph = proj(fx, fy, 0, [0, 0]);
      var top = proj(fx, Y0, 0, [0, 0]), bot = proj(fx, 0, 0, [0, 0]);
      handle.x = ph[0]; handle.y = ph[1]; handle.top = top[1]; handle.bottom = bot[1];
      ctx.setLineDash([2, 4]); ctx.strokeStyle = 'rgba(' + ROSE + ',' + (0.25 + 0.4 * la).toFixed(3) + ')';
      ctx.beginPath(); ctx.moveTo(top[0], top[1]); ctx.lineTo(ph[0], ph[1]); ctx.stroke(); ctx.setLineDash([]);
      var canDrag = canDragNow();
      ctx.beginPath(); ctx.arc(ph[0], ph[1], dragging ? 9 : 7, 0, Math.PI * 2);
      ctx.fillStyle = BG; ctx.fill();
      ctx.strokeStyle = 'rgba(' + ROSE + ',0.95)'; ctx.lineWidth = 2; ctx.stroke();
      if (canDrag) { ctx.beginPath(); ctx.arc(ph[0], ph[1], 2.5, 0, Math.PI * 2); ctx.fillStyle = 'rgba(' + ROSE + ',0.95)'; ctx.fill(); }
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      ctx.fillStyle = 'rgba(' + IV + ',' + (0.45 + 0.45 * la).toFixed(3) + ')';
      ctx.fillText(d.state === 'ok' ? 'LEFT · ' + d.floor : d.state === 'message' ? 'NOTHING LEFT' : (canDrag ? 'DRAG THE FLOOR' : ''), ph[0], ph[1] + 16);

      if (d.state === 'ok' && f > 0.0001) {
        // fall and climb labels, placed on their own slopes
        var mf = proj(((kp.a + kp.b) / 2 - 0.5) * 10, profile(f, g, (kp.a + kp.b) / 2), 0, [0, 0]);
        var mg = proj(((kp.c + kp.e) / 2 - 0.5) * 10, profile(f, g, (kp.c + kp.e) / 2), 0, [0, 0]);
        ctx.font = "600 13px 'Geist Mono', ui-monospace, monospace";
        ctx.textAlign = 'right'; ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(' + ROSE + ',1)'; ctx.fillText('−' + d.fallText, mf[0] - 12, mf[1]);
        // the climb label sits on the sky side of the rising slope, clear of the year marks below it
        // (on phones the start label is in the way, so it goes under the slope instead)
        ctx.fillStyle = 'rgba(' + GOLD + ',1)';
        if (narrow) { ctx.textAlign = 'left'; ctx.textBaseline = 'top'; ctx.fillText('+' + d.gainText, mg[0] + 8, mg[1] + 10); }
        else { ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillText('+' + d.gainText, mg[0] - 10, mg[1] - 10); }

        // years along the climb, when a yearly return was entered
        if (d.years > 0 && d.rate > 0) {
          var lnNeed = Math.log(1 / (1 - Math.min(f, 0.999)));
          var lnStep = Math.log(1 + d.rate / 100);
          var every = d.years > 30 ? 10 : d.years > 12 ? 5 : 1;
          ctx.font = "500 11px 'Geist Mono', ui-monospace, monospace"; ctx.textAlign = 'center'; ctx.textBaseline = 'top';
          var lastP = proj((kp.c + kp.rg * Math.min(1, (d.years * lnStep) / lnNeed) - 0.5) * 10, profile(f, g, kp.c + kp.rg * Math.min(1, (d.years * lnStep) / lnNeed)), 0, [0, 0]);
          for (var yr = 1; yr <= d.years; yr++) {
            var t3 = Math.min(1, (yr * lnStep) / lnNeed);
            var uu = kp.c + kp.rg * t3;
            var pp = proj((uu - 0.5) * 10, profile(f, g, uu), 0, [0, 0]);
            ctx.beginPath(); ctx.arc(pp[0], pp[1], yr === d.years ? 4 : 2.4, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(' + GOLD + ',' + (yr === d.years ? 1 : 0.75) + ')'; ctx.fill();
            if (yr === d.years || (!narrow && yr % every === 0 && Math.abs(pp[0] - lastP[0]) > 34)) {
              ctx.fillStyle = 'rgba(' + IV + ',0.7)';
              ctx.fillText(yr === d.years ? 'YEAR ' + yr : String(yr), pp[0], pp[1] + 9);
            }
          }
        }
      }
    }

    // ---------- loop: only while something is moving ----------
    var running = false, raf = 0, to = 0;
    function frame() {
      running = false;
      var k = reduce ? 1 : 0.14;
      cur.f += (tgt.f - cur.f) * k; cur.g += (tgt.g - cur.g) * k; cur.on += (tgt.on - cur.on) * k;
      cam.yaw += (aim.yaw - cam.yaw) * 0.08; cam.pitch += (aim.pitch - cam.pitch) * 0.08;
      draw();
      var moving = Math.abs(tgt.f - cur.f) > 0.0005 || Math.abs(tgt.g - cur.g) > 0.0005 || Math.abs(tgt.on - cur.on) > 0.002
        || Math.abs(aim.yaw - cam.yaw) > 0.0005 || Math.abs(aim.pitch - cam.pitch) > 0.0005
        || (!reduce && performance.now() - start < 1700);
      if (moving) kick();
    }
    function tick() { cancelAnimationFrame(raf); clearTimeout(to); frame(); }
    function kick() { if (running) return; running = true; raf = requestAnimationFrame(tick); to = setTimeout(tick, 120); }

    // ---------- pointer: gentle parallax, and dragging the floor ----------
    var dragging = false;
    var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    host.addEventListener('pointermove', function (e) {
      var r = host.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      if (!reduce && fine && !dragging) {
        aim.yaw = -0.18 + ((px / r.width) - 0.5) * 0.22;
        aim.pitch = 0.36 + ((py / r.height) - 0.5) * 0.08;
      }
      if (dragging) setFallFromY(py);
      else host.style.cursor = (canDragNow() && Math.hypot(px - handle.x, py - handle.y) < 28) ? 'grab' : '';
      kick();
    });
    host.addEventListener('pointerleave', function () { if (!dragging) { aim.yaw = -0.18; aim.pitch = 0.36; kick(); } });
    host.addEventListener('pointerdown', function (e) {
      if (!canDragNow()) return;
      var r = host.getBoundingClientRect();
      var px = e.clientX - r.left, py = e.clientY - r.top;
      if (Math.hypot(px - handle.x, py - handle.y) > 34 && !(Math.abs(px - handle.x) < 40 && py > handle.top - 10 && py < handle.bottom + 10)) return;
      dragging = true; host.setPointerCapture(e.pointerId); host.style.cursor = 'grabbing';
      setFallFromY(py); e.preventDefault();
    });
    function endDrag() { if (!dragging) return; dragging = false; host.style.cursor = ''; kick(); }
    host.addEventListener('pointerup', endDrag);
    host.addEventListener('pointercancel', endDrag);

    function setFallFromY(py) {
      var span = handle.bottom - handle.top;
      if (span <= 0) return;
      var fall = clamp((py - handle.top) / span, 0, 0.99);
      writeFall(Math.round(fall * 1000) / 10);
    }
    // amounts mode: the starting amount the user typed, in paise (BigInt), or null
    function origPaise() {
      var o = document.querySelector('#dc-root #in-orig');
      var t = o ? o.value.replace(/[,\s]/g, '') : '';
      var mm = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(t);
      if (!mm) return null;
      var p = BigInt(mm[1]) * 100n + BigInt(((mm[2] || '') + '00').slice(0, 2));
      return p > 0n ? p : null;
    }
    function canDragNow() { return d.mode === 'pct' || (d.mode === 'amt' && origPaise() !== null); }
    function writeFall(pct) {
      if (d.mode === 'amt') {
        // value now = start x (1 - fall), exact in paise, rounded down; fall in tenths of a percent
        var op = origPaise(), ci = document.querySelector('#dc-root #in-cur');
        if (op === null || !ci) return;
        var tenths = BigInt(Math.max(0, Math.min(999, Math.round(pct * 10))));
        var np = op * (1000n - tenths) / 1000n;
        var rs = (np / 100n).toString(), ps = (np % 100n).toString().padStart(2, '0');
        var cv = ps === '00' ? rs : rs + '.' + ps;
        if (ci.value === cv) return;
        ci.value = cv;
        ci.dispatchEvent(new Event('input', { bubbles: true }));
        return;
      }
      var inp = document.querySelector('#dc-root #in-loss');
      if (!inp) return;
      var v = pct <= 0 ? '0' : (Math.round(pct * 10) / 10).toString();
      if (inp.value === v) return;
      inp.value = v;
      inp.dispatchEvent(new Event('input', { bubbles: true }));
    }
    host.addEventListener('keydown', function (e) {
      if (!canDragNow()) return;
      var now = d.state === 'ok' ? d.fall : 0;
      var step = e.shiftKey ? 10 : 1, nv = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') nv = now + step;
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') nv = now - step;
      else if (e.key === 'Home') nv = 0;
      else if (e.key === 'End') nv = 99;
      if (nv === null) return;
      e.preventDefault();
      writeFall(clamp(Math.round(nv), 0, 99));
    });

    // "Common falls" rows load their fall into the valley (switching to percentage entry if needed)
    document.addEventListener('click', function (e) {
      var b = e.target.closest ? e.target.closest('[data-setfall]') : null;
      if (!b) return;
      var v = parseFloat(b.getAttribute('data-setfall'));
      if (!(v >= 0)) return;
      var go = function () {
        writeFall(v);
        var sc = document.querySelector('#dc-root .scene');
        if (sc && sc.getBoundingClientRect().top < 0) sc.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
      };
      if (d.mode !== 'pct') { var pb = document.querySelector('#dc-root #mode-pct'); if (pb) pb.click(); setTimeout(go, 60); }
      else go();
    });

    addEventListener('resize', resize);
    new IntersectionObserver(function (es) { if (es[0].isIntersecting) kick(); }).observe(host);
    resize(); read(); cur.f = tgt.f; cur.g = tgt.g; kick();
  });
})();
