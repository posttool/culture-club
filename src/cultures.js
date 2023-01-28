'use strict';
import { getAuth } from 'firebase/auth';
import {
  getStorage,
  ref,
  uploadBytesResumable,
  getDownloadURL,
} from 'firebase/storage';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  onSnapshot,
  updateDoc,
} from 'firebase/firestore';


// time formating
import TimeAgo from 'javascript-time-ago'
import en from 'javascript-time-ago/locale/en'
TimeAgo.addDefaultLocale(en)
const timeAgo = new TimeAgo('en-US')

// app constructs
import { getFirebaseConfig } from './firebase-config.js';
import { Services } from './services.js'
import { Culture, Introduction, Member, Agent } from './data-objects.js'

var services = null;
export function initDisplay(functions) {
  services = new Services(functions);
}

// HOME PAGE
export async function displayCultures() {
  var $root = $('root').children[1];
  var $div = $$({ $parent: $root });
  if (Member.current) {
    var $cultureHeader = $$({ $parent: $div, className: 'padded' });
    var $cultureList = $$({ $parent: $div, id: 'culture-list' });
    var $cultureOptions = $$({ $parent: $div, id: 'culture-options' });

    $$({ $parent: $cultureHeader, el: 'h2', text: 'Cultures' });
    $$({
      $parent: $cultureOptions, el: 'button', text: 'Create Culture',
      click: displayCultureForm
    });

    const culture = new Culture();
    culture.all(divFactory($cultureList, factoryCultureCell));
  } else {
    $div.appendChild($$({ text: 'Welcome. Log in at the bottom left corner.' }))
  }
}

function factoryCultureCell(data) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({ id: data.id, className: 'culture-home' });
    $el.onclick = function () {
      document.location.href = '/culture.html?id=' + data.id;
    }
  }
  $el.innerHTML = '';
  var $name = $$({ el: 'b', text: data.name + ' ', $parent: $el });
  var $time = $$({ el: 'span', className: 'time', $parent: $el });
  var $description = $$({ $parent: $el, text: data.description });
  if (data.created) {
    $time.innerText = timeAgo.format(data.created.toDate());
  }
  return $el;
}

function displayCultureForm() {
  var $div = $$({});
  var $header = $$({ $parent: $div });
  $$({ $parent: $header, el: 'h2', text: 'New culture' });
  var $form = cultureForm(createCulture, hideModal);
  $div.appendChild($form);
  showModal($div);
}

