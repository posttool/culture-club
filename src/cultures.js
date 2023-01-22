'use strict';
import { getAuth } from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  uploadBytes,
  getDownloadURL,
} from 'firebase/storage';
import {
  getFirestore,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  getDocs,
  setDoc,
  updateDoc,
  doc,
  getDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFirebaseConfig } from './firebase-config.js';

// time formating
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')

// app constructs
import { Services } from './services.js'
import { Culture, Introduction, Member, Agent } from './data-objects.js'

var services = null;
export function initDisplay(functions){
   services = new Services(functions);
}

// HOME PAGE
export async function displayCultures() {
  var $root = $('main-card');
  var $cultureList = $$({id: 'culture-list', $parent: $root});
  var $cultureOptions = $$({id: 'culture-options', $parent: $root});

  $$({el: 'button', text: 'Create Culture', $parent: $cultureOptions,
    click: displayCultureForm});

  const culture = new Culture();
  await culture.all(divFactory($cultureList, factoryCultureCell));
}

function factoryCultureCell(data) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({id: data.id, className: 'culture-home'});
    $el.onclick = function() {
      document.location.href = '/culture.html?id='+data.id;
    }
  }
  $el.innerHTML = '';
  var $name = $$({el:'b', text: data.name, $parent:$el});
  var $time = $$({el:'span', $parent:$el});
  var $description = $$({$parent:$el, text: data.description,});
  if (data.created) {
    $time.innerText = timeAgo.format(data.created.toDate());
  }
  return $el;
}

function displayCultureForm() {
  var $div = $$({});
  var $header = $$({$parent: $div});
  $$({$parent: $header, el: 'h2', text: 'New culture'});
  var $form = cultureForm(createCulture, hideModal);
  $div.appendChild($form);
  showModal($div);
}

// CULTURE PAGE

var dataExample = null; // TODO convert to something real where agent test can cycle thru examples

export async function displayCulture(id) {
  // get culture
  const culture = new Culture();
  await culture.get(id);

  // title
  document.title = 'Culture: '+culture.name;

  // dom
  var $root = $('main-card');
  var $cultureHeader = $$({id: 'culture-header-container', $parent: $root});
  var $el = $$({id: id, className: 'culture-header', $parent: $cultureHeader});
  var $introsPanel = $$({id: 'intros-panel', $parent: $root});
  var $addIntro = $$({id: 'add-intro', $parent: $introsPanel});
  var $intros = $$({id: 'intros', $parent: $introsPanel});

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
      displayAgentForm(culture);
  }});

  // get list of agents for this culture and populate dom
  const agent = new Agent();
  await agent.some('culture', '==', culture.path(),
    divFactory($agentCells, factoryAgentCell));

  // introduce an idea
  if (Member.current) {
    var $introForm = introForm(function(text, file) {
      createIntro(culture, text, file);
    });
    $addIntro.append($introForm);
  }
  //list Introductions
  const intro = new Introduction();
  await intro.some('culture', '==', culture.path(), divFactory($intros, factoryIntroCell));
}

function factoryAgentCell(agent) {
  var $el = $(agent.id);
  if (!$el) {
    $el = $$({id: agent.id, className: 'agent '+agent.type});
    $el.onclick = function() {
      document.location.href = '/agent.html?id='+agent.id;
    }
  }
  $el.innerHTML = '';
  if (agent.image) {
    var $img = $$({el: 'img', $parent: $el});
    $img.setAttribute('src', getStorageUrl(agent.image));
  }
  return $el;
}

function factoryIntroCell(intro) {
  dataExample = intro;
  var $el = $(intro.id);
  if (!$el) {
    $el = $$({id: intro.id, className: 'intro-main'});
    $el.onclick = function() {
      document.location.href = '/introduction.html?id='+intro.id;
    }
  }
  $el.innerHTML = '';
  twoColPost($el, intro);

    return $el;
}

function displayAgentForm(culture) {
  let saveHandler = function(name, priming, type, image){
    createAgent(culture, name, priming, type, image);
  };
  let cancelHandler = function() {
    hideModel();
  }
  var $af = agentForm(saveHandler, cancelHandler);

  // header
  $$({el: 'h2', text: 'New agent', $parent: $af.header})

  // for testing
  // $af.name.value = 'testing';
  // $af.priming.value = 'You are an ethicist. You are meant to comment on documents posted on a message board. Here is one: ';
  // $ta.value = 'You are an ethicist. You are meant to pose provocative statements on an academic message board where you hope to solicit the input of your peers on controversial issues. What is your first post?';
  showModal($af.root);
}

// AGENT pages

export async function displayAgent(id) {
  const agent = new Agent();
  await agent.get(id);
  const culture = new Culture();
  await culture.get(agent.culture);

  // title
  document.title = 'Agent: '+agent.name;

  //
  var $root = $('main-card');
  $root.appendChild(backToCulture(culture));
  $$({el: 'h3', text: 'Agent', $parent: $root});

  let saveHandler = async function(name, priming, type, image){
    agent.name = name;
    agent.priming = priming;
    agent.type = type;
    // agent.image = image;
    await agent.save();
  };
  let cancelHandler = function() {
    // back to culture?
  }
  var $af = agentForm(saveHandler, cancelHandler, agent);
  $root.appendChild($af.root);
}

