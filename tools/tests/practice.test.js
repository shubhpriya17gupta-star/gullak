// Runs the practice-desk engine from site/Practice.dc.html: order placement, blocking, fills, settlement, prices.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../site/Practice.dc.html'), 'utf8');
const js = html.match(/data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1].split('class Component extends DCLogic')[0];
const m = new Function(js + '\nreturn {CHARGE,START_CASH,newBook,placeOrder,matchOrders,cancelOrder,closeDay,totalValue,freeQty,parseQty,parsePrice,stepPrice,mulberry32,initMarket,tickMarket,rs,pct,STOCKS};')();
let fail = 0;
const eq = (n, a, b) => { const ok = String(a) === String(b); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, '| got', a, '| want', b); };
const P = (s) => m.parsePrice(s).v;

eq('charge per order ₹23.60', m.rs(m.CHARGE), '₹23.60');
eq('start ₹1,00,000', m.rs(m.START_CASH), '₹1,00,000.00');

// 1. market buy: 10 × ₹248.35 + ₹23.60
let b = m.newBook();
let r = m.placeOrder(b, P('248.35'), { sym: 'MONSOONTEA', side: 'buy', type: 'market', qty: 10n, limit: null });
eq('market buy fills', r.o.status, 'filled');
eq('cash after market buy', m.rs(r.b.cash), '₹97,492.90');
eq('nothing left blocked', r.b.blocked, 0n);
eq('lands in today, not holdings', [r.b.today.MONSOONTEA.qty, !!r.b.holdings.MONSOONTEA].join(), '10,false');
eq('input book untouched', b.cash, m.START_CASH);
b = r.b;

// 2. delivery shares bought today can be sold today: netted against the buy, money back at once
r = m.placeOrder(b, P('250.00'), { sym: 'MONSOONTEA', side: 'sell', type: 'market', qty: 4n, limit: null });
eq('same-day delivery sell fills', [r.o.status, r.o.netted].join(' '), 'filled 4');
eq('netted: cash = 97,492.90 + 1,000 − 23.60', m.rs(r.b.cash), '₹98,469.30');
eq('netted: nothing arriving next day', r.b.incoming, 0n);
eq('netted: P&L 1000 − 993.40', m.rs(r.o.pnl), '₹6.60');
eq('6 shares left in today', [r.b.today.MONSOONTEA.qty, m.rs(r.b.today.MONSOONTEA.cost)].join(' '), '6 ₹1,490.10');
eq('cannot sell more than owned', !!m.placeOrder(b, P('250.00'), { sym: 'MONSOONTEA', side: 'sell', type: 'market', qty: 11n, limit: null }).err, true);

// 3. limit buy below price blocks money, fills later at the lower market price, releases the difference
r = m.placeOrder(b, P('248.35'), { sym: 'MONSOONTEA', side: 'buy', type: 'limit', qty: 4n, limit: P('247.00') });
eq('limit buy stays open', r.o.status, 'open');
eq('blocked = 4×247 + 23.60', m.rs(r.b.blocked), '₹1,011.60');
eq('cash reduced by blocked', m.rs(r.b.cash), '₹96,481.30');
let f = m.matchOrders(r.b, { MONSOONTEA: P('247.50') });
eq('no fill above limit', f.filled.length, 0);
f = m.matchOrders(r.b, { MONSOONTEA: P('246.90') });
eq('fills at or below limit', f.filled.length, 1);
eq('filled at market price 246.90', m.rs(f.b.orders[0].fill), '₹246.90');
eq('blocked released', f.b.blocked, 0n);
eq('cash = 97,492.90 − 987.60 − 23.60', m.rs(f.b.cash), '₹96,481.70');
eq('today lot merged: 14 shares, cost 2483.50+987.60', [f.b.today.MONSOONTEA.qty, m.rs(f.b.today.MONSOONTEA.cost)].join(' '), '14 ₹3,471.10');
b = f.b;

// 4. cancel releases
r = m.placeOrder(b, P('248.35'), { sym: 'MONSOONTEA', side: 'buy', type: 'limit', qty: 2n, limit: P('200.00') });
const c = m.cancelOrder(r.b, r.o.id);
eq('cancel restores cash', c.cash, b.cash); eq('cancel clears blocked', c.blocked, 0n);
eq('cancelled status', c.orders[0].status, 'cancelled');
eq('cancel twice is a no-op', m.cancelOrder(c, r.o.id) === c, true);
b = r.b; // keep the open order so it expires at close

