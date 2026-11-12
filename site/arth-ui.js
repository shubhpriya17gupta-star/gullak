/* Gullak interface motion: scroll chapters, pinned horizontal tools track,
   cinematic planner assembly, pointer tilt, magnetic buttons, smooth (inertia)
   scrolling, reveal-on-scroll and page curtain. Plain JavaScript, no dependencies.
   Everything checks prefers-reduced-motion and touch input. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
  var root = document.documentElement;
  var clamp = function (v, a, b) { return Math.min(b, Math.max(a, v)); };
  var smooth = function (a, b, v) { var t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };

  function ready(fn) {
    var tries = 0;
    (function check() {
      if (document.querySelector('#dc-root [data-arth-ready]')) return fn();
      if (tries++ > 600) return;
      setTimeout(check, 40);
    })();
  }

  ready(function () {
    /* phones: the header's link row scrolls sideways, so bring the current page's link into view */
    var hn = document.querySelector('header.hd nav'), cur = hn && hn.querySelector('[aria-current="page"]');
    if (hn && cur && hn.scrollWidth > hn.clientWidth) hn.scrollLeft = Math.max(0, cur.offsetLeft - hn.offsetLeft - 24);
    var pin = document.getElementById('hero-pin');
    var track = document.getElementById('tools-track');
    var trackPin = document.getElementById('tools-pin');
    var stack = document.getElementById('plane-stack');
    var stackSec = document.getElementById('planner-sec');
    var planPin = stackSec ? stackSec.querySelector('.planner-pin') : null;
    var layers = stack ? Array.prototype.slice.call(stack.querySelectorAll('.layer')) : [];
    var stepLis = stackSec ? Array.prototype.slice.call(stackSec.querySelectorAll('.steps li')) : [];
    var planCount = document.getElementById('plane-count');
    var layerNames = ['PROFILE', 'RISK', 'ASSUMPTIONS', 'DASHBOARD'];
    function setOn(el, on) { if (on) { if (!el.hasAttribute('data-on')) el.setAttribute('data-on', ''); } else if (el.hasAttribute('data-on')) el.removeAttribute('data-on'); }
    var panels = track ? Array.prototype.slice.call(track.querySelectorAll('.panel')) : [];

    function pinProgress(el) {
      var r = el.getBoundingClientRect();
      var span = r.height - innerHeight;
      return span > 0 ? clamp(-r.top / span, 0, 1) : (r.top < 0 ? 1 : 0);
    }

    // Layout measured once (and on resize), never inside the scroll loop
    var m = { sticky: false, max: 0, centers: [] };
    function measure() {
      m.planPinned = !!(planPin && getComputedStyle(planPin).position === 'sticky');
      m.sticky = !!(track && trackPin && getComputedStyle(trackPin).position === 'sticky');
      if (!m.sticky) return;
      var saved = track.style.transform;
      track.style.transform = 'none';
      var base = track.getBoundingClientRect().left;
      m.max = Math.max(0, track.scrollWidth - innerWidth);
      m.centers = panels.map(function (pn) { return base + pn.offsetLeft + pn.offsetWidth / 2; });
      track.style.transform = saved;
    }
    measure();

    var ticking = false;
    function update() {
      ticking = false;
      if (pin) {
        var p = pinProgress(pin);
        var c1 = 1 - smooth(0.11, 0.19, p);
        var c2 = smooth(0.22, 0.3, p) * (1 - smooth(0.48, 0.56, p));
        var c3 = smooth(0.58, 0.66, p);
        pin.style.setProperty('--c1', c1.toFixed(3));
        pin.style.setProperty('--c2', c2.toFixed(3));
        pin.style.setProperty('--c3', c3.toFixed(3));
        pin.setAttribute('data-ch', c3 > 0.5 ? '3' : c2 > 0.5 ? '2' : '1');
      }
      if (track && m.sticky) {
        var tp = pinProgress(trackPin.parentElement);
        var shift = -m.max * tp;
        track.style.transform = 'translate3d(' + shift.toFixed(1) + 'px,0,0)';
        if (!reduce) {
          var mid = innerWidth / 2;
          panels.forEach(function (pn, k) {
            var n = clamp((m.centers[k] + shift - mid) / (innerWidth * 0.75), -1.4, 1.4);
            pn.style.transform = 'perspective(1800px) rotateY(' + (-n * 16).toFixed(2) + 'deg) translateZ(' + (-Math.abs(n) * 140).toFixed(1) + 'px)';
            pn.style.opacity = (1 - Math.min(0.55, Math.abs(n) * 0.4)).toFixed(3);
          });
        }
      } else if (track) { track.style.transform = ''; panels.forEach(function (pn) { pn.style.transform = ''; pn.style.opacity = ''; }); }
      if (stack && stackSec) {
        // Planner: while the section is pinned, scroll assembles the four layers one by one.
        // Each layer drops in from in front of the camera, catches the light, and its step
        // on the left opens; the view slowly settles from a steep angle to a calm one.
        var r = stackSec.getBoundingClientRect();
        var P;
        if (reduce) P = 1;
        else if (m.planPinned) { var sp = r.height - innerHeight; P = sp > 0 ? clamp(-r.top / sp, 0, 1) : 0; }
        else P = clamp((innerHeight * 0.85 - r.top) / (r.height * 0.75), 0, 1);
        var on = 0;
        layers.forEach(function (L, i) {
          var a = smooth(0.04 + i * 0.2, 0.2 + i * 0.2, P);
          L.style.setProperty('--a', a.toFixed(3));
          if (a > 0.55) on = i;
        });
        stack.style.setProperty('--cam', smooth(0, 0.92, P).toFixed(3));
        layers.forEach(function (L, i) { setOn(L, P > 0.04 && i === on && smooth(0.04 + i * 0.2, 0.2 + i * 0.2, P) > 0.55); });
        stepLis.forEach(function (li, i) {
          li.style.setProperty('--sp', smooth(0.04 + i * 0.2, 0.24 + i * 0.2, P).toFixed(3));
          setOn(li, i === on);
        });
        if (planCount) {
          var txt = 'LAYER 0' + (on + 1) + ' / 04 · ' + layerNames[on];
          if (planCount.textContent !== txt) planCount.textContent = txt;
        }
      }
    }
    var rq = 0, tq = 0;
    function run() { cancelAnimationFrame(rq); clearTimeout(tq); update(); }
    function onScroll() { if (!ticking) { ticking = true; rq = requestAnimationFrame(run); tq = setTimeout(run, 100); } }
    addEventListener('scroll', onScroll, { passive: true });

    // Smooth scrolling: wheel and trackpad glide with gentle inertia.
    // Off for reduced motion and touch screens (they already scroll natively).
    var lenis = null;
    if (!reduce && fine && window.Lenis) {
      lenis = new window.Lenis({ lerp: 0.1, wheelMultiplier: 1, smoothWheel: true });
      lenis.on('scroll', function () { cancelAnimationFrame(rq); clearTimeout(tq); ticking = false; update(); });
      (function raf(t) { lenis.raf(t); requestAnimationFrame(raf); })(performance.now());
      document.addEventListener('click', function (e) {
        var a = e.target.closest ? e.target.closest('a[href^="#"]') : null;
        if (!a || a.classList.contains('ap-skip')) return;
        var el = document.querySelector('#dc-root ' + a.getAttribute('href')) || document.querySelector(a.getAttribute('href'));
        if (!el) return;
        e.preventDefault();
        lenis.scrollTo(el, { offset: -68, duration: 1.4 });
      });
    }
    addEventListener('resize', function () { measure(); onScroll(); });
    update();

    // Reveal on scroll
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (en) { if (en.isIntersecting) { en.target.setAttribute('data-in', ''); io.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -12% 0px', threshold: 0.05 });
    document.querySelectorAll('[data-reveal]').forEach(function (el) { reduce ? el.setAttribute('data-in', '') : io.observe(el); });

    // Pointer tilt on the planner stack
    if (stack && fine && !reduce) {
      var tx = 0, ty = 0, cx = 0, cy = 0, raf = 0;
      stackSec.addEventListener('pointermove', function (e) {
        var r = stackSec.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
        ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
        if (!raf) raf = requestAnimationFrame(tilt);
      });
      stackSec.addEventListener('pointerleave', function () { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(tilt); });
      function tilt() {
        cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
        stack.style.setProperty('--rx', (-cy * 7).toFixed(2) + 'deg');
        stack.style.setProperty('--ry', (cx * 10).toFixed(2) + 'deg');
        raf = (Math.abs(tx - cx) > 0.002 || Math.abs(ty - cy) > 0.002) ? requestAnimationFrame(tilt) : 0;
      }
    }

    // Dimensional closing type follows the cursor
    var closing = document.querySelector('#dc-root .closing');
    if (closing && fine && !reduce) {
      closing.addEventListener('pointermove', function (e) {
        var r = closing.getBoundingClientRect();
        closing.style.setProperty('--sx', (((e.clientX - r.left) / r.width - 0.5) * -2).toFixed(3));
        closing.style.setProperty('--sy', (((e.clientY - r.top) / r.height - 0.5) * -2).toFixed(3));
      });
    }

    // Buttons stay fixed (magnetic effect removed so they are easy to click)

    // Page curtain on same-site navigation
    var curtain = document.getElementById('ap-curtain');
    if (curtain && !reduce) {
      document.addEventListener('click', function (e) {
        if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        var a = e.target.closest ? e.target.closest('a[href]') : null;
        if (!a || a.target === '_blank') return;
        var url; try { url = new URL(a.href, location.href); } catch (err) { return; }
        if (url.origin !== location.origin || url.pathname === location.pathname || navigator.onLine === false) return;
        e.preventDefault();
        curtain.setAttribute('data-state', 'in');
        setTimeout(function () { location.href = url.href; }, 520);
      });
      addEventListener('pageshow', function () { curtain.setAttribute('data-state', 'out'); });
    }
  });
})();