export async function displayIntroduction(id) {
  const intro = new Introduction();
  await intro.get(id);
  const culture = new Culture();
  await culture.get(intro.culture);

  // title
  document.title = 'Introduction: '+intro.text;

  //
  var $root = $('main-card');
  var $header = $$({$parent: $root})
  var $intro = $$({$parent: $root, className: 'twoColumn intro-home'})
  var $list = $$({$parent: $root})

  $header.appendChild(backToCulture(culture));
  twoColPost($intro, intro, false);

  const c = collection(getFirestore(), 'introduction', id, 'response');
  const q = query(c, orderBy('created', 'asc'));
  onSnapshot(q,
    function(snapshot) {
      snapshot.docChanges().forEach(divFactory($list, factoryResponseCell));
    }, function(e){
      console.error(e);
    });

}

function factoryResponseCell(data) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({id: data.id, className: 'response-cell twoColumn'});
  }
  $el.innerHTML = '';
  twoColPost($el, data);
  return $el;
}

// FORMS

function cultureForm(saveHandler, cancelHandler, props = {}) {
  var $div = $$({});
  var $form = $$({id: 'culture-form', el: 'form', $parent: $div});
  var $input = $$({el: 'input', type: 'text'});
  var $ta = $$({el: 'textarea'});
  // var $image = $$({el: 'input', type: 'file'})
  $form.append(labeled('Name', $input));
  $form.append(labeled('Description', $ta));
  // $form.append(labeled('Image', $image));

  $$({el: 'button', text: 'OK', $parent: $div, click: function() {
    if (!$input.value) {
      alert('Needs name');
      return;
    }
    saveHandler($input.value, $ta.value); //, $image.files[0]
  }});

  $$({el: 'button', text: 'Cancel', $parent: $div, click: function() {
    cancelHandler();
  }});

  return $div;
}

function agentForm(saveHandler, cancelHandler, props = {}) {
  var $div = $$({});
  var $header = $$({id: 'agent-form-header', $parent: $div});
  var $form = $$({id: 'agent-form', el: 'form', $parent: $div});
  var $formButtons = $$({$parent: $div, className: 'agent-buttons'});
  var $debug = $$({$parent: $div, className: 'agent-console'});

  // name input
  var $input = $$({el: 'input', type: 'text', value: props.name});
  $form.appendChild(labeled('Name', $input));

  // textarea for priming
  var $ta = $$({el: 'textarea'});
  if (props.priming)
    $ta.innerText =  props.priming;
  $form.appendChild(labeled('Priming', $ta));

  // type radio select
  var $type = radioGroup('type', ['Responder', 'Prompter'], props.type);
  $form.appendChild(labeled('Type', $type));

  // temperature slider
  var $temp = $$({el: 'input', type: 'range', value: props.temp});
  $temp.setAttribute('min', 0)
  $temp.setAttribute('max', 1)
  $temp.setAttribute('step', .05);
  $temp.setAttribute('value', .35);
  $form.appendChild(labeled('Temp', $temp));

  // image area
  var $image = fileInput(props.image);
  $form.appendChild($image.div);//(labeled('Image', $image.div));

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
      if (type == 'Responder' && dataExample) {
        prompt += dataExample.text;
      }
      // display prompt in console
      $debug.innerHTML = '';
      $$({$parent: $debug, className: 'prompt', text: prompt});
      // get continuation and display
      const res = await services.getAgentResponse(prompt) ;
      $$({$parent: $debug, className: 'response', text: res.text});
      const res2 = await services.getAgentImage($input.value) ;
      $$({$parent: $debug, className: 'response'}).innerHTML =
        '<img src="'+res2.url+'">';
    }
  }});

  let saveLabel = props.id ? 'Update' : 'Submit';
  var $submit = $$({el: 'button', text: saveLabel, $parent: $formButtons, click: function() {
    if (validate()) {
      $submit.setAttribute('disabled', 'disabled');
      saveHandler($input.value, $ta.value, $type.value(), $image.value());
    }
  }});

  $$({el: 'button', text: 'Cancel', $parent: $formButtons, click: function() {
    cancelHandler();
  }});

  return {root: $div, header: $header, debug: $debug, form: $form, name: $input, priming: $ta}

}

function introForm(saveHandler) {
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
        saveHandler($ta.value, null/*upload.input.files[0]*/); //TODO
      } else {
        alert('Type something first.')
      }
  }});
  $twoCol.col2row2.appendChild($formButtons);
  return $div;
}

// "SAVE" "UPDATE"
function tempFileOrNull(file) {
  if (file) {
    return '/images/temp.jpg';
  } else {
    return null;
  }
}

async function createCulture(name, description, file) {
  const culture = new Culture(Member.current, name, description, tempFileOrNull(file));
  const cDoc = await culture.save();
  if (file) {
    const filePath = `${getAuth().currentUser.uid}/culture/${cDoc.id}/${file.name}`;
    await saveFileAndUpdateDoc(file, filePath, cDoc);
  }
  location.href = 'culture.html?id='+cDoc.id;
}

