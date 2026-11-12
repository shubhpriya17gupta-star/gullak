import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "lib"))
import pypdf
r = pypdf.PdfReader(sys.argv[1])
print("pages:", len(r.pages))
lo, hi = int(sys.argv[2]), int(sys.argv[3])
for i in range(lo - 1, min(hi, len(r.pages))):
    print(f"\n=== PAGE {i+1} ===")
    print((r.pages[i].extract_text() or "")[:2500])
