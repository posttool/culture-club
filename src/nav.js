import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithPopup,
  signOut
} from 'firebase/auth';

import {  Member } from './data-objects.js'


var LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

const NAV_TEMPLATE = `
<div id="main-navigation">
  <div id="home-button">
    Culture:
  </div>
  <div id="user-container">
    <div  id="user-pic"></div>
    <!-- div  id="user-name"></div -->
    <button  id="sign-out">
      Sign-out
    </button>
    <button id="sign-in">
      Sign-in with Google
    </button>
  </div>
</div>
`;
const $el = createElementFromHTML(NAV_TEMPLATE);
var $userPic = $el.querySelector('#user-pic');
var $userName = $el.querySelector('#user-name');
var $signInButton = $el.querySelector('#sign-in');
var $signOutButton = $el.querySelector('#sign-out');
var $homeButton = $el.querySelector('#home-button');
var $signInSnackbar = document.getElementById('must-signin-snackbar');


export function initNavigation(config) {
  initFirebaseAuth();
  Member.cached = {} //keyed by id
  $('header').append($el);
  $signOutButton.addEventListener('click', signOutUser);
  $signInButton.addEventListener('click', signIn);
  $homeButton.addEventListener('click', function(){
    location.href = '/';
  });
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
  authStateUxUpdate(user != null);
}

function authStateUxUpdate(loggedin) {
  if (loggedin) {
    // $userPic.style.backgroundImage = 'url(' + Member.current.image + ')';
    //$userName.textContent = Member.current.name;
    //hide($userName);
    // show($userPic);
    show($signOutButton);
    hide($signInButton);

    //saveMessagingDeviceToken();
  } else {
    //show($userName);
    // hide($userPic);
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