// 5. close: expire, settle, day+1
let d = m.closeDay(b);
eq('one order expired', d.expired, 1);
eq('14 shares settled', d.settledQty, 14n);
eq('holdings now 14', d.b.holdings.MONSOONTEA.qty, 14n);
eq('today empty', Object.keys(d.b.today).length, 0);
eq('day 2', d.b.day, 2);
eq('blocked back to 0 after expiry', d.b.blocked, 0n);
eq('cash restored after expiry', d.b.cash, b.cash + b.blocked);
b = d.b;

// 6. limit sell reserves shares; market sell of more than free rejected
r = m.placeOrder(b, P('250.00'), { sym: 'MONSOONTEA', side: 'sell', type: 'limit', qty: 10n, limit: P('260.00') });
eq('limit sell open', r.o.status, 'open');
eq('free qty 4 after reserving 10', m.freeQty(r.b, 'MONSOONTEA'), 4n);
let r2 = m.placeOrder(r.b, P('250.00'), { sym: 'MONSOONTEA', side: 'sell', type: 'market', qty: 5n, limit: null });
eq('oversell rejected', !!r2.err, true);
// partial market sell of 4 at 250: cost removed = 3471.10 × 4/14 = 991.742… → 991.74
r2 = m.placeOrder(r.b, P('250.00'), { sym: 'MONSOONTEA', side: 'sell', type: 'market', qty: 4n, limit: null });
eq('sell fills', r2.o.status, 'filled');
eq('realized = 1000.00 − 991.74', m.rs(r2.b.realized), '₹8.26');
eq('incoming 1000', m.rs(r2.b.incoming), '₹1,000.00');
eq('remaining cost', m.rs(r2.b.holdings.MONSOONTEA.cost), '₹2,479.36');
f = m.matchOrders(r2.b, { MONSOONTEA: P('260.05') });
eq('limit sell fills at or above limit', [f.filled.length, m.rs(f.b.orders[1].fill)].join(' '), '1 ₹260.05');
eq('all shares gone, holding removed', !!f.b.holdings.MONSOONTEA, false);
eq('realized = 8.26 + 2600.50 − 2479.36', m.rs(f.b.realized), '₹129.40');
eq('charges: 2 buys filled + 2 sells = 4 × 23.60 (expired order free)', m.rs(f.b.charges), '₹94.40');
// conservation: start = cash + blocked + incoming + cost of held − realized + charges
const lhs = f.b.cash + f.b.blocked + f.b.incoming + 0n - f.b.realized + f.b.charges;
eq('money conserved', m.rs(lhs), '₹1,00,000.00');
d = m.closeDay(f.b);
eq('sale money arrives next day', m.rs(d.b.incoming), '₹0.00');
eq('final cash = start + 129.40 − 94.40', m.rs(d.b.cash), '₹1,00,035.00');

// 7. insufficient money
r = m.placeOrder(m.newBook(), P('3405.20'), { sym: 'BANYANFOODS', side: 'buy', type: 'market', qty: 30n, limit: null });
eq('cannot overspend', !!r.err && /Not enough/.test(r.err), true);
r = m.placeOrder(m.newBook(), P('1000.00'), { sym: 'LOTUSBRICK', side: 'buy', type: 'market', qty: 99n, limit: null });
eq('exactly affordable 99×1000+23.60 ok', r.o && r.o.status, 'filled');
r = m.placeOrder(m.newBook(), P('1000.00'), { sym: 'LOTUSBRICK', side: 'buy', type: 'market', qty: 100n, limit: null });
eq('100×1000 + charge rejected', !!r.err, true);
// limit buy above market fills immediately at market
r = m.placeOrder(m.newBook(), P('100.00'), { sym: 'KAVYALOOMS', side: 'buy', type: 'limit', qty: 10n, limit: P('105.00') });
eq('marketable limit fills at market', [r.o.status, m.rs(r.o.fill), m.rs(r.b.cash)].join(' '), 'filled ₹100.00 ₹98,976.40');

// 8. parsers
eq('qty 0', !!m.parseQty('0').err, true); eq('qty 1.5', !!m.parseQty('1.5').err, true); eq('qty 1,000 ok', m.parseQty('1,000').v, 1000n);
eq('qty over max', !!m.parseQty('100001').err, true);
eq('price 101.05 ok', m.parsePrice('101.05').v, 10105n); eq('price 101.03 not a 5p step', !!m.parsePrice('101.03').err, true);
eq('price 0', !!m.parsePrice('0').err, true); eq('price text', !!m.parsePrice('ab').err, true);

