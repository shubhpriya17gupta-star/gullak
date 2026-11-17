/* Gullak sign-in settings. Edit only this file. Full steps: docs/SETUP-signup.md

   firebase: from Firebase console > Project settings > Your apps > Web app > "firebaseConfig".
             These values are public identifiers, not secrets, so it is safe for them to be in the page.
             While apiKey is empty, sign-in is switched off and the Sign in page says so.
   endpoint: the Google Apps Script web-app URL (ends in /exec). Each sign-up or sign-in is then
             added to your Google Sheet. While it is empty, nothing is sent anywhere.
   gate:     true  = the five tools (Planner, Break-even, Charges, Candlesticks, Practice desk) need an
                       account. The home page and methodology stay public. Takes effect once firebase
                       above is filled in, so a missing setup can never lock everyone out.
             false = sign-in is optional (Sign in / Sign up buttons in every page header). */
window.ARTH_AUTH = {
  firebase: { apiKey: "AIzaSyDRwscngXnIjSVRRuu21IihR5EMEKVhskI", authDomain: "gullak-5db54.firebaseapp.com", projectId: "gullak-5db54", appId: "1:442843455186:web:95c0eaecc9a2f2862fd70b" },
  endpoint: "https://script.google.com/macros/s/AKfycbxeCEYq8IX3DfEJrUYAPzE2ucuZtgdMgpDmQGcgN7Jdv5v6xjI4d7TPJdT-srOgLpNs/exec",
  gate: false
};
