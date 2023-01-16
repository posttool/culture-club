'use strict';

import { initializeApp } from 'firebase/app';
// import { getPerformance } from 'firebase/performance';
import { getFirebaseConfig } from './firebase-config.js';
import { initNavigation } from './nav.js';
import { displayCultures, displayCulture } from './cultures.js';

const firebaseConfig = getFirebaseConfig();
initializeApp(firebaseConfig);
initNavigation(firebaseConfig);

console.log('init complete '+window.location.pathname);
const urlParams = new URLSearchParams(window.location.search);

switch (document.location.pathname) {
  case '/':
    displayCultures();
    break;
  case '/culture.html':
    displayCulture(urlParams.get('id'));
    break;
  default:
    console.log('unhandled route '+document.location.pathname);
}
