# Accounts and the Google Sheet (one-time, about 15 minutes)

Gullak uses **Firebase Authentication** for real accounts (email + password, and "Continue with Google"). Every sign-up and sign-in is also written to a **Google Sheet** through **Apps Script**. Until you finish steps 1 and 2, the site works normally; the Sign in page just says accounts are not switched on.

## 1. Firebase (accounts)

1. Go to https://console.firebase.google.com and **Add project** (the free Spark plan is enough). Google Analytics is not needed.
2. **Build > Authentication > Get started**, then **Sign-in method**:
   - turn on **Email/Password**
   - turn on **Google** (choose a support email)
3. **Authentication > Settings > Authorized domains**: `localhost` is there already. When the site goes live, add its domain (for example `gullak.netlify.app`). Without this, sign-in fails with "address is not approved".
4. **Project settings (gear) > General > Your apps > Web (`</>`)**: register an app named "Gullak". Copy the `firebaseConfig` values.
5. Open `site/auth-config.js` and paste `apiKey`, `authDomain`, `projectId`, `appId` into `firebase: { ... }`.
6. (Recommended) **Authentication > Templates**: edit the "Password reset" and "Email verification" emails so the sender name says Gullak.

The apiKey is a public identifier, not a secret, so it is fine for it to appear in the page.

## 2. Google Sheet (sign-up list)

1. Go to https://sheets.new and name the sheet "Gullak accounts".
2. **Extensions > Apps Script**. Delete the sample code, paste all of `tools/apps-script/Code.gs`, and save.
3. **Project Settings (gear) > Script properties > Add script property**: name `FIREBASE_API_KEY`, value the same `apiKey` as above. (The script uses it to ask Firebase who each person is.)
4. **Deploy > New deployment > type: Web app**
   - Execute as: **Me**
   - Who has access: **Anyone**
   - Deploy, approve the permissions, and copy the **Web app URL** (ends in `/exec`).
5. Paste that URL into `endpoint` in `site/auth-config.js`.

## 3. Try it

1. Run the site (`python serve.py 5173`) and open http://localhost:5173/SignIn.html?mode=signup.
2. Create an account with a test email, then check the **Accounts** tab of your sheet: one row appears.
3. Sign out (left sidebar > Sign out), sign in again: the same row's "Last seen" and "Visits" update, and no duplicate is added.
4. Try "Continue with Google" on the Sign up tab as well.

## How it behaves

