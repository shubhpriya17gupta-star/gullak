/* Gullak Trade cost: the bill.
   The receipt slip "prints" out of the slot once when it first comes into view, and again
   whenever the trade changes (after typing pauses). All figures come from the page's exact
   BigInt engine; this file only replays a CSS animation. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;

  function ready(sel, fn) {
    var n = 0;
    (function check() {
      var el = document.querySelector('#dc-root ' + sel);
      if (el) return fn(el);
      if (n++ < 600) setTimeout(check, 40);
    })();
  }

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
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { print(); io.disconnect(); } }, { threshold: 0.2 });
    io.observe(feed);
  });
})();
