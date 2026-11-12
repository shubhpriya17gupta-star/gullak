"""One-off edit: add the Practice desk to every page's menu and to the home page's product cards.
Run from the project root: python -I tools/add_practice_nav.py
"""
P = 'site/'


def edit(name, pairs):
    t = open(P + name, encoding='utf-8').read()
    for old, new in pairs:
        assert t.count(old) == 1, (name, old)
        t = t.replace(old, new, 1)
    open(P + name, 'w', encoding='utf-8').write(t)


link = '<a href="Candlesticks.dc.html">Candlestick lab</a>'
for f in ('Recovery.dc.html', 'TradeCost.dc.html'):
    edit(f, [(link, link + '\n      <a href="Practice.dc.html">Practice desk</a>')])

cur = '<a href="Candlesticks.dc.html" style="color:var(--navy);font-weight:700" aria-current="page">Candlestick lab</a>'
edit('Candlesticks.dc.html', [(cur, cur + '\n      <a href="Practice.dc.html">Practice desk</a>')])

ws = '<a href="Candlesticks.dc.html" style="font-weight:600;color:var(--navy)">Candlestick lab</a>'
edit('Workspace.dc.html', [(ws, ws + '\n      <a href="Practice.dc.html" style="font-weight:600;color:var(--navy)">Practice desk</a>')])

card = """        { tag: 'PRACTICE', name: 'Practice desk', desc: 'Walk through opening a demat and trading account, then buy and sell made-up shares with ₹1,00,000 of practice money.', points: ['Every account-opening step, with sample details', 'Market and limit orders on live-moving practice prices', 'See T+1 settlement and charges as they happen'], sampleLabel: 'TRY IT', sampleValue: '₹1,00,000 practice money', sampleNote: 'Fictional companies and random prices. No real money, shares or market data.', href: 'Practice.dc.html', cta: 'Open the practice desk', tint: '#E8F1FB', stroke: '#1F5FA8', icon: 'M3 6h18v12H3zM3 10h18M7 15h3' },
"""
marker = "      ],\n      steps: ["
edit('Main.dc.html', [
    ('<a class="l" href="Candlesticks.dc.html">Candlestick lab</a>',
     '<a class="l" href="Candlesticks.dc.html">Candlestick lab</a>\n    <a class="l" href="Practice.dc.html">Practice desk</a>'),
    ('<a href="Candlesticks.dc.html">Candlestick lab</a></div></div>',
     '<a href="Candlesticks.dc.html">Candlestick lab</a><a href="Practice.dc.html">Practice desk</a></div></div>'),
    ('text-transform:uppercase">Four tools</div>', 'text-transform:uppercase">Five tools</div>'),
    (marker, card + marker),
])
print('done')