// 9. prices: deterministic, 5-paise steps, floor ₹1
const g1 = m.mulberry32(42), g2 = m.mulberry32(42);
eq('PRNG deterministic', [g1(), g1()].join(), [g2(), g2()].join());
let mk = m.initMarket(m.mulberry32(7)), okStep = true, okFloor = true;
for (let i = 0; i < 2000; i++) { mk = m.tickMarket(mk, m.mulberry32(i), i % 300 === 0); for (const s of m.STOCKS) { const p = mk.px[s.sym]; if (p % 5n !== 0n) okStep = false; if (p < 100n) okFloor = false; if (p > mk.hi[s.sym] || p < mk.lo[s.sym]) okFloor = false; } }
eq('all prices on 5-paise steps', okStep, true);
eq('prices ≥ ₹1 and inside day range', okFloor, true);
eq('history capped at 60', mk.hist.MONSOONTEA.length, 60);
eq('stepPrice floor', m.stepPrice(100n, 100n, 5000, 0), 100n);
eq('pct sign', m.pct(-25n, 100n), '−25.00%');

// 10. exchanges: BSE price within 10 paise of NSE; orders remember and match on their own exchange
let okBse = true;
for (const s of m.STOCKS) { const d = mk.bse[s.sym] - mk.px[s.sym]; if (d > 10n || d < -10n || mk.bse[s.sym] % 5n !== 0n) okBse = false; }
eq('BSE price within ±10 paise, 5-paise steps', okBse, true);
r = m.placeOrder(m.newBook(), P('100.05'), { ex: 'BSE', sym: 'KAVYALOOMS', side: 'buy', type: 'limit', qty: 10n, limit: P('99.00') });
eq('order records BSE', r.o.ex, 'BSE');
eq('default exchange NSE', m.placeOrder(m.newBook(), P('100.00'), { sym: 'KAVYALOOMS', side: 'buy', type: 'market', qty: 1n, limit: null }).o.ex, 'NSE');
f = m.matchOrders(r.b, { KAVYALOOMS: P('98.90') }, { KAVYALOOMS: P('99.05') });
eq('BSE order ignores the NSE price', f.filled.length, 0);
f = m.matchOrders(r.b, { KAVYALOOMS: P('99.20') }, { KAVYALOOMS: P('98.95') });
eq('BSE order fills on the BSE price', [f.filled.length, m.rs(f.b.orders[0].fill)].join(' '), '1 ₹98.95');
// bought on BSE, settles into the same demat holding, sold on NSE
d = m.closeDay(f.b);
r = m.placeOrder(d.b, P('101.00'), { ex: 'NSE', sym: 'KAVYALOOMS', side: 'sell', type: 'market', qty: 10n, limit: null });
eq('buy on BSE, sell on NSE', [r.o.status, m.rs(r.o.pnl)].join(' '), 'filled ₹20.50');

// 10b. mixed sell: today's shares are netted first, the rest come from demat holdings (money T+1)
b = m.placeOrder(m.newBook(), P('100.00'), { sym: 'KAVYALOOMS', side: 'buy', type: 'market', qty: 5n, limit: null }).b;
b = m.closeDay(b).b;
b = m.placeOrder(b, P('110.00'), { sym: 'KAVYALOOMS', side: 'buy', type: 'market', qty: 3n, limit: null }).b;
r = m.placeOrder(b, P('120.00'), { sym: 'KAVYALOOMS', side: 'sell', type: 'market', qty: 6n, limit: null });
eq('mixed: 3 netted, 3 from holdings', [r.o.netted, Object.keys(r.b.today).length, r.b.holdings.KAVYALOOMS.qty].join(' '), '3 0 2');
eq('mixed: 360 back now, 360 next day', [m.rs(r.b.cash - b.cash + m.CHARGE), m.rs(r.b.incoming)].join(' '), '₹360.00 ₹360.00');
eq('mixed: P&L = 720 − (330 + 300)', m.rs(r.o.pnl), '₹90.00');
// trade-for-trade: no same-day selling of delivery shares
b = m.placeOrder(m.newBook(), P('54.15'), { sym: 'CORALSOLAR', side: 'buy', type: 'market', qty: 10n, limit: null }).b;
r = m.placeOrder(b, P('55.00'), { sym: 'CORALSOLAR', side: 'sell', type: 'market', qty: 10n, limit: null });
eq('trade-for-trade: same-day sell refused', !!r.err && /trade-for-trade/.test(r.err), true);

