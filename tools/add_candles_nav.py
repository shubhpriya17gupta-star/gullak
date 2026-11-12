"""One-off edit: add the Candlestick lab to every page's menu and to the home page's product cards."""
import re

P = 'site/'


def edit(name, fn):
    t = open(P + name, encoding='utf-8').read()
    t2 = fn(t)
    assert t2 != t, name + ' unchanged'
    open(P + name, 'w', encoding='utf-8').write(t2)


# calculator pages: add a menu link after the trade-cost link
for f in ('Recovery.dc.html', 'TradeCost.dc.html'):
    edit(f, lambda t: re.sub(r'(<a href="TradeCost\.dc\.html"[^>]*>Trade cost calculator</a>)', r'\1\n      <a href="Candlesticks.dc.html">Candlestick lab</a>', t, count=1))

# planner header
edit('Workspace.dc.html', lambda t: t.replace(
    '<a href="TradeCost.dc.html" style="font-weight:600;color:var(--navy)">Trade cost calculator</a>',
    '<a href="TradeCost.dc.html" style="font-weight:600;color:var(--navy)">Trade cost calculator</a>\n      <a href="Candlesticks.dc.html" style="font-weight:600;color:var(--navy)">Candlestick lab</a>', 1))


def home(t):
    t = t.replace('<a class="l" href="TradeCost.dc.html">Trade cost calculator</a>',
                  '<a class="l" href="TradeCost.dc.html">Trade cost calculator</a>\n    <a class="l" href="Candlesticks.dc.html">Candlestick lab</a>', 1)
    t = t.replace('<a href="TradeCost.dc.html">Trade cost calculator</a></div></div>',
                  '<a href="TradeCost.dc.html">Trade cost calculator</a><a href="Candlesticks.dc.html">Candlestick lab</a></div></div>', 1)
    t = t.replace('<h2 style="margin:12px 0 0;font-size:40px;line-height:1.1;letter-spacing:-0.03em;font-weight:800;color:var(--navy)">Pick the question you have today</h2>',
                  '<h2 style="margin:12px 0 0;font-size:40px;line-height:1.1;letter-spacing:-0.03em;font-weight:800;color:var(--navy)">Pick the question you have today</h2>', 1)
    t = t.replace('<div style="font-size:14px;font-weight:700;color:var(--green);letter-spacing:.06em;text-transform:uppercase">Three tools</div>',
                  '<div style="font-size:14px;font-weight:700;color:var(--green);letter-spacing:.06em;text-transform:uppercase">Four tools</div>', 1)
    t = t.replace('flex:1 1 280px;min-width:0;padding:26px;display:flex;flex-direction:column', 'flex:1 1 230px;min-width:0;padding:24px;display:flex;flex-direction:column', 1)
    card = """        { tag: 'LEARN', name: 'Candlestick lab', desc: 'Learn candlestick patterns by watching them draw themselves, one candle at a time, then test what you remember.', points: ['41 patterns, grouped by what traders think the market is saying', 'Play with a single candle to see how it forms', 'A quick quiz, two taps per question'], sampleLabel: 'EXAMPLE', sampleValue: 'Hammer or Hanging Man?', sampleNote: 'The same shape gets a different name depending on whether it follows a rise or a fall.', href: 'Candlesticks.dc.html', cta: 'Open the lab', tint: '#F1EAFB', stroke: '#5B3A8E', icon: 'M7 4v3M7 17v3M5 7h4v10H5zM17 3v4M17 15v5M15 7h4v8h-4z' },
"""
    marker = "      ],\n      steps: ["
    assert marker in t
    t = t.replace(marker, card + marker, 1)
    return t


edit('Main.dc.html', home)
print('done')
