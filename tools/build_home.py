"""One-off edit: rebuild the home page around three product cards and unify the top menu on all pages.
Run from the project root: python -I tools/build_home.py
"""
import re

P = 'site/'

m = open(P + 'Main.dc.html', encoding='utf-8').read()

# 1. drop the old TOOLS section and insert a PRODUCTS section right after the hero
s = m.index('<!-- TOOLS -->')
e = m.index('<!-- SOURCES -->')
m = m[:s] + m[e:]

products = '''<!-- PRODUCTS -->
<section id="products" style="max-width:1240px;margin:0 auto;padding:0 32px 96px">
  <div style="max-width:720px">
    <div style="font-size:14px;font-weight:700;color:var(--green);letter-spacing:.06em;text-transform:uppercase">Three tools</div>
    <h2 style="margin:12px 0 0;font-size:40px;line-height:1.1;letter-spacing:-0.03em;font-weight:800;color:var(--navy)">Pick the question you have today</h2>
    <p style="margin:14px 0 0;font-size:18px;line-height:1.55;color:var(--muted)">Each tool is free, runs in your browser and uses only the numbers you enter. No sign-up, nothing stored.</p>
  </div>
  <div style="margin-top:40px;display:flex;flex-wrap:wrap;gap:22px;align-items:stretch">
    <sc-for list="{{products}}" as="p" hint-placeholder-count="3">
      <article class="card" style="flex:1 1 340px;min-width:0;padding:28px;display:flex;flex-direction:column">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:10px">
          <div style="width:46px;height:46px;border-radius:12px;background:{{p.tint}};display:flex;align-items:center;justify-content:center">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="{{p.stroke}}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="{{p.icon}}"/></svg>
          </div>
          <span style="font-size:12.5px;font-weight:700;color:var(--muted);letter-spacing:.04em">{{p.tag}}</span>
        </div>
        <h3 style="margin:18px 0 0;font-size:26px;letter-spacing:-0.02em;color:var(--navy)">{{p.name}}</h3>
        <p style="margin:8px 0 0;font-size:16.5px;line-height:1.55;color:var(--muted)">{{p.desc}}</p>
        <ul style="margin:16px 0 0;padding:0;list-style:none;display:flex;flex-direction:column;gap:8px;font-size:15.5px;color:var(--ink)">
          <sc-for list="{{p.points}}" as="pt" hint-placeholder-count="3"><li style="display:flex;gap:10px"><span style="color:var(--green);font-weight:800">+</span><span>{{pt}}</span></li></sc-for>
        </ul>
        <div style="margin-top:20px;background:var(--bg);border:1px solid var(--line);border-radius:12px;padding:14px 16px">
          <div style="font-size:12px;font-weight:700;color:var(--muted);letter-spacing:.05em">{{p.sampleLabel}}</div>
          <div class="num" style="margin-top:6px;font-size:23px;font-weight:800;letter-spacing:-0.02em;color:var(--navy)">{{p.sampleValue}}</div>
          <div style="margin-top:3px;font-size:13.5px;line-height:1.45;color:var(--muted)">{{p.sampleNote}}</div>
        </div>
        <div style="flex:1"></div>
        <div style="margin-top:22px"><a class="btn btn-primary" href="{{p.href}}" style="width:100%">{{p.cta}}
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></a></div>
      </article>
    </sc-for>
  </div>
</section>

'''
h = m.index('<!-- HOW IT WORKS -->')
m = m[:h] + products + m[h:]

# 2. the how-it-works block is about the planner
m = m.replace('Four short steps, from your budget to your options', 'The planner in four short steps')
m = m.replace('letter-spacing:.06em;text-transform:uppercase">How it works</div>', 'letter-spacing:.06em;text-transform:uppercase">How the planner works</div>')

# 3. top menu
nav = '''<nav aria-label="Main" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 24px">
    <a class="l" href="Workspace.dc.html">Planner</a>
    <a class="l" href="Recovery.dc.html">Recovery calculator</a>
    <a class="l" href="TradeCost.dc.html">Trade cost calculator</a>
    <a class="l" href="#sources">Sources</a>
    <a class="btn btn-primary" href="Workspace.dc.html" style="min-height:42px;padding:0 18px;font-size:15px">Start planning</a>
  </nav>'''