// 11. intraday (MIS)
const MIS = (b, cur, side, qty, type, limit, sym) => m.placeOrder(b, P(cur), { product: 'MIS', sym: sym || 'MONSOONTEA', side, type: type || 'market', qty: BigInt(qty), limit: limit ? P(limit) : null });
const TV = (b, p) => m.rs(m.totalValue(b, { MONSOONTEA: P(p) }));
r = MIS(m.newBook(), '250.00', 'buy', 10);
eq('intraday buy: cash = 1,00,000 − 2,500 − 23.60', m.rs(r.b.cash), '₹97,476.40');
eq('intraday buy does not touch demat or today', [Object.keys(r.b.today).length, Object.keys(r.b.holdings).length].join(), '0,0');
eq('intraday account value at 250', TV(r.b, '250.00'), '₹99,976.40');
r2 = MIS(r.b, '255.00', 'sell', 10);
eq('intraday sell same day allowed', r2.o.status, 'filled');
eq('long round trip cash', m.rs(r2.b.cash), '₹1,00,002.80');
eq('long round trip P&L +50', m.rs(r2.b.intraPnl), '₹50.00');
eq('position closed', Object.keys(r2.b.intra).length, 0);
eq('money conserved after long', m.rs(r2.b.cash - r2.b.intraPnl + r2.b.charges), '₹1,00,000.00');
// short selling
r = MIS(m.newBook(), '250.00', 'sell', 10);
eq('short opens', [r.o.status, r.b.intra.MONSOONTEA.qty].join(' '), 'filled -10');
eq('short: full value set aside', m.rs(r.b.cash), '₹97,476.40');
eq('short value when price falls to 240', TV(r.b, '240.00'), '₹1,00,076.40');
r2 = MIS(r.b, '240.00', 'buy', 10);
eq('short covered: P&L +100', m.rs(r2.o.pnl), '₹100.00');
eq('short round trip cash', m.rs(r2.b.cash), '₹1,00,052.80');
eq('money conserved after short', m.rs(r2.b.cash - r2.b.intraPnl + r2.b.charges), '₹1,00,000.00');
// one order that closes a long and opens a short
r = MIS(m.newBook(), '250.00', 'buy', 10);
r2 = MIS(r.b, '260.00', 'sell', 15);
eq('flip: closes 10 for +100', m.rs(r2.o.pnl), '₹100.00');
eq('flip: now short 5 at 260', [r2.b.intra.MONSOONTEA.qty, m.rs(r2.b.intra.MONSOONTEA.cost)].join(' '), '-5 ₹1,300.00');
eq('flip: value unchanged at 260 except charges', TV(r2.b, '260.00'), '₹1,00,052.80');
// automatic square-off at close
r = MIS(m.newBook(), '250.00', 'buy', 4);
d = m.closeDay(r.b, { MONSOONTEA: P('245.00') });
eq('auto square-off', [d.squared.length, m.rs(d.squared[0].pnl), Object.keys(d.b.intra).length].join(' '), '1 −₹20.00 0');
eq('square-off shows in orders', [d.b.orders[0].type, d.b.orders[0].side].join(' '), 'square-off sell');
eq('after square-off cash = start − 20 − 2 charges', m.rs(d.b.cash), '₹99,932.80');
eq('nothing settles to demat from intraday', Object.keys(d.b.holdings).length, 0);
// trade-for-trade share: intraday refused, delivery fine
r = MIS(m.newBook(), '54.15', 'buy', 10, 'market', null, 'CORALSOLAR');
eq('intraday refused in trade-for-trade', !!r.err && /trade-for-trade/.test(r.err), true);
eq('delivery allowed in trade-for-trade', m.placeOrder(m.newBook(), P('54.15'), { sym: 'CORALSOLAR', side: 'buy', type: 'market', qty: 10n, limit: null }).o.status, 'filled');
// intraday limit short fills when price rises to the limit; cancel releases
r = MIS(m.newBook(), '250.00', 'sell', 2, 'limit', '252.00');
eq('limit short waits', [r.o.status, m.rs(r.b.blocked)].join(' '), 'open ₹527.60');
f = m.matchOrders(r.b, { MONSOONTEA: P('252.05') });
eq('limit short fills at 252.05', [f.filled.length, f.b.intra.MONSOONTEA.qty, m.rs(f.b.blocked)].join(' '), '1 -2 ₹0.00');
eq('cancel intraday limit releases', m.rs(m.cancelOrder(r.b, r.o.id).cash), '₹1,00,000.00');
eq('not enough money for intraday', !!MIS(m.newBook(), '1000.00', 'buy', 100).err, true);

console.log(fail ? 'FAILURES ' + fail : 'ALL PASS'); process.exit(fail ? 1 : 0);
