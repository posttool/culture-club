'use strict';

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFunctions, connectFunctionsEmulator } from "firebase/functions";

import { getFirebaseConfig } from './firebase-config.js';

import { initNavigation } from './nav.js';
import { initDisplay, displayCultures, displayCulture, displayAgent, displayIntroduction } from './cultures.js';

const firebaseConfig = getFirebaseConfig();
const app = initializeApp(firebaseConfig);
const functions = getFunctions(app);
initNavigation(firebaseConfig);
initDisplay(functions);

if (window.location.hostname.includes("localhost")) {
  console.log("USING EMULATOR")
  connectFirestoreEmulator(getFirestore(), 'localhost', 8080);
  connectFunctionsEmulator(functions, "localhost", 5001);
}

console.log(window.location.pathname);
const urlParams = new URLSearchParams(window.location.search);

switch (document.location.pathname) {
  case '/':
    displayCultures();
    break;
  case '/culture.html':
    displayCulture(urlParams.get('id'));
    break;
  case '/agent.html':
    displayAgent(urlParams.get('id'));
    break;
  case '/introduction.html':
    displayIntroduction(urlParams.get('id'));
    break;
  default:
    console.log('unhandled route '+document.location.pathname);
}