m = re.sub(r'<nav aria-label="Main".*?</nav>', lambda _: nav, m, count=1, flags=re.S)

# 4. footer links
old = '<a href="#how">How it works</a><a href="#tools">Tools</a><a href="Workspace.dc.html">Planning workspace</a>'
assert old in m
m = m.replace(old, '<a href="Workspace.dc.html">Planner</a><a href="Recovery.dc.html">Recovery calculator</a><a href="TradeCost.dc.html">Trade cost calculator</a>')

# 5. product data
prod = """      products: [
        { tag: 'PLANNER', name: 'Investment planner', desc: 'Four short steps from your budget to a one-page dashboard: what you can set aside, how much risk fits you, and what an amount could become.', points: ['Monthly surplus and emergency cover', 'Risk capacity, tolerance and requirement, scored separately', 'Three scenarios in rupees, with and without inflation'], sampleLabel: 'SAMPLE NUMBERS', sampleValue: '₹20,000 surplus', sampleNote: 'Income ₹80,000, essentials ₹45,000, EMIs ₹15,000. Emergency savings of ₹2,40,000 cover 4.00 months.', href: 'Workspace.dc.html', cta: 'Open the planner', tint: '#E7F5EF', stroke: '#0A7A55', icon: 'M4 19V5M4 19h16M8 15l4-4 3 3 5-6' },
        { tag: 'CALCULATOR', name: 'Recovery calculator', desc: 'Find out how big a gain it takes to get back to even after a fall in value. It is always bigger than the fall.', points: ['Enter a percentage, or your own amounts', 'Gain needed, in percent and in rupees', 'Optional: years to recover at a rate you choose'], sampleLabel: 'SAMPLE', sampleValue: '25% fall needs +33.33%', sampleNote: 'The gain is measured on the smaller amount left, so ₹75,000 must grow by ₹25,000.', href: 'Recovery.dc.html', cta: 'Open the calculator', tint: '#EEF3FA', stroke: '#13294B', icon: 'M3 7l6 6 4-4 8 8M21 11v6h-6' },
        { tag: 'CALCULATOR', name: 'Trade cost calculator', desc: 'See what one stock trade costs once brokerage, GST, capital-gains tax and cess are counted, and what you keep.', points: ['Brokerage per executed order, plus GST', 'Short-term and long-term tax, only on a profit', 'Break-even sell price'], sampleLabel: 'SAMPLE', sampleValue: 'Keep ₹7,882.62 of ₹10,000', sampleNote: '100 shares bought at ₹500 and sold at ₹600, held 12 months or less. Total cost ₹2,117.38.', href: 'TradeCost.dc.html', cta: 'Open the calculator', tint: '#FFF4DE', stroke: '#8A4B00', icon: 'M12 3v18M16.5 7.5c0-1.7-2-3-4.5-3s-4.5 1.3-4.5 3 2 2.7 4.5 3 4.5 1.3 4.5 3-2 3-4.5 3-4.5-1.3-4.5-3' },
      ],
"""
k = "      steps: [\n        { n: '1'"
assert k in m
m = m.replace(k, prod + k, 1)
open(P + 'Main.dc.html', 'w', encoding='utf-8').write(m)


# unified menu on the two calculator pages
def link(href, label, current):
    extra = ' style="color:var(--navy);font-weight:700" aria-current="page"' if current else ''
    return '<a href="%s"%s>%s</a>' % (href, extra, label)


def menu(cur):
    return ('<nav aria-label="Main" style="display:flex;flex-wrap:wrap;align-items:center;gap:6px 22px;font-size:15px;font-weight:500;color:var(--muted)">\n      '
            + link('Workspace.dc.html', 'Planner', cur == 'p') + '\n      '
            + link('Recovery.dc.html', 'Recovery calculator', cur == 'r') + '\n      '
            + link('TradeCost.dc.html', 'Trade cost calculator', cur == 't') + '\n    </nav>')


for f, cur in (('Recovery.dc.html', 'r'), ('TradeCost.dc.html', 't')):
    t = open(P + f, encoding='utf-8').read()
    t = re.sub(r'<nav aria-label="Main".*?</nav>', lambda _: menu(cur), t, count=1, flags=re.S)
    open(P + f, 'w', encoding='utf-8').write(t)
print('done')
