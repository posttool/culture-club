'use strict';
import { getAuth } from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import {
   updateDoc
 } from 'firebase/firestore';
import { getFirebaseConfig } from './firebase-config.js';
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')

import { Agents } from './agents.js'
import { Culture, Introduction, Member } from './data-objects.js'

// const agents = new Agents(getFirebaseConfig());
// console.log(agents);


// HOME PAGE
export async function displayCultures() {
  var $root = $('main-card');
  var $cultureList = $$({id: 'culture-list', $parent: $root});
  var $cultureOptions = $$({id: 'culture-options', $parent: $root});
  var $cultureForm = $$({id: 'culture-form', $parent: $root});
  $cultureForm.setAttribute('hidden', 'true');

  const culture = new Culture();
  await culture.all(divFactory(_displayCultureRow));

  $cultureOptions.append($$({el: 'button', text: 'Create Culture', click: function() {
    hide($cultureOptions);
    hide($cultureList);
    show($cultureForm);
  }}));

  var $div = $$();
  var $form = $$({id: 'culture-form', el: 'form'});
  var $input = $$({el: 'input', type: 'text'});
  $form.append(labeled('Name', $input));
  var $ta = $$({el: 'textarea'});
  $form.append(labeled('Description', $ta));
  var $image = $$({el: 'input', type: 'file'})
  $form.append(labeled('Image', $image));
  $div.appendChild($form);
  $cultureForm.append($div);
  $$({el: 'button', text: 'OK', $parent: $div, click: function() {
    if (!$input.value) {
      alert('Needs name');
      return;
    }
    createCulture($input.value, $ta.value, $image.files[0]);
  }});
  $$({el: 'button', text: 'Cancel', $parent: $div, click: function() {
    show($cultureOptions);
    hide($cultureList);
    hide($cultureForm);
  }});
}


function _displayCultureRow(data, position) {
  var div = $(data.id);
  if (!div) {
    div = $$({id: data.id, className: 'culture-home'});
    div.onclick = function() {
      document.location.href = '/culture.html?id='+data.id;
    }
    var $list = $('culture-list');
    $list.insertBefore(div, $list.children[position]);
  }
  div.innerHTML = '<b>'+data.name+'</b> '+timeAgo.format(data.created.toDate())+'<br/>'+data.description;
}

const LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

async function createCulture(name, description, file) {
  try {
    const culture = new Culture(name, description,
      !file ? null : LOADING_IMAGE_URL, Member.current);
    const cDoc = await culture.insert();
    if (file) {
      const filePath = `${getAuth().currentUser.uid}/culture/${cDoc.id}/${file.name}`;
      const newImageRef = ref(getStorage(), filePath);
      const fileSnapshot = await uploadBytesResumable(newImageRef, file);
      const publicImageUrl = await getDownloadURL(newImageRef);
      await updateDoc(cDoc,{
        image: publicImageUrl
      });
    }
    location.href = 'culture.html?id='+cDoc.id;
  } catch (error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  }
}




// CULTURE PAGE

export async function displayCulture(id) {
  var $root = $('main-card');
  var $cultureHeader = $$({id: 'culture-header', $parent: $root});
  var $introsPanel = $$({id: 'intros-panel', $parent: $root});
  var $addIntro = $$({id: 'add-intro', $parent: $introsPanel});
  var $intros = $$({id: 'intros', $parent: $introsPanel});
  // culture header
  const culture = new Culture();
  await culture.get(id);
  var $el = $$({id: id, className: 'culture-header'});
  var cHTML = '<h2>'+culture.name+'</h2><div class="culture-description"/>'+culture.description+'</div>';
  if (culture.image) cHTML += ' <img src="'+culture.image+'" width="64"/>';
  $el.innerHTML = cHTML;
  $cultureHeader.append($el);
  // introduce an idea
  var $div = $$({className: 'twoColumn'}); //TWOCOL with user-pic
  var $twoCol = twoCol($div);
  var $form = $$({id: 'intro-form', el: 'form'});
  var $ta = $$({el: 'textarea', id: 'intro-ta'});
  $ta.setAttribute('placeholder', 'Introduce an idea');
  $form.append($ta);
  $twoCol.userPic.style.backgroundImage = 'url(' + Member.current.image + ')';
  $twoCol.col2row1.appendChild($form);
  var $formButtons = $$({id: 'intro-form-buttons'});
  $$({el: 'button', text: 'mic', className: 'material-icons lite-bg',
    $parent: $formButtons, click: function() {
      let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = new SR();
      $ta.value = 'listening...';
      recognition.onresult = (event) => {
        $ta.value = event.results[0][0].transcript;
        $ta.focus();
      }
      recognition.start();
  }});
  $$({el: 'button', text: 'post_add', className: 'material-icons lite-bg',
    $parent: $formButtons, click: function() {
      alert('add context')
  }});
  // TODO handle images/uploads
  $$({el: 'button', text: 'add_photo_alternate', className: 'material-icons lite-bg',
    $parent: $formButtons, click: function() {
      alert('add image')
  }});
  $$({className: 'padding', $parent: $formButtons});
  $$({el: 'button', text: 'Submit', className: 'post-intro-button',
    $parent: $formButtons, click: function() {
      if ($ta.value.trim()) {
        createIntro(culture, $ta.value, null/*upload.input.files[0]*/); //TODO consider images
      } else {
        alert('Type something first.')
      }
  }});
  $twoCol.col2row2.appendChild($formButtons);
  $addIntro.append($div);
  //list Introductions
  const intro = new Introduction();
  await intro.some('culture', '==', culture.path(), divFactory(_displayIn));
}


