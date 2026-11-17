/* Gullak plain-language terms.
   One place for every definition. A page shows one with a small "?" button:
     <button class="gl" type="button" data-term="stt" aria-label="What is STT?">?</button>
   Clicking or tapping it (or pressing Enter) opens a short note; Escape or a click elsewhere closes it.
   Glossary.html lists every term from the same data, so the wording can never drift apart.

   Source note: the numbers inside STT, brokerage, CAGR and the risk definitions match this site's own
   calculators and methodology. The general explanations (inflation, emergency fund, index fund) are
   written in plain words and have not been checked line by line against official documents. They are
   education only, never advice. */
(function () {
  'use strict';
  var T = {
    inflation: { name: 'Inflation',
      text: 'Inflation is the general rise in prices over time. If prices rise 4% in a year, something that cost ₹100 now costs ₹104, so the same ₹100 buys a little less. That is why this site also shows values "in today\'s rupees".' },
    cagr: { name: 'CAGR',
      text: 'CAGR (compound annual growth rate) is the steady yearly rate that would take an amount from its start value to its end value. For example, ₹1,00,000 growing to ₹2,59,374 in 10 years is a 10% CAGR. Real years go up and down, so CAGR is a smoothed average, not what happened each year.' },
    stt: { name: 'STT (Securities Transaction Tax)',
      text: 'STT is a tax charged when listed shares are bought or sold on an exchange. For delivery trades this calculator uses 0.1% of the trade value on each side, rounded to the rupee. It treats STT as not deductible when working out the tax on your gain. A chartered accountant can confirm that for your case.' },
    brokerage: { name: 'Brokerage',
      text: 'Brokerage is the fee your broker charges for carrying out a trade. Plans differ from broker to broker. This calculator uses one common plan: 0.1% of each order, at most ₹20, at least ₹5, and never more than 2.5% of the order. Your own contract note is what counts.' },
    riskcapacity: { name: 'Risk capacity',
      text: 'Risk capacity is how much of a fall your finances could absorb without hurting your essentials or plans. Here it comes from your emergency savings, EMIs against income, how steady your income is, your time horizon and your savings. It is about your numbers, not your feelings.' },
    risktolerance: { name: 'Risk tolerance',
      text: 'Risk tolerance is how comfortable you feel when an investment\'s value goes up and down. Here it comes from your answers about how you would react to a fall. It is about feelings, so it can differ from what your finances can absorb. The lower of the two sets the educational profile.' },
    emergencyfund: { name: 'Emergency fund',
      text: 'An emergency fund is money kept aside, somewhere easy to reach, for surprises such as a medical bill or a lost job, so you do not have to sell investments at a bad moment. This site shows how many months of essentials and EMIs your emergency savings would cover. It never suggests a target.' },
    indexfund: { name: 'Index fund',
      text: 'An index fund is a mutual fund or ETF that holds the same shares as a market index, such as the Nifty 50, instead of a manager choosing shares. It spreads money over many companies, but it is not risk-free: if the index falls, the fund falls too. This is a general explanation, not a recommendation.' }
  };
  var ORDER = ['inflation', 'cagr', 'stt', 'brokerage', 'riskcapacity', 'risktolerance', 'emergencyfund', 'indexfund'];
  window.ArthTerms = { terms: T, order: ORDER };

  var css = '.gl{display:inline-flex;align-items:center;justify-content:center;width:17px;height:17px;margin-left:6px;padding:0;border:1px solid currentColor;border-radius:50%;background:transparent;color:inherit;font:600 11px/1 Geist,system-ui,sans-serif;cursor:pointer;vertical-align:middle;position:relative;text-transform:none;letter-spacing:0}' +
    '.gl::after{content:"";position:absolute;inset:-9px}' +
    '.gl:hover,.gl[aria-expanded="true"]{background:rgba(210,180,124,.28)}' +
    '.gl:focus-visible{outline:2px solid #D2B47C;outline-offset:2px}' +
    '.gl-pop{position:fixed;z-index:300;width:340px;max-width:calc(100vw - 24px);background:#111316;color:#F4F1EA;border:1px solid rgba(210,180,124,.55);border-radius:14px;padding:16px 18px;box-shadow:0 24px 60px -16px rgba(0,0,0,.6);font:400 14px/1.55 Geist,system-ui,sans-serif;text-align:left;letter-spacing:0;text-transform:none}' +
    '.gl-pop:focus{outline:none}' +
    '.gl-pop b{display:block;margin-bottom:6px;font:500 18px/1.2 "Source Serif 4",Georgia,serif;color:#D2B47C}' +
    '.gl-pop p{margin:0}' +
    '.gl-pop small{display:block;margin-top:10px;font-size:12px;color:#B0B3B8}' +
    '.gl-pop a{color:#D2B47C;text-decoration:underline;text-underline-offset:3px}';
  var st = document.createElement('style');
  st.textContent = css;
  (document.head || document.documentElement).appendChild(st);

  var pop = null, openBtn = null;
  function close(restore) {
    if (pop && pop.parentNode) pop.parentNode.removeChild(pop);
    pop = null;
    if (openBtn) {
      openBtn.setAttribute('aria-expanded', 'false');
      if (restore) try { openBtn.focus(); } catch (e) {}
      openBtn = null;
    }
  }
  function show(btn) {
    var key = btn.getAttribute('data-term');
    var t = T[key];
    if (!t) return;
    close(false);
    pop = document.createElement('div');
    pop.className = 'gl-pop';
    pop.setAttribute('role', 'dialog');
    pop.setAttribute('aria-label', t.name);
    pop.tabIndex = -1;
    var h = document.createElement('b'); h.textContent = t.name;
    var p = document.createElement('p'); p.textContent = t.text;
    var s = document.createElement('small');
    s.appendChild(document.createTextNode('Plain-language explanation, not advice. '));
    var a = document.createElement('a'); a.href = 'Glossary.html#' + key; a.textContent = 'All terms';
    s.appendChild(a);
    pop.appendChild(h); pop.appendChild(p); pop.appendChild(s);
    document.body.appendChild(pop);
    btn.setAttribute('aria-expanded', 'true');
    openBtn = btn;
    var r = btn.getBoundingClientRect();
    var w = pop.offsetWidth, ph = pop.offsetHeight;
    var left = Math.max(12, Math.min(r.left + r.width / 2 - w / 2, window.innerWidth - w - 12));
    var top = r.bottom + 10;
    if (top + ph > window.innerHeight - 12 && r.top - ph - 10 > 12) top = r.top - ph - 10;
    pop.style.left = left + 'px';
    pop.style.top = Math.max(12, top) + 'px';
    try { pop.focus({ preventScroll: true }); } catch (e) {}
  }

  document.addEventListener('click', function (e) {
    var btn = e.target.closest ? e.target.closest('.gl[data-term]') : null;
    if (btn) { e.preventDefault(); if (btn === openBtn) close(true); else show(btn); return; }
    if (pop && !(e.target.closest && e.target.closest('.gl-pop'))) close(false);
  });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && pop) close(true); });
  window.addEventListener('resize', function () { close(false); });
  window.addEventListener('scroll', function () { if (pop) close(false); }, { passive: true });
})();
