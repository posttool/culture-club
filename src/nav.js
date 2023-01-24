import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';

import {  Member } from './data-objects.js'

const NAV_TEMPLATE = `
<div id="main-navigation">
  <div id="user-container">
    <div id="user-pic"></div>
    <div  id="user-name"></div>
    <span id="sign-out" class="material-symbols-outlined login-button">
      logout
    </span>
    <span id="sign-in" class="material-symbols-outlined login-button">
      login
    </span>
  </div>
</div>
`;
const $el = createElementFromHTML(NAV_TEMPLATE);
var $userPic = $el.querySelector('#user-pic');
var $userName = $el.querySelector('#user-name');
var $signInButton = $el.querySelector('#sign-in');
var $signOutButton = $el.querySelector('#sign-out');

var _authStateCallback = null;

export function initNavigation(config, authStateCallback) {
  initFirebaseAuth();
  Member.cached = {} //keyed by id
  _authStateCallback = authStateCallback;
  $('root').children[0].append($el);
  hide($signInButton);
  hide($signOutButton);
  $signOutButton.addEventListener('click', signOutUser);
  $signInButton.addEventListener('click', signIn);
}


function initFirebaseAuth() {
  onAuthStateChanged(getAuth(), authStateObserver);
}

async function signIn() {
  var provider = new GoogleAuthProvider();
  await signInWithPopup(getAuth(), provider);
}

function signOutUser() {
  signOut(getAuth());
}


function isUserSignedIn() {
  return !!getAuth().currentUser;
}

// Triggers when the auth state change for instance when the user signs-in or signs-out.
function authStateObserver(user) {
  if (user) {
    var member = Member.current = new Member(user);
    member.checkExists();
  }
  if (user == null) {
    member = Member.current = null;
  }
  authStateUxUpdate(user != null);
  _authStateCallback(member);
}

function authStateUxUpdate(loggedin) {
  if (loggedin) {
    show($signOutButton);
    hide($signInButton);
  } else {
    hide($signOutButton);
    show($signInButton);
  }

}

// Adds a size to Google Profile pics URLs.
function addSizeToGoogleProfilePic(url) {
  if (url.indexOf('googleusercontent.com') !== -1 && url.indexOf('?') === -1) {
    return url + '?sz=150';
  }
  return url;
}