// CULTURE PAGE
export async function displayCulture(id) {
  // get culture
  const culture = new Culture();
  await culture.get(id);

  // title
  document.title = 'Culture: ' + culture.name;

  // dom
  var $root = $('root').children[1];
  var $sidebar = $('root').children[2];

  var $header = $$({ id: id, className: 'culture-header padded', $parent: $root });
  var $introsPanel = $$({ id: 'intros-panel', $parent: $root });
  var $addIntro = $$({ id: 'add-intro', $parent: $introsPanel });
  var $intros = $$({ id: 'intros', $parent: $introsPanel });

  //  header: name, description, image?
  $$({ el: 'h2', text: culture.name, $parent: $header });
  $$({ className: 'culture-description', text: culture.description, $parent: $header });

  //  list of agents
  var $agentContainer = $$({ className: 'agent-container padded', $parent: $sidebar });
  var $agentContainerHeader = $$({ $parent: $agentContainer, className: 'agent-container-header' });
  var $agentCells = $$({ $parent: $agentContainer, className: 'agent-cells' });
  var $agentButtons = $$({ $parent: $agentContainer, className: 'agent-buttons' });

  if (Member.current) {
    $$({ $parent: $agentContainerHeader, el: 'h3', text: 'Agent members' });
    // create agent
    $$({
      el: 'i', text: 'add_circle', className: 'material-symbols-outlined add-agent',
      $parent: $agentButtons, click: function () {
        // displayAgentForm(culture);
        location.href = 'agent.html?culture=' + id;
      }
    });
    // make agents talk
    $$({
      el: 'i', text: 'arrow_circle_right', className: 'material-symbols-outlined add-agent',
      $parent: $agentButtons, click: function () {
        // displayAgentForm(culture);
        services.startAgents(id);
      }
    });
    //  list agents for culture
    const agent = new Agent();
    await agent.some('culture', '==', culture.path(),
      divFactory($agentCells, factoryAgentCell));

    // introduce an idea
    var $introForm = introForm(function (text, file) {
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
    $el = $$({ id: agent.id, className: 'agent ' + agent.type });
    $el.onclick = function () {
      document.location.href = '/agent.html?id=' + agent.id;
    }
  }
  $el.innerHTML = '';
  if (agent.image) {
    var $img = $$({ el: 'img', $parent: $el });
    $img.setAttribute('src', getStorageUrl(agent.image));
  }
  return $el;
}

function factoryIntroCell(intro) {
  var $el = $(intro.id);
  if (!$el) {
    $el = $$({ id: intro.id, className: 'intro-main twoColumn' });
    $el.onclick = function () {
      document.location.href = '/introduction.html?id=' + intro.id;
    }
  }
  $el.innerHTML = '';
  twoColPost($el, intro, 'introduction/' + intro.id + '/response', 0);
  return $el;
}


// AGENT page
export async function displayAgent(agentId, cultureId) {
  const agent = new Agent();
  if (agentId) {
    await agent.get(agentId);
  }
  const culture = new Culture();
  if (cultureId == null) {
    cultureId = agent.culture;
  }
  await culture.get(cultureId);
  if (!agent.culture) {
    agent.culture = culture;
  }
  if (!agent.priming) {
    agent.priming = [
      'I am an agent who knows about all kinds of stuff.',
      '${agent_intro}\n\rThis is a two sentence post I wrote: ',
      '${agent_intro}\n\rI read a post `${intro_text}` and wrote a response: ',
      '${agent_intro}\n\rI read a post `${intro_text}` and a response `${response_text}`. When I read the response to the post I felt: ']
  }

  let saveHandler = async function (name, priming, temp) {
    return new Promise((resolve, reject) => {
      agent.name = name;
      agent.priming = priming;
      agent.temperature = temp;
      agent.save().then(r => {
        console.log(r);
        resolve(r);
      });
    })
  };
  let cancelHandler = function () {
  }

  // title
  document.title = 'Agent: ' + agent.name;

  // form and console
  var $af = agentForm(saveHandler, cancelHandler, agent, culture.path());
  $af.header.appendChild(backToCulture(culture));

  $('root').children[1].appendChild($af.root);
}

// INTRODUCTION page
export async function displayIntroduction(id) {
  const intro = new Introduction();
  await intro.get(id);
  const culture = new Culture();
  await culture.get(intro.culture);

  // title
  document.title = 'Introduction: ' + intro.text;

  // dom containers
  var $root = $('root').children[1];
  var $header = $$({ $parent: $root })
  var $intro = $$({ $parent: $root, className: 'twoColumn intro-home' })
  var $list = $$({ $parent: $root })

  $header.appendChild(backToCulture(culture));
  twoColPost($intro, intro);

  const c = collection(getFirestore(), 'introduction', id, 'response');
  const q = query(c, orderBy('created', 'asc'));
  onSnapshot(q,
    function (snapshot) {
      snapshot.docChanges().forEach(divFactory($list, function (data) {
        return factoryResponseCell(data, 'introduction/' + id + '/response/');
      }));
    }, function (e) {
      console.error(e);
    });

}

function factoryResponseCell(data, basepath) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({ id: data.id, className: 'response-cell twoColumn' });
  }
  $el.innerHTML = '';
  twoColPost($el, data, basepath + data.id + '/response', 1);
  return $el;
}

// FORMS

