/* Gullak Practice: "The Trading Floor".
   The phone that shows the account-opening steps tilts gently towards the pointer, with a
   light sheen that follows it. CSS does the 3D; this file only sets two variables, and
   only while the pointer moves over the phone's area. Prices and steps all come from the page. */
(function () {
  'use strict';
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  var raf = 0, tx = 0, ty = 0, cx = 0, cy = 0, el = null;
  function step() {
    raf = 0;
    cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
    if (el) { el.style.setProperty('--rx', cy.toFixed(3)); el.style.setProperty('--ry', cx.toFixed(3)); }
    if (Math.abs(tx - cx) + Math.abs(ty - cy) > 0.002) raf = requestAnimationFrame(step);
  }
  function kick() { if (!raf) raf = requestAnimationFrame(step); }
  document.addEventListener('pointermove', function (e) {
    var area = e.target.closest ? e.target.closest('.open-grid') : null;
    var ph = document.querySelector('#dc-root .phone');
    if (!ph) return;
    el = ph;
    if (!area) { if (tx || ty) { tx = 0; ty = 0; kick(); } return; }
    var r = ph.getBoundingClientRect();
    tx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth * 0.4)));
    ty = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight * 0.6)));
    kick();
  }, { passive: true });
})();
