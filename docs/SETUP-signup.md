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
- **Gate (on by default, `gate: true`):** the home page and Methodology are public. Opening the Planner, Break-even, Charges, Candlesticks or Practice desk without an account sends the visitor to the Sign in page ("Sign in or create a free account to use the Planner") and, after signing in or up, straight back to the tool. Every account lands in your Sheet, which is the CRM list. The gate only switches on once the Firebase config is filled in. Set `gate: false` to make sign-in optional again.
- **Limits of the gate:** it runs in the browser, so someone technical can bypass it. That is fine for building a contact list. It does not protect private data, and the tools hold none (everything is calculated in the visitor's browser).
- **Sign up consent:** the Sign up tab needs the consent box ticked, for email and for Google. On the Sign in tab, a Google account that has no Gullak account yet is removed again and the person is told to use Sign up.
- **Trust:** the sheet only accepts rows backed by a valid Firebase token, so it cannot be filled with made-up emails. Email verification is sent at sign-up but is not required to use the site.
- **Passwords** are handled entirely by Firebase. They never reach your sheet or your code.

## Notes

- After changing `Code.gs`, use **Deploy > Manage deployments > Edit > New version**, otherwise the URL keeps running the old code.
- The sheet holds personal data (name, email). Keep it private and honour deletion requests (India's DPDP Act expects consent and a way to withdraw). To delete someone fully: remove their row in the sheet **and** delete the user in Firebase > Authentication > Users.
- If the sheet stays empty after a sign-up: open Apps Script > **Executions** to see errors. The usual causes are a missing `FIREBASE_API_KEY` property or a deployment that was not updated to a new version.
- The old email-only sign-in and its "Signups" tab are gone. Existing rows in an old tab are not touched.
