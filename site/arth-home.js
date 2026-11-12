// Gullak home: the "compounding ridges".
// 25 fine lines, one per annual rate from 4% (front) to 16% (back), drawn left to right
// over 0–10 years in a slowly turning 3D view with hidden-line removal.
// Scroll takes them from jittery market noise to the exact compounding curves of
// ₹1,00,000. Pointing at a line reads out its exact value (BigInt paise, half-up,
// the same method as the rest of the site). Plain 2D canvas: no WebGL, no libraries.

const D = 10000n;
const IN = new Intl.NumberFormat('en-IN');
function fvPaise(pv, bp, t) {
  const num = pv * (D + BigInt(bp)) ** BigInt(t);
  const den = D ** BigInt(t);
  return (2n * num + den) / (2n * den);
}
function rs0(p) { let r = p / 100n; if (p % 100n >= 50n) r += 1n; return '₹' + IN.format(r); }

const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function waitFor(sel) {
  return new Promise((res) => {
    const f = () => { const el = document.querySelector(sel); if (el) return res(el); setTimeout(f, 40); };
    f();
  });
}

(async function main() {
  let host = await waitFor('#dc-root #hero-gl');
  let pin = await waitFor('#dc-root #hero-pin');
  let readout = document.querySelector('#dc-root #hero-readout');
  const root = document.documentElement;

  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  const ctx = canvas.getContext('2d');
  if (!ctx) { root.classList.add('no-gl'); return; }
  host.appendChild(canvas);

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = matchMedia('(pointer: coarse)').matches;

  // Palette (matches the page: graphite, ivory, champagne)
  const BG = '#111316';
  const IVORY = [244, 241, 234];
  const GOLD = 'rgba(210,180,124,0.95)';
  const MONO = "500 11px 'Geist Mono', ui-monospace, monospace";

  // Data: rates in basis points, 4.0% … 16.0% in 0.5% steps; years 0 … 10
  const rates = []; for (let bp = 400; bp <= 1600; bp += 50) rates.push(bp);
  const YEARS = 10, N = 96;
  const PV = 10000000n; // ₹1,00,000 in paise
  const maxG = Math.pow(1.16, YEARS) - 1;
  const lines = rates.map((bp, i) => ({
    bp, i, gold: bp === 1000,
    z: lerp(3.2, -3.2, i / (rates.length - 1)),      // 4% in front, 16% at the back
    ph: [Math.random() * 6.28, Math.random() * 6.28, Math.random() * 6.28],
    pts: new Float32Array(N * 2), base: new Float32Array(N * 2)
  }));
  const shape = (bp, t) => (Math.pow(1 + bp / 10000, t) - 1) / maxG; // 0 … 1, display only
  const noise = (ln, t, tm) => 0.3
    + 0.14 * Math.sin(t * 1.9 + ln.ph[0] + tm * 0.55)
    + 0.07 * Math.sin(t * 4.7 + ln.ph[1] - tm * 0.9)
    + 0.035 * Math.sin(t * 10.3 + ln.ph[2] + tm * 1.6);

  // Camera keyframes over the hero's scroll progress
  const K = [
    { p: 0.0, yaw: -0.62, pitch: 0.44, dist: 15.5 },
    { p: 0.4, yaw: 0.34, pitch: 0.3, dist: 14.0 },
    { p: 0.7, yaw: 0.12, pitch: 0.26, dist: 14.5 },
    { p: 1.0, yaw: 0.02, pitch: 0.34, dist: 16.0 }
  ];
  function camAt(p) {
    let a = K[0], b = K[K.length - 1];
    for (let i = 0; i < K.length - 1; i++) if (p >= K[i].p && p <= K[i + 1].p) { a = K[i]; b = K[i + 1]; }
    const t = smooth(a.p, b.p, p);
    return { yaw: lerp(a.yaw, b.yaw, t), pitch: lerp(a.pitch, b.pitch, t), dist: lerp(a.dist, b.dist, t) };
  }

  let W = 0, H = 0, dpr = 1, cx = 0, cy = 0, f = 0;
  function resize() {
    W = host.clientWidth; H = host.clientHeight;
    dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    if (W >= 900) { cx = W * 0.6; cy = H * 0.5; f = Math.min(W * 0.6, H * 1.25); }
    else { cx = W * 0.5; cy = H * 0.34; f = W * 1.45; }
    drawn = false;
  }

  const cam = { yaw: K[0].yaw, pitch: K[0].pitch, dist: K[0].dist };
  const HEIGHT = 3.8, TY = 1.3;
  function project(x, y, z, out, k) {
    const cyw = Math.cos(cam.yaw), syw = Math.sin(cam.yaw);
    const x1 = x * cyw - z * syw, z1 = x * syw + z * cyw;
    const yc = y - TY;
    const cp = Math.cos(cam.pitch), spt = Math.sin(cam.pitch);
    const y2 = yc * cp - z1 * spt, z2 = yc * spt + z1 * cp;
    const depth = cam.dist - z2;
    out[k] = cx + f * x1 / depth;
    out[k + 1] = cy - f * y2 / depth;
  }

  // Input
  const mouse = { x: 0, y: 0, sx: 0, sy: 0, px: -1, py: -1, inside: false };
  document.addEventListener('pointermove', (e) => {
    const r = canvas.getBoundingClientRect();
    mouse.x = ((e.clientX - r.left) / r.width) * 2 - 1;
    mouse.y = ((e.clientY - r.top) / r.height) * 2 - 1;
    mouse.px = e.clientX - r.left; mouse.py = e.clientY - r.top;
    mouse.inside = e.clientY >= r.top && e.clientY <= r.bottom;
    if (visible) loop();
  });
  document.addEventListener('pointerleave', () => { mouse.inside = false; mouse.x = 0; mouse.y = 0; loop(); });

  function progress() {
    const r = pin.getBoundingClientRect();
    const span = r.height - innerHeight;
    return span > 0 ? clamp(-r.top / span, 0, 1) : 0;
  }

  let visible = true, drawn = false, running = false;
  new IntersectionObserver((es) => { visible = es[0].isIntersecting; if (visible) loop(); }, { threshold: 0 }).observe(pin);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) loop(); });
  addEventListener('resize', () => { resize(); loop(); });
  resize();

  function reattach() {
    const h = document.querySelector('#dc-root #hero-gl');
    if (h && h !== host) { host = h; pin = document.querySelector('#dc-root #hero-pin'); readout = document.querySelector('#dc-root #hero-readout'); host.appendChild(canvas); resize(); }
  }

  const start = performance.now();
  let last = start, tm = 0, s = 0, hovered = null, hoverYear = 0, lastKey = '';

  function frame() {
    running = false;
    if (!canvas.isConnected) reattach();
    if (!visible || document.hidden) return;
    const now = performance.now();
    const dt = Math.min((now - last) / 1000, 0.05); last = now;
    if (!reduce) tm += dt;

    const p = progress();
    const sTarget = reduce ? (p > 0.2 ? 1 : 0) : smooth(0.13, 0.5, p);
    s += (sTarget - s) * (reduce ? 1 : 0.08);
    const c = camAt(p);
    mouse.sx += (mouse.x - mouse.sx) * 0.06; mouse.sy += (mouse.y - mouse.sy) * 0.06;
    const k = reduce ? 1 : 0.07;
    const gy = c.yaw + (coarse ? 0 : mouse.sx * 0.07), gp = c.pitch + (coarse ? 0 : mouse.sy * 0.035);
    cam.yaw += (gy - cam.yaw) * k; cam.pitch += (gp - cam.pitch) * k; cam.dist += (c.dist - cam.dist) * k;

    const intro = reduce ? 1 : clamp((now - start - 250) / 1600, 0, 1);

    // Geometry
    for (const ln of lines) {
      for (let j = 0; j < N; j++) {
        const t = (j / (N - 1)) * YEARS;
        const h = lerp(noise(ln, t, tm), shape(ln.bp, t), s) * HEIGHT;
        const x = (t / YEARS - 0.5) * 10;
        project(x, h, ln.z, ln.pts, j * 2);
        project(x, 0, ln.z, ln.base, j * 2);
      }
    }

    // Hover: nearest whole-year point on any line, once the shape has formed
    let hv = null, hy = 0;
    if (s > 0.85 && mouse.inside && !coarse) {
      let best = 30 * 30;
      for (const ln of lines) for (let y = 1; y <= YEARS; y++) {
        const j = Math.round((y / YEARS) * (N - 1));
        const dx = ln.pts[j * 2] - mouse.px, dy = ln.pts[j * 2 + 1] - mouse.py, d2 = dx * dx + dy * dy;
        if (d2 < best) { best = d2; hv = ln; hy = y; }
      }
    }
    hovered = hv; hoverYear = hy;

    // Draw: back to front, each line masks what is behind it
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = BG; ctx.fillRect(0, 0, W, H);
    ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const n = lines.length;
    for (let li = n - 1; li >= 0; li--) {
      const ln = lines[li];
      const reveal = clamp(intro * 1.6 - (li / n) * 0.6, 0, 1);
      if (reveal <= 0) continue;
      const m = Math.max(2, Math.round(reveal * N));
      ctx.beginPath();
      ctx.moveTo(ln.base[0], ln.base[1]);
      for (let j = 0; j < m; j++) ctx.lineTo(ln.pts[j * 2], ln.pts[j * 2 + 1]);
      ctx.lineTo(ln.base[(m - 1) * 2], ln.base[(m - 1) * 2 + 1]);
      ctx.closePath();
      ctx.fillStyle = BG; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(ln.pts[0], ln.pts[1]);
      for (let j = 1; j < m; j++) ctx.lineTo(ln.pts[j * 2], ln.pts[j * 2 + 1]);
      const depthA = lerp(0.62, 0.16, li / (n - 1));
      const dim = hovered && hovered !== ln ? 0.55 : 1;
      if (ln === hovered) { ctx.strokeStyle = 'rgba(244,241,234,0.95)'; ctx.lineWidth = 1.6; }
      else if (ln.gold) { ctx.strokeStyle = GOLD; ctx.lineWidth = 1.6; }
      else { ctx.strokeStyle = 'rgba(' + IVORY + ',' + (depthA * dim).toFixed(3) + ')'; ctx.lineWidth = 1; }
      ctx.stroke();
    }

    // Quiet axis labels once the curves have formed
    const la = smooth(0.6, 0.95, s) * intro;
    if (la > 0.01) {
      ctx.font = MONO; ctx.textBaseline = 'top';
      const front = lines[0], back = lines[n - 1], g = lines.find((l) => l.gold);
      ctx.fillStyle = 'rgba(244,241,234,' + (0.5 * la).toFixed(3) + ')';
      ctx.textAlign = 'center';
      for (let y = 0; y <= YEARS; y += 5) { const j = Math.round((y / YEARS) * (N - 1)); ctx.fillText(y === 0 ? 'YEAR 0' : String(y), front.base[j * 2], front.base[j * 2 + 1] + 10); }
      ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
      ctx.fillText('4%', front.pts[(N - 1) * 2] + 10, front.pts[(N - 1) * 2 + 1]);
      ctx.fillText('16%', back.pts[(N - 1) * 2] + 10, back.pts[(N - 1) * 2 + 1]);
      ctx.fillStyle = 'rgba(210,180,124,' + (0.95 * la).toFixed(3) + ')';
      ctx.fillText('10%', g.pts[(N - 1) * 2] + 10, g.pts[(N - 1) * 2 + 1]);
    }

    // Hover marker and readout
    if (hovered) {
      const j = Math.round((hoverYear / YEARS) * (N - 1));
      const x = hovered.pts[j * 2], y = hovered.pts[j * 2 + 1];
      ctx.strokeStyle = 'rgba(244,241,234,0.35)'; ctx.lineWidth = 1; ctx.setLineDash([2, 4]);
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(hovered.base[j * 2], hovered.base[j * 2 + 1]); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = BG; ctx.strokeStyle = hovered.gold ? GOLD : 'rgba(244,241,234,0.95)'; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(x, y, 4.5, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      if (readout) {
        const key = hovered.bp + ':' + hoverYear;
        if (key !== lastKey) { readout.textContent = (hovered.bp / 100) + '% a year · year ' + hoverYear + ' → ' + rs0(fvPaise(PV, hovered.bp, hoverYear)); lastKey = key; }
        readout.style.left = x + 'px'; readout.style.top = y + 'px';
        readout.dataset.on = '';
      }
    } else if (readout && 'on' in readout.dataset) { delete readout.dataset.on; lastKey = ''; }

    root.classList.add('gl-ready');
    drawn = true;

    // Keep animating only while something is changing
    const settling = Math.abs(sTarget - s) > 0.0005 || Math.abs(gy - cam.yaw) > 0.0004 || Math.abs(gp - cam.pitch) > 0.0004 || Math.abs(c.dist - cam.dist) > 0.002
      || Math.abs(mouse.x - mouse.sx) > 0.002 || Math.abs(mouse.y - mouse.sy) > 0.002;
    const live = !reduce && (s < 0.999 || intro < 1);
    if (settling || live) loop();
  }

  // requestAnimationFrame, with a slow timer fallback for embedded views that stall it
  let rafId = 0, toId = 0;
  function tick() { cancelAnimationFrame(rafId); clearTimeout(toId); frame(); }
  function loop() {
    if (running) return;
    running = true;
    rafId = requestAnimationFrame(tick);
    toId = setTimeout(tick, 120);
  }
  addEventListener('scroll', loop, { passive: true });
  loop();
})().catch((e) => { document.documentElement.classList.add('no-gl'); console.warn('Gullak hero animation not started:', e); });
