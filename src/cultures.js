'use strict';
import { getAuth } from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import { updateDoc } from 'firebase/firestore';
import { getFirebaseConfig } from './firebase-config.js';

// time formating
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')

// image placeholders
const LOADING_IMAGE_URL = 'https://www.google.com/images/spin-32.gif?a';

// app constructs
import { Agents } from './agents.js'
import { Culture, Introduction, Member, Agent } from './data-objects.js'

const agents = new Agents(getFirebaseConfig());

// HOME PAGE
export async function displayCultures() {
  var $root = $('main-card');
  var $cultureList = $$({id: 'culture-list', $parent: $root});
  var $cultureOptions = $$({id: 'culture-options', $parent: $root});

  $$({el: 'button', text: 'Create Culture', $parent: $cultureOptions,
    click: createCultureForm});

  const culture = new Culture();
  await culture.all(divFactory($cultureList, displayCultureRow));
}

function displayCultureRow($list, data, position) {
  var div = $(data.id);
  if (!div) {
    div = $$({id: data.id, className: 'culture-home'});
    div.onclick = function() {
      document.location.href = '/culture.html?id='+data.id;
    }
    $list.insertBefore(div, $list.children[position]);
  }
  div.innerHTML = '<b>'+data.name+'</b> '+timeAgo.format(data.created.toDate())+'<br/>'+data.description;
}

function createCultureForm(e) {
  var $div = $$({});
  var $form = $$({id: 'culture-form', el: 'form', $parent: $div});
  var $input = $$({el: 'input', type: 'text'});
  var $ta = $$({el: 'textarea'});
  var $image = $$({el: 'input', type: 'file'})
  $form.append(labeled('Name', $input));
  $form.append(labeled('Description', $ta));
  $form.append(labeled('Image', $image));

  $$({el: 'button', text: 'OK', $parent: $div, click: function() {
    if (!$input.value) {
      alert('Needs name');
      return;
    }
    createCulture($input.value, $ta.value, $image.files[0]);
  }});

  $$({el: 'button', text: 'Cancel', $parent: $div, click: function() {
    hideModal();
  }});
}

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

  // dom
  var $root = $('main-card');
  var $cultureHeader = $$({id: 'culture-header-container', $parent: $root});
  var $el = $$({id: id, className: 'culture-header', $parent: $cultureHeader});
  var $introsPanel = $$({id: 'intros-panel', $parent: $root});
  var $addIntro = $$({id: 'add-intro', $parent: $introsPanel});
  var $intros = $$({id: 'intros', $parent: $introsPanel});

  // get culture
  const culture = new Culture();
  await culture.get(id);

  //  header: name, description, image
  $$({el: 'h2', text: culture.name, $parent: $el });
  $$({className: 'culture-description', text: culture.description, $parent: $el });
  // '<img src="'+culture.image+'" width="64"/>';

  // dom for list of agents
  var $agentContainer = $$({className: 'agent-container', $parent: $el});
  $$({className: 'label', text: 'Agents:', $parent: $agentContainer});
  var $agentCells = $$({$parent: $agentContainer, className: 'agent-cells'});

  // create agent button
  $$({el: 'i', text: 'add_circle', className: 'material-symbols-outlined add-agent',
    $parent: $agentContainer, click: function() {
      createAgentForm(culture);
  }});

  // get list of agents for this culture and populate dom
  const agent = new Agent();
  await agent.some('culture', '==', culture.path(),
    divFactory($agentCells, displayAgentCell));

  // introduce an idea
  var $div = $$({className: 'twoColumn'}); //TWOCOL with user-pic
  var $twoCol = twoCol($div);
  var $form = $$({id: 'intro-form', el: 'form'});
  var $ta = $$({el: 'textarea', id: 'intro-ta'});
  $ta.setAttribute('placeholder', 'Introduce an idea');
  $form.append($ta);
  // TODO add alt here and other place
  $twoCol.userPic.innerHTML = '<img src="'+Member.current.image+'" referrerpolicy="no-referrer"/>';
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
        createIntro(culture, $ta.value, null/*upload.input.files[0]*/); //TODO
      } else {
        alert('Type something first.')
      }
  }});
  $twoCol.col2row2.appendChild($formButtons);
  $addIntro.append($div);
  //list Introductions
  const intro = new Introduction();
  await intro.some('culture', '==', culture.path(),
    divFactory($intros, displayIntroRow));
}

