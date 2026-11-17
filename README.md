# Gullak

Free investor-education site for beginner Indian investors. Static HTML pages, no build step. Every calculation runs in the browser and uses exact whole-paise arithmetic (BigInt). Accounts are optional: Firebase sign-in, a Google Sheet of accounts, and Firestore for results people choose to save (setup: `docs/SETUP-signup.md`).

## Run it

You need Python 3 and Node 20 (both already installed on this machine).

| What | In VS Code | Or in a terminal |
|---|---|---|
| Start the site | `Ctrl+Shift+B` (task "Gullak: start local server") | `python serve.py 5173` |
| Open it | `F5` starts the server and opens Edge | http://localhost:5173 |
| Run all tests | Terminal > Run Task > "Gullak: run all tests" | `node tools/tests/tradecost.test.js` (and the others in `tools/tests/`) |

The server turns caching off, so after saving a file just refresh the browser.

## Where things are

```
site/                      the website (this folder is what gets published)
  Main.dc.html             home page
  Workspace.dc.html        Planner (budget, risk, outcome, results dashboard)
  Recovery.dc.html         Break-even calculator
  TradeCost.dc.html        Charges calculator (contract-note charges and tax)
  Candlesticks.dc.html     candlestick lessons
  Practice.dc.html         practice desk
  MyGullak.html            saved results for signed-in people (arth-save.js does the saving)
  arth-*.js                motion, charts and interaction helpers
  support.js               page runtime (React 18.3.1 + DC runtime). Do not edit.
tools/tests/               calculation tests, one per calculator
tools/*.py                 one-off scripts used to patch pages
docs/methodology/          every formula, with worked examples (golden vectors)
docs/research/             research, sources and the source registry
serve.py                   local no-cache server
firestore.rules            Firestore security rules for saved results (paste into the Firebase console)
```

## How a page is built (`*.dc.html`)

- The markup sits inside `<x-dc>`. `{{name}}` fills in a value; `<sc-for list="{{items}}" as="item">` repeats; `<sc-if value="{{flag}}">` shows conditionally.
- The logic is in the `<script>` at the bottom: `class Component extends DCLogic`, whose `renderVals()` returns every value the markup uses.
- The calculation functions sit **above** `class Component`. The tests extract exactly that part, so keep pure maths there.
- Gotchas:
  - A `{{hole}}` renders as a `<span class="sc-interp">`, so use child selectors (`.row > span`), not `.row span`.
  - Don't put holes inside SVG `<text>`.
  - The console errors like `<rect> attribute y: Expected length, "{{b.y}}"` before render are harmless.

## Ground rules

- Correctness first. Every number traces to a formula in `docs/methodology/02-financial-methodology.md` and a passing test.
- When a formula changes: update the engine, the test vectors and the methodology doc together.
- Never present unverified rates as fact; label them on the page (see the rates ledger on the Charges page).
- Sample data only. Pages tell users never to type real PAN, Aadhaar, bank or phone details.
- Not investment advice. No securities or allocations are recommended.
