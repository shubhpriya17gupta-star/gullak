"""One-off edit: phone-width rules for the pages built before the viewport tag was added.
The pages use inline styles, so the rules match those inline values and override them below 640px.
Run from the project root: python -I tools/add_mobile_css.py
"""
P = 'site/'
CSS = """@media (max-width:640px){
[style*="px 32px"],[style*="padding:0 32px"]{padding-left:16px!important;padding-right:16px!important}
[style*="padding:32px"],[style*="padding:30px"],[style*="padding:28px"]{padding:20px!important}
[style*="padding:24px 28px"]{padding:18px!important}
h1{font-size:34px!important;line-height:1.12!important}
h2[style*="font-size:40px"],h2[style*="font-size:36px"],h2[style*="font-size:44px"]{font-size:28px!important}
[style*="font-size:76px"],[style*="font-size:60px"]{font-size:48px!important}
[style*="font-size:46px"]{font-size:34px!important}
p[style*="font-size:19px"],p[style*="font-size:20px"],p[style*="font-size:18px"]{font-size:17px!important}
}
"""
for f in ('Main', 'Workspace', 'Recovery', 'TradeCost', 'Candlesticks'):
    path = P + f + '.dc.html'
    t = open(path, encoding='utf-8').read()
    assert 'max-width:640px){\n[style*="px 32px"]' not in t, f + ' already done'
    i = t.index('</style>')
    t = t[:i] + CSS + t[i:]
    open(path, 'w', encoding='utf-8').write(t)
print('done')