function cultureForm(saveHandler, cancelHandler, props = {}) {
  var $div = $$({});
  var $form = $$({ id: 'culture-form', el: 'form', $parent: $div });
  var $input = $$({ el: 'input', type: 'text' });
  var $ta = $$({ el: 'textarea' });
  // var $image = $$({el: 'input', type: 'file'})
  $form.append(labeled('Name', $input));
  $form.append(labeled('Description', $ta));
  // $form.append(labeled('Image', $image));

  $$({
    el: 'button', text: 'OK', $parent: $div, click: function () {
      if (!$input.value) {
        alert('Needs name');
        return;
      }
      saveHandler($input.value, $ta.value); //, $image.files[0]
    }
  });

  $$({
    el: 'button', text: 'Cancel', $parent: $div, click: function () {
      cancelHandler();
    }
  });

  return $div;
}

function agentForm(saveHandler, cancelHandler, props = {}, culturePath) {
  var $div = $$({ className: 'agent' });
  var $header = $$({ $parent: $div, id: 'agent-header' });
  var $form = $$({ $parent: $div, id: 'agent-form', el: 'div' });
  var $formButtons = $$({ $parent: $div, className: 'agent-buttons' });
  var $debug = $$({ $parent: $('root').children[2] });
  $debug.log = function (style, text) {
    $$({ $parent: $debug, className: style, text: text });
    $debug.parentNode.scrollTo(0, $debug.parentNode.scrollHeight);
  }

  // name input & image
  var $nameRow = $$({ $parent: $form, className: 'name-and-image' });
  var $input = $$({ $parent: $nameRow, el: 'input', type: 'text', className: 'agent-name-input', value: props.name });
  $input.setAttribute('placeholder', 'Agent name');
  var $image = fileInput(props.image);
  $nameRow.appendChild($image.div);

  //image regen
  var $regen = $$({ $parent: $nameRow, el: 'button', text: 'refresh', className: 'material-icons lite-bg' });
  var $regenExtra = $$({ $parent: $nameRow, el: 'input', className: 'image-extras' });
  $regenExtra.setAttribute('placeholder', 'extra image attributes');
  $regen.addEventListener('click', (e) => {
    $debug.log('prompt', 'Generating proto image for "' + $input.value +' ' +$regenExtra.value + '"');
    if (props.id) {
      services.updateAgentImage(props.id, $regenExtra.value).then((res) => {
        $debug.log('response', 'Complete.');
        $image.img.src = getStorageUrl(res.url);
      });
    } else {
      services.getAgentImage($input.value, $regenExtra.value).then((res) => {
        $debug.log('response', 'Complete - final results will vary.');
        $image.img.src = res.url;
      });
    }
  });


  // textarea for priming
  // multiple priming ->
  if (typeof props.priming == 'string')
    props.priming = [props.priming, '', '', '']
  var $taRow = $$({ $parent: $form, className: 'agent-buttons' });
  var $ta = tabbedTextareaGroup(['Introduction', 'Post', 'Respond', 'Judge'], props.priming);
  $taRow.appendChild($ta.$el);
  $$({
    $parent: $taRow, el: 'button', text: 'start', className: 'material-icons lite-bg',
    click: async function () {
      let prompt = $ta.textareas.value[$ta.tabs.value];
      let agent_intro = $ta.textareas.value[0];
      let temp = $temp.value;
      $debug.log('prompt', '(' + temp + ') ' + prompt);
      const res = await services.getAgentResponse(prompt, temp, {
        agent_intro: agent_intro, culture_id: culturePath
      });
      $debug.log('response', res.text);
      if (res.log) {
        res.log.forEach((log) => {
          $debug.log('log', log);
        });
      }
    }
  });


  // temperature slider
  var $temp = $$({ el: 'input', type: 'range' });
  $temp.setAttribute('min', 0)
  $temp.setAttribute('max', 1)
  $temp.setAttribute('step', .05);
  $temp.setAttribute('value', props.temperature);
  $form.appendChild(labeled('Temp', $temp));

  function validate() {
    if (!$input.value) {
      alert('Needs name');
      return false;
    }
    // if (!$ta.textareas.value) {
    //   alert('Needs priming');
    //   return false;
    // }
    return true;
  }

  let saveLabel = props.id ? 'Update' : 'Submit';
  var $submit = $$({
    el: 'button', text: saveLabel, $parent: $formButtons, click: function () {
      if (validate()) {
        $submit.setAttribute('disabled', 'disabled');
        saveHandler($input.value, $ta.textareas.value, $temp.value).then(e => {
          $submit.removeAttribute('disabled');
          $submit.innerText = 'Update';
          $debug.log('response', 'Save complete.');
          if (!props.image) {
            $debug.log('response', 'Generating image.');
            services.updateAgentImage(e.id, $regenExtra.value).then((res) => {
              $debug.log('response', 'Complete.');
              $image.img.src = getStorageUrl(res.url);
            });
            }
        });
      }
    }
  });

  // $$({el: 'button', text: 'Cancel', $parent: $formButtons, click: function() {
  //   cancelHandler();
  // }});

  return { root: $div, header: $header, debug: $debug, form: $form, name: $input, priming: $ta }

}

