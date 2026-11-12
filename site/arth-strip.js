/* Gullak Candlesticks: arrow buttons for the pattern film strip.
   Everything else on the page (the wall of candles, the playground candle) is page markup. */
(function () {
  'use strict';
  var reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  document.addEventListener('click', function (e) {
    var b = e.target.closest ? e.target.closest('[data-strip]') : null;
    if (!b) return;
    var s = document.querySelector('#dc-root #strip');
    if (!s) return;
    var dir = b.getAttribute('data-strip') === 'next' ? 1 : -1;
    s.scrollBy({ left: dir * s.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  });
})();