function _displayIn(data, position) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({id: data.id, className: 'intro-main'});
    $el.onclick = function() {
      document.location.href = '/introduction.html?id='+data.id;
    }
    var $listContainer = $('intros');
    $listContainer.insertBefore($el, $listContainer.children[position]);
  }
  $el.innerHTML = '';
  var $twoCol = twoCol($el);
  var $author = $$({el: 'span', className: 'author', text: '', $parent: $twoCol.col2row1});
  var $time = $$({el: 'span', className: 'time', text: '', $parent: $twoCol.col2row1});
  var $text = $$({el: 'div', className: 'text', text: data.text, $parent: $twoCol.col2row2});
  getMember(data.member, function(member) {
    $twoCol.userPic.style.backgroundImage = 'url(' + member.image + ')';
    $author.innerHTML = member.name;
  });
  var timestamper = function() {
    if (data.created) {
      $time.innerText = timeAgo.format(data.created.toDate());
    }
  }
  setInterval(timestamper, 1000*60);
  timestamper();
}

function getMember(path, f) {
  if (path.indexOf('member/') == 0) {
    path = path.substring(7);
  }
  var firstOne = false;
  if (Member.cached[path] instanceof Member) {
    f(Member.cached[path]);
    return;
  } else {
    if (Member.cached[path] == null) {
      Member.cached[path] = [];
      firstOne = true;
    }
    Member.cached[path].push(f);
  }
  if (firstOne) {
    var member = new Member();
    member.get(path).then(function(e) {
      var fs = Member.cached[path];
      Member.cached[path] = member;
      for (let i=0; i<fs.length; i++) {
        fs[i](member);
      }
    });
  }
}



async function createIntro(culture, text, file) {
  try {
    const intro = new Introduction(culture, Member.current, text,
      !file ? null : LOADING_IMAGE_URL, Member.current);
    const cDoc = await intro.insert();
    if (file) {
      const filePath = `${getAuth().currentUser.uid}/intro/${cDoc.id}/${file.name}`;
      const newImageRef = ref(getStorage(), filePath);
      const fileSnapshot = await uploadBytesResumable(newImageRef, file);
      const publicImageUrl = await getDownloadURL(newImageRef);
      await updateDoc(cDoc,{
        image: publicImageUrl
      });
    }
    $("intro-ta").value = '';
    //location.href = 'culture.html?id='+cDoc.id;
  } catch (error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  }
}


// INPUT FORM FIELD ... or something like that (text + subtext + image pattern)

// utils

function divFactory(displayEl) {
  var completeOrderedList = []; //{id: , timestamp: };
  return function(change) {
    if (change.type === 'removed') {
      deleteEl(change.doc.id);
    } else {
      let doc = change.doc.data();
      doc.id = change.doc.id;
      let position = insertInList(completeOrderedList, doc, 'created');
      displayEl(doc, position);
    }
  }
}

function deleteEl(id) {
  var div = $(id);
  if (div)
    div.parentNode.removeChild(div);
}

function insertInList(list, doc, tsFieldName) {
  for (var i=0; i<list.length; i++) {
    let tsi = list[i].timestamp;
    let tsd = doc[tsFieldName];
    if (tsi > tsd) {
      array.splice(i, 0, {id: doc.id, timestamp: tsd});
      return i;
    }
  }
  return i;
}

function labeled(label, $input) {
  var $div = $$();
  var $label = $$({el: 'label', text: label});
  $div.append($label);
  $div.append($input);
  return $div
}

function twoCol($el){
  var $col1 = $$({className: 'col1', $parent: $el});
  var $userPic = $$({className: 'intro-user-pic', $parent: $col1})
  var $col2 = $$({className: 'col2', $parent: $el});
  var $col2row1 = $$({$parent: $col2});
  var $col2row2 = $$({$parent: $col2});
  return {col1: $col1, userPic: $userPic, col2: $col2, col2row1: $col2row1, col2row2: $col2row2}
}

function fileInput() {
  var $d = $$();
  var id = 'fi'+Math.floor(Math.random()*10000000000);
  var $l = $$({el: 'label', className: 'file-upload', parent: $d});
  $l.setAttribute('for', id);
  var $upload = $$({el: 'input', id: id, type: 'file', parent: $d});
  hide($upload);
  return {div: $d, input: $upload};
}