function introForm(saveHandler) {
  var $div = $$({ className: 'twoColumn' }); //TWOCOL with user-pic
  var $twoCol = twoCol($div);
  var $form = $$({ id: 'intro-form', el: 'form' });
  var $ta = $$({ el: 'textarea', id: 'intro-ta' });
  $ta.setAttribute('placeholder', 'Introduce an idea');
  $form.append($ta);
  // TODO add alt here and other place
  $twoCol.userPic.innerHTML = '<img src="' + Member.current.image + '" referrerpolicy="no-referrer"/>';
  $twoCol.col2row1.appendChild($form);
  var $formButtons = $$({ id: 'intro-form-buttons' });
  $$({
    el: 'button', text: 'mic', className: 'material-icons lite-bg',
    $parent: $formButtons, click: function () {
      let SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      let recognition = new SR();
      $ta.value = 'listening...';
      recognition.onresult = (event) => {
        $ta.value = event.results[0][0].transcript;
        $ta.focus();
      }
      recognition.start();
    }
  });
  $$({
    el: 'button', text: 'post_add', className: 'material-icons lite-bg',
    $parent: $formButtons, click: function () {
      alert('add context')
    }
  });
  // TODO handle images/uploads
  $$({
    el: 'button', text: 'add_photo_alternate', className: 'material-icons lite-bg',
    $parent: $formButtons, click: function () {
      alert('add image')
    }
  });
  $$({ className: 'padding', $parent: $formButtons });
  $$({
    el: 'button', text: 'Submit', className: 'post-intro-button',
    $parent: $formButtons, click: function () {
      if ($ta.value.trim()) {
        saveHandler($ta.value, null/*upload.input.files[0]*/); //TODO
      } else {
        alert('Type something first.')
      }
    }
  });
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
  const culture = new Culture(Member.current, name, description,
    tempFileOrNull(file));
  const cDoc = await culture.save();
  if (file) {
    const filePath = `${getAuth().currentUser.uid}/culture/${cDoc.id}/${file.name}`;
    await saveFileAndUpdateDoc(file, filePath, cDoc);
  }
  location.href = 'culture.html?id=' + cDoc.id;
}

async function createAgent(culture, name, priming, temperature, temp, file) {
  const agent = new Agent(culture, Member.current, name, priming, type,
    temperature, tempFileOrNull(file));
  const cDoc = await agent.save();
  if (file) {
    const filePath = `${getAuth().currentUser.uid}/agent/${cDoc.id}`;
    await saveFileAndUpdateDoc(file, filePath, cDoc);
  }
  hideModal();
}

async function createIntro(culture, text, file) {
  const intro = new Introduction(culture, Member.current, text,
    tempFileOrNull(file));
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
  await updateDoc(cDoc, {
    image: publicImageUrl
  });
}

/////////////////////////////////////////////////////////////////////////
// utils

