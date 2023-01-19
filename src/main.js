'use strict';

import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from "firebase/firestore";
import { getFirebaseConfig } from './firebase-config.js';

import { initNavigation } from './nav.js';
import { displayCultures, displayCulture, displayAgent, displayIntroduction } from './cultures.js';

const firebaseConfig = getFirebaseConfig();
initializeApp(firebaseConfig);
initNavigation(firebaseConfig);

console.log("CONNECTING TO LOCAL FIRESTORE")
connectFirestoreEmulator(getFirestore(), 'localhost', 8080);

console.log('init complete '+window.location.pathname);
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