function displayAgentCell($listContainer, data, position) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({id: data.id, className: 'agent'});
    $el.onclick = function() {
      document.location.href = '/agent.html?id='+data.id;
    }
    $listContainer.insertBefore($el, $listContainer.children[position]);
  }
}


var dataExample = null; // TODO convert to something real where agent test can cycle thru examples

function displayIntroRow($listContainer, data, position) {
  dataExample = data;
  var $el = $(data.id);
  if (!$el) {
    $el = $$({id: data.id, className: 'intro-main'});
    $el.onclick = function() {
      document.location.href = '/introduction.html?id='+data.id;
    }
    $listContainer.insertBefore($el, $listContainer.children[position]);
  }
  $el.innerHTML = '';
  var $twoCol = twoCol($el);
  var $author = $$({el: 'span', className: 'author', text: '', $parent: $twoCol.col2row1});
  var $time = $$({el: 'span', className: 'time', text: '', $parent: $twoCol.col2row1});
  var $text = $$({el: 'div', className: 'text', text: data.text, $parent: $twoCol.col2row2});
  getMember(data.member, function(member) {
    // TODO add alt
    $twoCol.userPic.innerHTML = '<img src="'+member.image+'" referrerpolicy="no-referrer"/>';
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
  } catch (error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  }
}

function agentForm(saveHandler, props = {}) {
  var $div = $$({});
  var $header = $$({id: 'agent-form-header', $parent: $div});
  var $form = $$({id: 'agent-form', el: 'form', $parent: $div});
  var $formButtons = $$({$parent: $div, className: 'agent-buttons'});
  var $debug = $$({$parent: $div, className: 'agent-console'});

  // init elements
  var $input = $$({el: 'input', type: 'text', value: props.name});
  var $type = radioGroup('type', ['Responder', 'Prompter'], props.type);
  var $ta = $$({el: 'textarea'});
  $ta.innerText =  props.priming;
  var $temp = $$({el: 'input', type: 'range', value: props.temp});
  $temp.setAttribute('min', 0)
  $temp.setAttribute('max', 1)
  $temp.setAttribute('step', .1);
  var $image = $$({el: 'input', type: 'file'});
  $form.appendChild(labeled('Name', $input));
  $form.appendChild(labeled('Priming', $ta));
  $form.appendChild(labeled('Temp', $temp));
  $form.appendChild(labeled('Image', $image));
  $form.appendChild(labeled('Type', $type));

  function validate() {
    if (!$input.value) {
      alert('Needs name');
      return false;
    }
    if (!$ta.value) {
      alert('Needs priming');
      return false;
    }
    return true;
  }

  $$({el: 'button', text: 'Test', $parent: $formButtons, click: async function() {
    if (validate()) {
      let type = $type.value();
      let prompt = $ta.value;
      if (type == 'Responder') {
        prompt += dataExample.text;
      }
      // display prompt in console
      $debug.innerHTML = '';
      $$({$parent: $debug, className: 'prompt', text: prompt});
      // get continuation and display
      const res = await agents.getAgentResponse(text) ;
      $$({$parent: $debug, className: 'response', text: res.choices[0].text});
    }
  }});
  var $submit = $$({el: 'button', text: 'Submit', $parent: $formButtons, click: function() {
    if (validate()) {
      $submit.setAttribute('disabled', 'disabled');
      saveHandler($input.value, $ta.value, $type.value(), $image.files[0]);
    }
  }});
  $$({el: 'button', text: 'Cancel', $parent: $formButtons, click: function() {
    hideModal();
  }});

  return {root: $div, header: $header, debug: $debug, form: $form, name: $input, priming: $ta}

}

function createAgentForm(culture) {

    var $af = agentForm(function(name, priming, type, image){
      createAgent(culture, name, priming, type, image);
    });

    // header
    $$({el: 'h2', text: 'Create agent', $parent: $af.header})

    // for testing
    $af.name.value = 'testing';
    $af.priming.value = 'You are an ethicist. You are meant to comment on documents posted on a message board. Here is one: ';
    // $ta.value = 'You are an ethicist. You are meant to pose provocative statements on an academic message board where you hope to solicit the input of your peers on controversial issues. What is your first post?';
    showModal($af.root);
}



async function createAgent(culture, name, priming, type, file) {
  try {
    const agent = new Agent(culture, Member.current, name, priming, type,
      !file ? null : LOADING_IMAGE_URL);
    const cDoc = await agent.insert();
    console.log(cDoc)
    if (file) {
      const filePath = `${getAuth().currentUser.uid}/intro/${cDoc.id}/${file.name}`;
      const newImageRef = ref(getStorage(), filePath);
      const fileSnapshot = await uploadBytesResumable(newImageRef, file);
      const publicImageUrl = await getDownloadURL(newImageRef);
      await updateDoc(cDoc,{
        image: publicImageUrl
      });
    }
    hideModal();
    //location.href = 'culture.html?id='+cDoc.id;
  } catch (error) {
    console.error('There was an error uploading a file to Cloud Storage:', error);
  }
}

export async function displayAgent(id) {
    // dom
    var $root = $('main-card');

    // get culture
    const agent = new Agent();
    await agent.get(id);
    var $af = agentForm(function(){}, agent);
    $root.appendChild($af.root);
    //  header: name, description, image
    // $$({el: 'h2', text: agent.name, $parent: $root });
    // $$({className: 'description', text: agent.priming, $parent: $root });

}

// utils

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


function deleteEl(id) {
  var div = $(id);
  if (div)
    div.parentNode.removeChild(div);
}

function divFactory($listContainer, displayEl) {
  var completeOrderedList = []; //{id: , timestamp: }; see next function
  return function(change) {
    if (change.type === 'removed') {
      deleteEl(change.doc.id);
    } else {
      let doc = change.doc.data();
      doc.id = change.doc.id;
      let position = insertInList(completeOrderedList, doc, 'created');
      displayEl($listContainer, doc, position);
    }
  }
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
function radioGroup(name, values) {
  var $div = $$({});
  for (var i=0; i<values.length; i++) {
    $div.appendChild(radio(name, values[i], i == 0))
  }
  $div.value = function(){
    for (var i=0; i<$div.children.length; i++) {
      let val = $div.children[i].value();
        if (val) {
          return val;
        }
    }
    return null;
  }
  return $div;
}

function radio(name, value, checked) {
    var $div = $$();
    var $label = $$({el: 'label', text: value});
    $label.setAttribute('for', name);
    var $input = $$({el: 'input',  type: 'radio'});
    $input.setAttribute('name', name);
    $input.setAttribute('value', value);
    if (checked)
      $input.setAttribute('checked', 'checked');
    $div.append($input);
    $div.append($label);
    $div.value = function() {
      if ($input.checked) {
        return $input.value;
      }
      else {
        return null
      }
    }
    return $div
}

function labeled(label, $input) {
  var $div = $$({className: 'labeled-input'});
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

function divId(prefix) {
  return prefix + Math.floor(Math.random()*1000000000000);
}
function fileInput() {
  var $d = $$();
  var id = divId('fi');
  var $l = $$({el: 'label', className: 'file-upload', parent: $d});
  $l.setAttribute('for', id);
  var $upload = $$({el: 'input', id: id, type: 'file', parent: $d});
  hide($upload);
  return {div: $d, input: $upload};
}

var modalIds = [];
function showModal($div) {
  var id = divId('r');
  var $p = $$({className: 'modal-layer', id: id});
  var $c = $$({className: 'modal-content', $parent: $p});
  document.body.appendChild($p);
  $c.append($div);
  modalIds.push(id)
}

function hideModal() {
  var id = modalIds.pop();
  if (id) {
    document.body.removeChild($(id));
  }
}