// move to data objects
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
    member.get(path).then(function (e) {
      var fs = Member.cached[path];
      Member.cached[path] = member;
      for (let i = 0; i < fs.length; i++) {
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
  return function (change) {
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
  for (var i = 0; i < list.length; i++) {
    let tsi = list[i].timestamp;
    let tsd = doc[tsFieldName];
    if (tsi > tsd) {
      array.splice(i, 0, { id: doc.id, timestamp: tsd });
      return i;
    }
  }
  return i;
}

function getStorageUrl(path) {
  if (!path)
    return '';
  if (path.indexOf('http') == 0)
    return path;
  return 'https://storage.googleapis.com/' + getFirebaseConfig().storageBucket + '/' + path;
}

function divId(prefix) {
  return prefix + Math.floor(Math.random() * 1000000000000);
}

var modalIds = [];
function showModal($div) {
  var id = divId('r');
  var $p = $$({ className: 'modal-layer', id: id });
  var $c = $$({ className: 'modal-content', $parent: $p });
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



function backToCulture(culture) {
  var $h2 = $$({
    el: 'h2', className: 'nav padded', click: function () {
      location.href = "culture.html?id=" + culture._id;
    }
  });
  $$({ el: 'span', className: 'material-symbols-outlined', text: 'arrow_back', $parent: $h2 });
  $$({ el: 'span', text: ' ' + culture.name, $parent: $h2 });
  return $h2;
}

function radioGroup(name, values, checkedValue) {
  var $div = $$({});
  for (var i = 0; i < values.length; i++) {
    let checked = false;
    if (checkedValue && values[i] == checkedValue) {
      checked = true;
    } else if (i == 0) {
      checked = true;
    }
    $div.appendChild(radio(name, values[i], checked))
  }
  $div.value = function () {
    for (var i = 0; i < $div.children.length; i++) {
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
  var $label = $$({ el: 'label', text: value });
  $label.setAttribute('for', name);
  var $input = $$({ el: 'input', type: 'radio' });
  $input.setAttribute('name', name);
  $input.setAttribute('value', value);
  if (checked)
    $input.setAttribute('checked', 'checked');
  $div.append($input);
  $div.append($label);
  $div.value = function () {
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
  var $div = $$({ className: 'labeled-input' });
  var $label = $$({ el: 'label', text: label });
  $div.append($label);
  $div.append($input);
  return $div
}

function twoCol($el) {
  var $col1 = $$({ className: 'col1', $parent: $el });
  var $userPic = $$({ className: 'intro-user-pic', $parent: $col1 })
  var $col2 = $$({ className: 'col2', $parent: $el });
  var $col2row1 = $$({ $parent: $col2 });
  var $col2row2 = $$({ $parent: $col2 });
  return { col1: $col1, userPic: $userPic, col2: $col2, col2row1: $col2row1, col2row2: $col2row2 }
}

function fileInput(imageUrl) {
  if (!imageUrl)
    imageUrl = 'https://www.ipcc.ch/site/assets/uploads/sites/3/2019/10/img-placeholder.png';
  var $d = $$();
  // var id = divId('fi');
  // var $l = $$({el: 'label', className: 'file-upload', $parent: $d});
  // $l.setAttribute('for', id);
  // var $upload = $$({el: 'input', id: id, type: 'file', $parent: $d});
  //  hide($upload);
  if (imageUrl) {
    var $img = $$({ el: 'img', $parent: $d });
    // services.getUrl(imageUrl).then((fullUrl)=>{
    //   $img.setAttribute('src', fullUrl);
    // })
    $img.setAttribute('src', getStorageUrl(imageUrl));
    $img.setAttribute('height', '256');
  }
  return { div: $d, input: null, img: $img, value: function () { return null; } }; //$upload
}


function twoColPost($el, data, countResponsePath, style) {
  var $twoCol = twoCol($el);
  var $author = $$({ el: 'span', className: 'author', text: '', $parent: $twoCol.col2row1 });
  var $time = $$({ el: 'span', className: 'time', text: '', $parent: $twoCol.col2row1 });
  var $text = $$({ el: 'div', className: 'text', text: data.text, $parent: $twoCol.col2row2 });
  if (countResponsePath) {
    var $responses = $$({ el: 'div', className: 'responses', $parent: $twoCol.col2row2 });
    var $responseIcon = $$({ el: 'span', className: 'material-symbols-outlined response-icon', text: 'comment', $parent: $responses });
    var $responseCount = $$({ el: 'span', className: 'response-count', text: '0', $parent: $responses });
    var $responseText = $$({ el: 'span', className: 'response-text', text: '', $parent: $responses });
  }
  getMember(data.member, function (member) {
    $twoCol.userPic.innerHTML = '<img src="' + getStorageUrl(member.image) + '" alt="' +
      member.name + '" referrerpolicy="no-referrer"/>';
    $author.innerHTML = member.name;
  });

  var timestamper = function () {
    if (data.created) {
      $time.innerText = timeAgo.format(data.created.toDate());
    }
  }
  setInterval(timestamper, 1000 * 60);
  timestamper();

  // tracking responses // TODO watch // is it too heavy?
  if (countResponsePath) {
    const c = collection(getFirestore(), countResponsePath);
    const q = query(c, orderBy('created', 'asc'));
    onSnapshot(q,
      function (snapshot) {
        snapshot.docChanges().forEach(function (change) {
          if (change.type == 'added') {
            $responseCount.innerText = Number($responseCount.innerText) + 1;
            if (style == 1) {
              let nestedResponse = change.doc.data();
              let $nrel = $$({ $parent: $responseText, className: 'preview' });
              let $imgel = $$({ $parent: $nrel, el: 'span' });
              $$({ $parent: $nrel, text: nestedResponse.text, el: 'span' });
              getMember(nestedResponse.member, function (member) {
                $imgel.innerHTML = '<img src="' + getStorageUrl(member.image) + '" alt="' +
                  member.name + '" referrerpolicy="no-referrer"/>';
                // $author.innerHTML = member.name;
              });
            }
          } else {
            console.log('intro response removed?')
          }
        });
      }, function (e) {
        console.error('snapshot error ' + self._db);
        console.error(e);
      });
  }
  return $twoCol;
}



// todo make the above 'utils' more like this
function newComponent(className) {
  var c = {};
  $elify(c, className);
  eventify(c);
  valuable(c);
  return c;
}

function tabbedTextareaGroup(tabs, priming) {
  var c = newComponent('textareaGroup');
  c.tabs = tabGroup(tabs);
  c.textareas = textareaGroup(tabs);
  c.$el.appendChild(c.tabs.$el);
  c.$el.appendChild(c.textareas.$el);
  c.tabs.on('change', function (index) {
    c.textareas.show(index);
  });
  c.textareas.value = priming;
  c.tabs.value = 0;
  return c;
}

function tabGroup(tabs) {
  var c = newComponent('tabGroup');
  var $tabs = [];
  c.update = () => {
    $tabs.forEach(($tab) => { $tab.classList.remove('selected'); });
    $tabs[c.value].classList.add('selected');
  }
  tabs.forEach((tab, index) => {
    var $tab = $$({
      $parent: c.$el, className: 'tab', text: tabs[index],
      click: () => {
        c.value = index;
        c.update();
      }
    });
    $tabs.push($tab);
  });
  return c;
}

function textareaGroup(names) {
  var c = newComponent('textareaGroup');
  var $tas = [];
  c.show = (index) => {
    $tas.forEach(($ta) => { hide($ta); });
    show($tas[index]);
  }
  c.update = () => {
    $tas.forEach(($ta, index) => {
      if (c._data && c._data[index])
        $ta.innerHTML = c._data[index].replace(/\r?\n/g, '\r\n');
    })
  }
  names.forEach((name, index) => {
    var $ta = $$({ $parent: c.$el, el: 'textarea' });
    $ta.setAttribute('placeholder', 'Priming...');
    $ta.addEventListener('change', (e) => {
      c._data[index] = $ta.value;
      console.log($ta.value)
    });
    $tas.push($ta);
  });
  return c;
}