- **Header:** Sign in and Sign up buttons sit beside "Start planning" (home page) or at the right of the header (other pages). On phones they move into the sidebar. Once signed in, a name chip replaces them.
- **Left sidebar:** the menu button at the left of the header opens a slide-out list of every page, with the account details at the top and **Sign out** pinned at the bottom.
- **Gate (off, `gate: false`):** every tool is open to everyone without an account. An account is only asked for when someone chooses "Save my results" (section 4). Setting `gate: true` would send visitors to Sign in before any tool opens; it is kept only as an option and is not recommended.
- **Limits of the gate:** it runs in the browser, so someone technical can bypass it. That is fine for building a contact list. It does not protect private data, and the tools hold none (everything is calculated in the visitor's browser).
- **Sign up consent:** the Sign up tab needs the consent box ticked, for email and for Google. On the Sign in tab, a Google account that has no Gullak account yet is removed again and the person is told to use Sign up.
- **Trust:** the sheet only accepts rows backed by a valid Firebase token, so it cannot be filled with made-up emails. Email verification is sent at sign-up but is not required to use the site.
- **Passwords** are handled entirely by Firebase. They never reach your sheet or your code.

## 4. Saved results (Firestore, "My Gullak")

Visitors use every tool without an account. When they choose **Save my results**, Gullak asks them to sign in or sign up, brings them back to the same tool with their result still on screen, and saves it to **Cloud Firestore** in the same Firebase project. Saved results are listed on **My Gullak** (`MyGullak.html`, linked from the left sidebar when signed in).

Firestore's free Spark quota is enough (about 50,000 reads and 20,000 writes a day). No billing account or card is needed.

### Switch it on (one time, about 5 minutes)

1. Firebase console > your project (`gullak-5db54`) > **Build > Firestore Database > Create database**.
2. Choose **Standard edition** if asked, location **asia-south1 (Mumbai)** (it cannot be changed later), and **Start in production mode**. Do not choose test mode.
3. Open the **Rules** tab, replace everything with the contents of `firestore.rules` (in the project root), and **Publish**.
4. If you edited `tools/apps-script/Code.gs`: paste the new version into Apps Script and **Deploy > Manage deployments > Edit > New version** (this adds the "delete my row" action used by Delete my account).

Nothing else changes in `site/auth-config.js`: Firestore uses the same `projectId` and sign-in.

### What is stored

`users/{uid}/savedResults/{resultId}`, where `uid` is the person's Firebase UID (never their email). Each record holds: `id`, `tool` (planner, recovery, tradecost, practice), `title`, `summary`, `inputs` and `outputs` (lists of label and value, exactly as the page showed them), `state` (the form values, so "Open" can put them back), `methodVersion`, `createdAt`, `updatedAt`, `v`.

- The same calculation saved twice gets the same id, so it is stored once ("already saved").
- A saved calculation is never edited. Practice-desk progress is one record (`practice-progress`) that each new save replaces.
- Candlestick lab has no save: it does not track finished lessons, and its quiz score only lasts one visit.

### The rules (`firestore.rules`)

- Only a signed-in person can read, create or delete records, and only under their own `users/{uid}`.
- Every field is checked (names, types, sizes, allowed tools). Records cannot be moved to another person: ownership is the path.
- Everything outside `users/{uid}/savedResults` is denied.

### How the save works

1. On a finished result, **Save my results** (Planner, Break-even, Charges) or **Save to my Gullak account** (Practice desk).
2. Signed out: a short notice says what will be stored, with **Create a free account**, **I already have an account** and **Not now**. The result is kept in this browser (`localStorage` key `arth.pending`, at most 6 hours) and the person goes to Sign in.
3. After sign-up, sign-in or Google, they return to the tool. The result is shown again first, then saved once, and the browser copy is removed. If they come back without signing in, the result is shown and nothing is saved.
4. Signed in: the first save on a device shows the same notice; later saves go straight through.
5. Messages: "Saving your result...", "Your result has been saved to My Gullak." (only after Firestore confirms), or "We couldn't save your result. Your current results are still available. Please try again."

### Check it

Local: `python serve.py 5173`, then follow these steps in a normal browser window (sign-in needs `localhost` in Authorized domains, which it is by default):

1. Signed out, open the Break-even calculator, enter 25, choose **Save my results** > **Create a free account**. Sign up. You return with 25% still shown, and "Your result has been saved to My Gullak." appears.
2. Choose Save again: "This result is already saved in My Gullak." (no duplicate).
3. Open **My Gullak** from the left sidebar: the record is there. Refresh: still there. **View details**, **Open in Break-even calculator**, **Delete**.
4. Firebase console > Firestore > Data: `users > (your UID) > savedResults` shows the record.
5. Repeat with **I already have an account** and with Google, on the Planner and Charges calculator.
6. To see a failure message: turn the internet off (DevTools > Network > Offline) and Save. You should see the "couldn't save" message, never "saved".
7. Rules check: Firestore > Rules > **Rules Playground**, simulate a `get` on `/users/someone-else/savedResults/x` while authenticated as your UID: it must be denied.

### Deleting data

- **One result:** My Gullak > Delete.
- **All results:** My Gullak > Your data > Delete all saved results.
- **Whole account:** My Gullak > Your data > Delete my account. This deletes saved results, the person's row in the Sheet, and the Firebase sign-in. If Firebase answers that the sign-in is too old, the page asks them to sign in again and repeat.
- **On request by email:** delete the user in Firebase > Authentication > Users, their `users/{uid}` documents in Firestore > Data, and their row in the Sheet.

## 5. Visitors (CRM, no sign-in needed)

The header no longer shows Sign in / Sign up. Sign-in appears only when someone saves a result.
Everyone else is recorded anonymously by `site/arth-track.js` in a **Visitors** tab, which the script creates the first time it is needed:

| Column | What it holds |
| --- | --- |
| Visitor ID | random ID kept in that browser (`arth.vid`) |
| Email, Name, Updates consent, Email given on | filled only when the person uses the "Get new tools by email" card, or signs in |
| First seen, Last seen, Days active | Days active counts India calendar days |
| Pages used | e.g. `Planner, Charges` |
| First source | `google.com`, `utm: whatsapp / share`, or `direct` |
| Device | mobile, tablet or desktop |
| Account UID | set when that browser signs in, so it matches the row in **Accounts** |

- At most one update per page per day per browser. Browsers that send Global Privacy Control or Do Not Track are not logged.
- The email card opens once, centred over a tool page, after about 10 seconds of use. Closing it (small x or Esc) hides it for 30 days.
- Tag links you share with `?utm_source=...&utm_medium=...&utm_campaign=...` to see them in First source.
- Delete my account also removes the visitor rows linked to that account. To remove a card-only email, delete the row by hand.

**Switch it on:** paste the new `tools/apps-script/Code.gs` into Apps Script, then **Deploy > Manage deployments > Edit > New version**. The URL stays the same, so `auth-config.js` does not change.

## Notes

- After changing `Code.gs`, use **Deploy > Manage deployments > Edit > New version**, otherwise the URL keeps running the old code.
- The sheet holds personal data (name, email). Keep it private and honour deletion requests (India's DPDP Act expects consent and a way to withdraw). To delete someone fully: remove their row in the sheet **and** delete the user in Firebase > Authentication > Users.
- If the sheet stays empty after a sign-up: open Apps Script > **Executions** to see errors. The usual causes are a missing `FIREBASE_API_KEY` property or a deployment that was not updated to a new version.
- The old email-only sign-in and its "Signups" tab are gone. Existing rows in an old tab are not touched.