async function createAgent(culture, name, priming, type, file) {
  const agent = new Agent(culture, Member.current, name, priming, type, tempFileOrNull(file));
  const cDoc = await agent.save();
  if (file) {
    const filePath = `${getAuth().currentUser.uid}/agent/${cDoc.id}`;
    await saveFileAndUpdateDoc(file, filePath, cDoc);
  }
  hideModal();
}

async function createIntro(culture, text, file) {
  const intro = new Introduction(culture, Member.current, text, tempFileOrNull(file));
  const cDoc = await intro.save();
  if (file) {
    const filePath = `${getAuth().currentUser.uid}/intro/${cDoc.id}/${file.name}`;
    await saveFileAndUpdateDoc(file, filePath, cDoc);
  }
  $("intro-ta").value = '';
}

async function saveFileAndUpdateDoc(file, filePath, cDoc) {
  const newImageRef = ref(getStorage(), filePath);
  const fileSnapshot = await uploadBytesResumable(newImageRef, file);
  const publicImageUrl = await getDownloadURL(newImageRef);
  await updateDoc(cDoc,{
    image: publicImageUrl
  });
}
/////////////////////////////////////////////////////////////////////////
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

function divFactory($list, displayEl) {
  var completeOrderedList = []; //{id: , timestamp: }; see next function
  return function(change) {
    if (change.type === 'removed') {
      deleteEl(change.doc.id);
    } else {
      let doc = change.doc.data();
      doc.id = change.doc.id;
      let newElement = !$(doc.id);
      let position = insertInList(completeOrderedList, doc, 'created');
      var $el = displayEl(doc);
      if (newElement)
        $list.insertBefore($el, $list.children[position]);
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

function radioGroup(name, values, checkedValue) {
  var $div = $$({});
  for (var i=0; i<values.length; i++) {
    let checked = false;
    if (checkedValue && values[i] == checkedValue) {
      checked = true;
    } else if (i == 0) {
      checked = true;
    }
    $div.appendChild(radio(name, values[i], checked))
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

function fileInput(imageUrl) {
  var $d = $$();
  // var id = divId('fi');
  // var $l = $$({el: 'label', className: 'file-upload', $parent: $d});
  // $l.setAttribute('for', id);
  // var $upload = $$({el: 'input', id: id, type: 'file', $parent: $d});
//  hide($upload);
  if (imageUrl) {
    var $img = $$({el: 'img', $parent: $d});
    // services.getUrl(imageUrl).then((fullUrl)=>{
    //   $img.setAttribute('src', fullUrl);
    // })
    $img.setAttribute('src', getStorageUrl(imageUrl));
  }
  return {div: $d, input: null, value: function(){ return null; }}; //$upload
}

function getStorageUrl(path) {
  if (path.indexOf('http')==0)
    return path;
  return 'http://storage.googleapis.com/'+getFirebaseConfig().storageBucket+'/'+path;
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

function backToCulture(culture){
  var $h2 = $$({el: 'h2', className: 'nav', click: function(){
    location.href = "culture.html?id="+culture._id;
  }});
  $$({el: 'span', className: 'material-symbols-outlined', text: 'arrow_back', $parent: $h2});
  $$({el: 'span', text: culture.name, $parent: $h2});
  return $h2;
}

function twoColPost($el, data, countResponses = true) {
  var $twoCol = twoCol($el);
  var $author = $$({el: 'span', className: 'author', text: '', $parent: $twoCol.col2row1});
  var $time = $$({el: 'span', className: 'time', text: '', $parent: $twoCol.col2row1});
  var $text = $$({el: 'div', className: 'text', text: data.text, $parent: $twoCol.col2row2});
  if (countResponses) {
    var $responses = $$({el: 'div', className: 'responses',  $parent: $twoCol.col2row2});
    var $responseIcon = $$({el: 'span', className: 'material-symbols-outlined response-icon', text: 'comment', $parent: $responses});
    var $responseCount = $$({el: 'span', className: 'response-count', text: '0', $parent: $responses});
  }
  getMember(data.member, function(member) {
    $twoCol.userPic.innerHTML = '<img src="'+getStorageUrl(member.image)+'" alt="'+
      member.name +'" referrerpolicy="no-referrer"/>';
    $author.innerHTML = member.name;
  });

  var timestamper = function() {
    if (data.created) {
      $time.innerText = timeAgo.format(data.created.toDate());
    }
  }
  setInterval(timestamper, 1000*60);
  timestamper();

  // tracking responses // TODO watch // is it too heavy?
  if (countResponses) {
  const c = collection(getFirestore(), 'introduction', data.id, 'response');
  const q = query(c, orderBy('created', 'asc'));
  onSnapshot(q,
    function(snapshot) {
      snapshot.docChanges().forEach(function(change) {
        console.log(change.doc.data());
        if (change.type == 'added') {
          $responseCount.innerText = Number($responseCount.innerText)+1;
        } else {
          console.log('intro response removed?')
        }
      });
    }, function(e){
      console.error('snapshot error '+self._db);
      console.error(e);
    });
  }
  return $twoCol;
}
