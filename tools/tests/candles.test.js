// Sanity-checks every illustrative candle in site/Candlesticks.dc.html (valid OHLC, readable captions, rule checks for key patterns).
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../site/Candlesticks.dc.html'), 'utf8');
const js = html.match(/data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1].split('class Component extends DCLogic')[0];
const m = new Function(js + '\nreturn {PATTERNS,STORY,ctxCandles,assemble,HI,HI_FAMILY,HI_FAIL};')();
let fail = 0; const bad = (msg) => { fail++; console.log('FAIL', msg); };
const P = Object.fromEntries(m.PATTERNS.map((p) => [p.name, p]));
console.log('patterns:', m.PATTERNS.length, '| names unique:', new Set(m.PATTERNS.map((p) => p.name)).size === m.PATTERNS.length);
for (const p of m.PATTERNS) {
  p.candles.forEach((c, i) => { const [o, h, l, cl] = c; if (!(h >= Math.max(o, cl) && l <= Math.min(o, cl))) bad(p.name + ' candle ' + (i + 1) + ' has invalid OHLC ' + c); });
  if (p.caps.length !== p.candles.length) bad(p.name + ' captions (' + p.caps.length + ') != candles (' + p.candles.length + ')');
  if (!['bottom', 'top', 'cont'].includes(p.story)) bad(p.name + ' bad story');
  const a = m.assemble(p, p.ctx, p.nCtx); const first = a.all[p.nCtx];
  const last = a.all[p.nCtx - 1]; if (Math.abs(last.c - first.o) > 1e-6) bad(p.name + ' context does not end at the first open');
}
for (const p of m.PATTERNS) {
  const h = m.HI[p.name];
  if (!h) { bad('no Hindi for ' + p.name); continue; }
  if (h[1].length !== p.caps.length) bad('Hindi captions (' + h[1].length + ') != English (' + p.caps.length + ') for ' + p.name);
  if (!h[0] || !h[2]) bad('missing Hindi name/read for ' + p.name);
  if (!m.HI_FAMILY[p.family]) bad('no Hindi family label for ' + p.family);
}
const allHindi = JSON.stringify([m.HI, m.HI_FAMILY, m.HI_FAIL]);
if (allHindi.includes('हरामी')) bad('Devanagari spelling of Harami (a Hindi slur) found');
console.log('Hindi entries:', Object.keys(m.HI).length);
const bull = (c) => c[3] > c[0], bear = (c) => c[3] < c[0];
const body = (c) => [Math.min(c[0], c[3]), Math.max(c[0], c[3])];
const chk = (n, cond) => { if (!cond) bad('rule: ' + n); };
let c = P['Bullish Engulfing'].candles; chk('Bullish Engulfing', bear(c[0]) && bull(c[1]) && body(c[1])[0] < body(c[0])[0] && body(c[1])[1] > body(c[0])[1]);
c = P['Bearish Engulfing'].candles; chk('Bearish Engulfing', bull(c[0]) && bear(c[1]) && body(c[1])[0] < body(c[0])[0] && body(c[1])[1] > body(c[0])[1]);
c = P['Morning Star'].candles; chk('Morning Star', bear(c[0]) && body(c[1])[1] < body(c[0])[0] && bull(c[2]) && c[2][3] > (c[0][0] + c[0][3]) / 2);
c = P['Evening Star'].candles; chk('Evening Star', bull(c[0]) && body(c[1])[0] > body(c[0])[1] && bear(c[2]) && c[2][3] < (c[0][0] + c[0][3]) / 2);
c = P['Piercing Line'].candles; chk('Piercing', bear(c[0]) && c[1][0] < c[0][2] && c[1][3] > (c[0][0] + c[0][3]) / 2 && c[1][3] < c[0][0]);
c = P['Dark Cloud Cover'].candles; chk('Dark Cloud', bull(c[0]) && c[1][0] > c[0][1] && c[1][3] < (c[0][0] + c[0][3]) / 2 && c[1][3] > c[0][0]);
c = P['Bullish Harami'].candles; chk('Bullish Harami', bear(c[0]) && body(c[1])[0] >= body(c[0])[0] && body(c[1])[1] <= body(c[0])[1]);
c = P['Bearish Harami'].candles; chk('Bearish Harami', bull(c[0]) && body(c[1])[0] >= body(c[0])[0] && body(c[1])[1] <= body(c[0])[1]);
c = P['Hammer'].candles[0]; const bd = Math.abs(c[3] - c[0]); chk('Hammer shadow >= 2x body, tiny upper wick', (Math.min(c[0], c[3]) - c[2]) >= 2 * bd && (c[1] - Math.max(c[0], c[3])) <= bd);
c = P['Shooting Star'].candles[0]; chk('Shooting star', (c[1] - Math.max(c[0], c[3])) >= 2 * Math.abs(c[3] - c[0]) && (Math.min(c[0], c[3]) - c[2]) <= 1);
c = P['Dragonfly Doji'].candles[0]; chk('Dragonfly', Math.abs(c[3] - c[0]) < 0.5 && c[1] - Math.max(c[0], c[3]) < 0.5 && Math.min(c[0], c[3]) - c[2] > 5);
c = P['Gravestone Doji'].candles[0]; chk('Gravestone', Math.abs(c[3] - c[0]) < 0.5 && Math.min(c[0], c[3]) - c[2] < 0.5 && c[1] - Math.max(c[0], c[3]) > 5);
c = P['Three White Soldiers'].candles; chk('Soldiers', c.every(bull) && c[1][0] > c[0][0] && c[1][0] < c[0][3] && c[2][0] > c[1][0] && c[2][0] < c[1][3] && c[1][3] > c[0][3] && c[2][3] > c[1][3]);
c = P['Three Black Crows'].candles; chk('Crows', c.every(bear) && c[1][0] < c[0][0] && c[1][0] > c[0][3] && c[2][0] < c[1][0] && c[2][0] > c[1][3] && c[1][3] < c[0][3] && c[2][3] < c[1][3]);
c = P['Bullish Abandoned Baby'].candles; chk('Bull abandoned baby gaps', c[1][1] < c[0][2] && c[2][2] > c[1][1] && Math.abs(c[1][3] - c[1][0]) < 0.5);
c = P['Bearish Abandoned Baby'].candles; chk('Bear abandoned baby gaps', c[1][2] > c[0][1] && c[2][1] < c[1][2] && Math.abs(c[1][3] - c[1][0]) < 0.5);
c = P['Tweezer Bottom'].candles; chk('Tweezer bottom equal lows', c[0][2] === c[1][2]);
c = P['Tweezer Top'].candles; chk('Tweezer top equal highs', c[0][1] === c[1][1]);
c = P['Bullish Kicker'].candles; chk('Bull kicker', bear(c[0]) && bull(c[1]) && c[1][0] > c[0][0]);
c = P['Bearish Kicker'].candles; chk('Bear kicker', bull(c[0]) && bear(c[1]) && c[1][0] < c[0][0]);
c = P['Three Inside Up'].candles; chk('Three inside up', c[2][3] > c[0][0] && bull(c[2]));
c = P['Three Inside Down'].candles; chk('Three inside down', c[2][3] < c[0][0] && bear(c[2]));
c = P['Meeting Lines'].candles; chk('Meeting lines same close', c[0][3] === c[1][3] && c[1][0] < c[0][3]);
c = P['Bullish Separating Lines'].candles; chk('Separating (bull) same open', bear(c[0]) && bull(c[1]) && c[0][0] === c[1][0]);
c = P['Bearish Separating Lines'].candles; chk('Separating (bear) same open', bull(c[0]) && bear(c[1]) && c[0][0] === c[1][0]);
c = P['Rising Three Methods'].candles; chk('Rising three: small candles stay inside first range, last closes above first close', c.slice(1, 4).every((x) => x[1] <= c[0][1] && x[2] >= c[0][2] && Math.abs(x[3] - x[0]) < Math.abs(c[0][3] - c[0][0]) / 2) && c[4][3] > c[0][3]);
c = P['Falling Three Methods'].candles; chk('Falling three', c.slice(1, 4).every((x) => x[1] <= c[0][1] && x[2] >= c[0][2]) && c[4][3] < c[0][3]);
c = P['Mat Hold'].candles; chk('Mat hold gap up & stays above mid, last closes above c2 high', c[1][0] > c[0][3] && c.slice(2, 4).every((x) => x[2] >= (c[0][0] + c[0][3]) / 2) && c[4][3] > c[1][1]);
c = P['Bearish Mat Hold'].candles; chk('Bearish mat hold', c[1][0] < c[0][3] && c.slice(2, 4).every((x) => x[1] <= (c[0][0] + c[0][3]) / 2) && c[4][3] < c[1][2]);
c = P['Upside Gap Two Crows'].candles; chk('Upside gap two crows', bull(c[0]) && c[1][0] > c[0][3] && bear(c[1]) && bear(c[2]) && c[2][0] > c[1][0] && c[2][3] < c[1][3] && c[2][3] > c[0][3]);
c = P['Bullish Three-Line Strike'].candles; chk('Bull three-line strike', c.slice(0, 3).every(bear) && bull(c[3]) && c[3][0] < c[2][3] && c[3][3] > c[0][0]);
c = P['Bearish Three-Line Strike'].candles; chk('Bear three-line strike', c.slice(0, 3).every(bull) && bear(c[3]) && c[3][0] > c[2][3] && c[3][3] < c[0][0]);
c = P['Bullish Belt Hold'].candles[0]; chk('Bull belt hold opens at low', c[0] === c[2] && bull(c));
c = P['Bearish Belt Hold'].candles[0]; chk('Bear belt hold opens at high', c[0] === c[1] && bear(c));
c = P['Ladder Bottom'].candles; chk('Ladder bottom', c.slice(0, 3).every(bear) && c[1][3] < c[0][3] && c[2][3] < c[1][3] && bear(c[3]) && c[3][1] - c[3][0] > 3 && bull(c[4]) && c[4][0] > c[3][0]);
c = P['Concealing Baby Swallow'].candles; chk('Concealing baby swallow', c.every(bear) && c[2][0] < c[1][3] && c[2][1] > c[1][3] && c[3][0] > c[2][1] && c[3][2] < c[2][2]);
console.log(fail ? 'FAILURES ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
