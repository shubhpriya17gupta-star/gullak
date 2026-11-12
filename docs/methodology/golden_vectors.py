"""Independent reference implementation used to generate the golden vectors in 02-financial-methodology.md. Run: python golden_vectors.py"""
from decimal import Decimal as D, getcontext
getcontext().prec = 40
q = lambda x, p="0.01": x.quantize(D(p))
def fv(pv, r, t): return pv * (1 + r) ** t
print("G1 FV 100000 @12% 10y:", q(fv(D(100000), D("0.12"), 10)))
print("G2 FV 50000 @0% 7y:", q(fv(D(50000), D(0), 7)))
print("G3 FV 100000 @-5% 3y:", q(fv(D(100000), D("-0.05"), 3)))
print("G4 FV 250000 @8% 1y:", q(fv(D(250000), D("0.08"), 1)))
print("G5 yearwise 100000 @10% 1..5:", [str(q(fv(D(100000), D("0.10"), k))) for k in range(1, 6)])
print("G6 CAGR 100000->200000 5y:", q((D(200000)/D(100000)) ** (D(1)/D(5)) - 1, "0.000001"))
print("G7 CAGR 100000->100000 4y:", q((D(1)) ** (D(1)/D(4)) - 1, "0.000001"))
print("G8 real rate (12%,4%):", q(D("1.12")/D("1.04") - 1, "0.000001"))
print("G9 real value FV(G1)/1.04^10:", q(fv(D(100000), D("0.12"), 10) / D("1.04") ** 10))
print("G10 required return 100000->500000 15y:", q((D(500000)/D(100000)) ** (D(1)/D(15)) - 1, "0.000001"))
print("G11 downside 300000 x (1-0.25):", q(D(300000) * (1 - D("0.25"))))
print("G12 surplus 80000-45000-15000:", D(80000) - D(45000) - D(15000))
print("G13 coverage 240000/(45000+15000) months:", q(D(240000) / (D(45000) + D(15000)), "0.01"))
print("G14 FV 1 @7.2% 10y (rule-of-72 sanity):", q(fv(D(1), D("0.072"), 10), "0.0001"))

# F11 / F12 (recovery)
rg = lambda L: q(L / (1 - L) * 100, "0.01")
for L in ("0.10", "0.25", "0.40", "0.50", "0.90"):
    print("G15-19 RG at L =", L, ":", rg(D(L)))
print("G20 RG from amounts 100000/75000:", q((D(100000) - D(75000)) / D(75000) * 100, "0.01"), "needed", D(100000) - D(75000))
def years(O, C, r):
    if r <= 0: return None
    k = 1
    while (1 + r) ** k * C < O: k += 1
    return k
print("G21 years L25 r10%:", years(D(100), D(75), D("0.10")))
print("G22 years L50 r50%:", years(D(100), D(50), D("0.50")))
print("G23 years L25 r0%:", years(D(100), D(75), D(0)))

# F13 (trade cost) - independent reference
from decimal import ROUND_HALF_UP
def r2(x): return x.quantize(D("0.01"), rounding=ROUND_HALF_UP)
def trade(buy, sell, q, nb, ns, term):
    bv = D(str(buy)) * q; sv = D(str(sell)) * q; gross = sv - bv
    brok = D(20) * (nb + ns); gst = r2(brok * D("0.18")); ch = brok + gst; pa = gross - ch
    if pa > 0:
        tax = r2(pa * (D("0.20") if term == "S" else D("0.125"))); cess = r2(tax * D("0.04"))
    else: tax = cess = D(0)
    return ch, pa, tax, cess, pa - tax - cess, ch + tax + cess
for name, a in [("G24", (500, 600, 100, 1, 1, "S")), ("G25", (500, 600, 100, 1, 1, "L")), ("G26", (600, 500, 100, 1, 1, "S")),
                ("G27", (500, "500.20", 100, 1, 1, "S")), ("G28", ("250.55", "310.40", 1000, 3, 2, "L"))]:
    print(name, "charges, profit after charges, tax, cess, keep, total:", *trade(*a))
