// Runs the Planner horizon engine (years, months or days) from site/Workspace.dc.html.
// Rule under test: whole years compound once a year; a leftover part-year earns the rate as simple interest.
const fs = require('fs'), path = require('path');
const html = fs.readFileSync(path.join(__dirname, '../../site/Workspace.dc.html'), 'utf8');
const js = html.match(/data-dc-script[^>]*>([\s\S]*?)<\/script>/)[1].split('class Component extends DCLogic')[0];
const m = new Function(js + '\nreturn {parseHorizon,hzText,project,reqRate,fvAfterFall,parseAll,SAMPLE_F,HZ};')();
let fail = 0;
const eq = (n, a, b) => { const ok = String(a) === String(b); if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, '| got', a, '| want', b); };
const near = (n, a, b, tol) => { const ok = Math.abs(a - b) <= tol; if (!ok) fail++; console.log(ok ? 'PASS' : 'FAIL', n, '| got', a, '| want', b); };

// parsing and limits
const ph = (raw, unit) => { const r = m.parseHorizon(raw, unit); return r.err ? 'ERR' : r.v.W + 'y+' + r.v.fn + '/' + r.v.fd; };
eq('10 years', ph('10', 'years'), '10y+0/1');
eq('unit missing defaults to years', ph('10', undefined), '10y+0/1');
eq('18 months', ph('18', 'months'), '1y+6/12');
eq('12 months is one whole year', ph('12', 'months'), '1y+0/12');
eq('600 months is 50 years', ph('600', 'months'), '50y+0/12');
eq('601 months rejected', ph('601', 'months'), 'ERR');
eq('90 days', ph('90', 'days'), '0y+90/365');
eq('365 days is one whole year', ph('365', 'days'), '1y+0/365');
eq('18250 days is 50 years', ph('18250', 'days'), '50y+0/365');
eq('18251 days rejected', ph('18251', 'days'), 'ERR');
eq('0 rejected', ph('0', 'days'), 'ERR');
eq('51 years rejected', ph('51', 'years'), 'ERR');
eq('decimal rejected', ph('1.5', 'years'), 'ERR');
eq('blank rejected', ph('', 'months'), 'ERR');
eq('spaces trimmed', ph(' 7 ', 'months'), '0y+7/12');
eq('label singular', m.hzText(m.parseHorizon('1', 'months').v), '1 month');
eq('label plural', m.hzText(m.parseHorizon('90', 'days').v), '90 days');

// values (amount Rs 1,00,000 = 10,000,000 paise; rates in basis points)
const run = (n, unit, bp, infl) => m.project({ pv: 10000000n, hz: m.parseHorizon(String(n), unit).v, lo: bp - 200, mid: bp, hi: bp + 200, infl }).scen[1];
const s10 = run(10, 'years', 1000, 400);
eq('10 years at 10% = Rs 2,59,374.25', s10.fv, 25937425n);
eq('120 months matches 10 years', run(120, 'months', 1000, 400).fv, s10.fv);
eq('3650 days is exactly 10 years', run(3650, 'days', 1000, 400).fv, s10.fv);
const s18 = run(18, 'months', 1000, 400);
eq('18 months at 10% = 1,00,000 x 1.10 x 1.05', s18.fv, 11550000n);
eq('18 months has rows 0, 1, end', s18.vals.length, 3);
eq('18 months simple-interest comparison = 1,15,000', s18.si, 11500000n);
eq('18 months growth on growth = 500', s18.ce, 50000n);
near('18 months real value = 115500 / (1.04 x 1.02)', Number(s18.realFv) / 100, 115500 / (1.04 * 1.02), 0.01);
const s90 = run(90, 'days', 1000, 400);
eq('90 days at 10% = 1,02,465.75', s90.fv, 10246575n);
eq('90 days has rows 0 and end only', s90.vals.length, 2);
eq('90 days: simple comparison equals value', s90.ce, 0n);
eq('365 days = one year', run(365, 'days', 1000, 400).fv, 11000000n);
eq('negative rate part-year', run(6, 'months', -1000, 400).fv, 9500000n);

// chart positions: the part-year point sits at its real place in time
const J = m.project({ pv: 10000000n, hz: m.parseHorizon('18', 'months').v, lo: 800, mid: 1000, hi: 1200, infl: 400 });
eq('times for 18 months', J.times.join(','), '0,1,1.5');
eq('rows = whole years + part', J.t, 2);

// fall after a part-year
const dnum = 75n;
eq('25% fall after 18 months', m.fvAfterFall(10000000n, 1000, m.parseHorizon('18', 'months').v, dnum), 8662500n);
eq('25% fall after 10 years matches old formula', m.fvAfterFall(10000000n, 1000, m.parseHorizon('10', 'years').v, dnum), (10000000n * 11n ** 10n * 75n * 2n + 100n * 10n ** 10n) / (2n * 100n * 10n ** 10n));

// required return (F9)
near('F9 whole years: double in 10 years', m.reqRate(20000000n, 10000000n, m.parseHorizon('10', 'years').v), Math.pow(2, 0.1) - 1, 1e-12);
const r18 = m.reqRate(20000000n, 10000000n, m.parseHorizon('18', 'months').v);
near('F9 18 months: (1+r)(1+r/2) = 2', (1 + r18) * (1 + r18 * 0.5), 2, 1e-9);
const r90 = m.reqRate(11000000n, 10000000n, m.parseHorizon('90', 'days').v);
near('F9 90 days: 1 + r x 90/365 = 1.1', 1 + r90 * 90 / 365, 1.1, 1e-9);

// sample data still works as before
const ps = m.parseAll(m.SAMPLE_F).P;
eq('sample horizon', ps.hz.n + ' ' + ps.hz.unit, '10 years');

console.log(fail ? fail + ' FAILED' : 'ALL PASS');
process.exit(fail ? 1 : 0);
