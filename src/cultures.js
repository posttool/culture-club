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
  where,
  orderBy,
  onSnapshot,
  getCountFromServer,
} from 'firebase/firestore';


// time formating
import TimeAgo from 'javascript-time-ago';
import en from 'javascript-time-ago/locale/en';
TimeAgo.addDefaultLocale(en);
const timeAgo = new TimeAgo('en-US');

// app constructs
import { getFirebaseConfig } from './firebase-config.js';
import { Services } from './services.js';
import { Culture, Introduction, Member, Agent, ServiceQueue } from './data-objects.js';
import { signIn } from './nav.js';

var services = null;
export function initDisplay(functions) {
  services = new Services(functions);
}

// HOME PAGE
export async function displayCultures() {
  var $root = $('root').children[1];
  var $div = $$({ $parent: $root });
  var $cultureHeader = $$({ $parent: $div, className: 'padded' });
  var $cultureListPrivate = $$({ $parent: $div, id: 'culture-list' });
  var $cultureList = $$({ $parent: $div, id: 'culture-list' });
  var $cultureOptions = $$({ $parent: $div, id: 'culture-options' });

  $$({ $parent: $cultureHeader, el: 'h1', text: 'Cultures' });

  const culture = new Culture();
  culture.all(divFactory($cultureList, $$cultureCell));

  if (Member.current) {
    // private cultures with an intentional limit bug
    culture._some(
      where('state', '==', 'private'),
      where('creator', '==', Member.current.uid),
      10,
      divFactory($cultureListPrivate, $$cultureCell));

    $$({
      $parent: $cultureOptions, el: 'button', text: 'Create a culture',
      click: displayCultureForm
    });
  } else {
    $$({
      $parent: $cultureOptions, el: 'button', text: 'Sign in to create a culture',
      click: signIn
    });
  }
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
  var $title = $$({ el: 'h1', $parent: $header });
  var $description = $$({ className: 'culture-description', text: culture.description, $parent: $header });
  var renderTitle = e => {
    var s = '';
    if (_is_owner(culture)) {
      if (culture.state == 'public')
        s += '<span class="material-symbols-outlined">public</span> ';
      else
        s += '<span class="material-symbols-outlined">lock</span> ';
      s += '<span class="material-symbols-outlined">edit</span> ';
    }
    s += culture.name;
    $title.innerHTML = s;
    $description.innerHTML = culture.description;
  };
  renderTitle();
  if (_is_owner(culture)) {
    $title.addEventListener('click', e => {
      var $form = $$cultureForm((name, description, isPublic) => {
        culture.name = name;
        culture.description = description;
        culture.state = isPublic ? 'public' : 'private';
        culture.save().then(r => {
          hideModal();
          renderTitle();
        });
      }, hideModal, culture);
      showModal($form.root);
      $form.input.focus();
    });
  }

  //  list of agents
  var $agentContainer = $$({ className: 'agent-container padded', $parent: $sidebar });
  var $agentContainerHeader = $$({ $parent: $agentContainer, className: 'agent-container-header' });
  var $agentCells = $$({ $parent: $agentContainer, className: 'agent-cells' });
  var $agentButtons = $$({ $parent: $agentContainer, className: 'agent-buttons-container' });
  const coll = collection(getFirestore(), "member");
  const q = query(coll, where('culture', '==', culture.path()));
  const snapshot = await getCountFromServer(q);
  const agentCount = snapshot.data().count;
  // console.log('ic=' + agentCount)

  if (Member.current) {

    $$({ $parent: $agentContainerHeader, el: 'h3', text: 'Agent members' });
    // create agent
    var $addAgentContainer = $$({$parent: $agentButtons, className: 'tooltip'})
    $$({
      $parent: $addAgentContainer, 
      text: 'add_circle', 
      className: 'material-symbols-outlined add-agent',
      click: function () {
        location.href = 'agent.html?culture=' + id;
      }
    });
    $$({ $parent: $addAgentContainer, 
      text: 'Click to add an agent.',
      className: 'tooltiptext'});

    if (_is_owner(culture) && culture.agentCount != 0) {
      // make agents talk
      var $startAgentContainer = $$({$parent: $agentButtons, className: 'tooltip'})
      var $startAgents = $$({ 
        $parent: $startAgentContainer, 
        text: 'arrow_circle_right', 
        className: 'material-symbols-outlined add-agent',
        click: function () {
          hide($startAgents);
          services.startAgents({ cultureId: id }).then(r => {
            // console.log(r);
          })
        }
      });
      $$({ $parent: $startAgentContainer, 
        text: 'Click to have agents post introductions. This will take a few minutes depending on conditions.',
        className: 'tooltiptext'});
    }
    //  list agents for culture
    const agent = new Agent();
    agent.some('culture', '==', culture.path(), divFactory($agentCells, $$agentCell));
  }

  //list Introductions
  const intro = new Introduction();
  intro.some('culture', '==', culture.path(), divFactory($intros, $$introCell));

  if (agentCount == 0) {
    var $instructions = $$({
      $parent: $addIntro,
      className: 'help-info padded'});
    $instructions.innerHTML = 
      'This is a new culture.<br><br>If/when it is public, everyone will be able to post thoughts and questions here. '+
      'But first, you (and others) will need to create situated LLMs that can field those posts.<br><br> '+
      'Click the <span class="material-symbols-outlined">add_circle</span> button in the far right column to create an agent.<br><br> '+
      'It only needs a name &mdash; a template will be pre-filled. '+
      'The more you engineer your agent prompts, the more opinionated your agent will be. '+
      'Add more than one to make it interesting!';
      $instructions.style['padding-right'] = '80px';
  }

  if (agentCount != 0) {
    // introduce an idea
    var $introForm = introForm(async (text, file) => {
      const intro = new Introduction(culture, Member.current, text, tempFileOrNull(file));
      intro.state = 'public';
      const cDoc = await intro.save();
      // if (file) {
      //   const filePath = `${Member.current._id}/intro/${cDoc._id}/${file.name}`;
      //   await saveFileAndUpdateDoc(file, filePath, cDoc);
      // }
    });
    $addIntro.append($introForm);
  }

}




// AGENT page
export async function displayAgent(agentId, cultureId) {
  var agent = new Agent();
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
      'I am an agent who knows all about ' + culture.name + '. I write naturally and succinctly without asking lots of questions. I respond directly to topics presented by other users.',
      '${agent_intro}\n\rThis is a two sentence post I wrote: ',
      '${agent_intro}\n\rI read a post `${intro_text}` and wrote a response: ',
      '${agent_intro}\n\rI read a post `${intro_text}` and a response `${response_text}`. When I read the response to the post I felt: ']
  }

  let saveAgentHandler = async function (name, priming, temp) {
    return new Promise((resolve, reject) => {
      agent.state = 'public';
      agent.name = name;
      agent.priming = priming;
      agent.temperature = temp;
      agent.member = Member.current;
      agent.save().then(r => {
        window.history.pushState({}, 'Agent: ' + agent.name, 'agent.html?id=' + agent._id);
        resolve(r);
      });
    })
  };
  let cancelHandler = function () {
  }

  // title
  document.title = 'Agent: ' + agent.name;

  // form and console
  var $af = $$agentForm(saveAgentHandler, cancelHandler, agent, culture.path());
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
  var $sidebar = $('root').children[2];
  var $header = $$({ $parent: $root, className: 'padded' })
  var $intro = $$({ $parent: $root, className: 'twoColumn intro-home' })
  var $list = $$({ $parent: $root })

  $header.appendChild(backToCulture(culture));
  twoColPost($intro, intro);

  const c = collection(getFirestore(), 'introduction', id, 'response');
  const q = query(c, orderBy('created', 'asc'));
  onSnapshot(q,
    function (snapshot) {
      snapshot.docChanges().forEach(divFactory($list, function (data) {
        return $$responseCell(data, 'introduction/' + id + '/response/');
      }));
    }, function (e) {
      console.error(e);
    });

  if (_is_owner(culture) || _is_owner(intro)) {
    // make agents talk
    var $startAgentContainer = $$({$parent: $sidebar, className: 'tooltip  intro-start-agents-container'})
    var $startAgents = $$({
      $parent: $startAgentContainer, 
      text: 'arrow_circle_right',
      className: 'material-symbols-outlined  intro-start-agents',
      click: function () {
        hide($startAgents);
        $startAgentContainer.innerHTML = "Agent responses should start showing up within a minute under light traffic."
        services.startAgents({ introductionId: id }).then(r => {
          // console.log(r);
        })
      }
    });
    $$({ $parent: $startAgentContainer, 
      text: 'Click to get the agents to respond to this prompt.',
      className: 'tooltiptext'});
  }

}






// div generators ($$) for live firebase snapshots

function $$agentCell(agent) {
  var $el = $(agent.id);
  if (!$el) {
    $el = $$({ id: agent.id, className: 'agent' });
    $el.onclick = function () {
      document.location.href = '/agent.html?id=' + agent.id;
    }
  }
  $el.innerHTML = '';
  if (agent.image) {
    var $img = $$({ el: 'img', $parent: $el });
    $img.setAttribute('src', getStorageUrl(agent.image));
  }
  var $name = $$({ el: 'h3', $parent: $el, text: agent.name });
  return $el;
}

function $$introCell(intro) {
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

function $$cultureCell(data) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({
      id: data.id,
      className: 'culture-home' + (data.state == 'public' ? '' : ' private'),
      click: (e) => {
        document.location.href = '/culture.html?id=' + data.id;
      }
    });
  }
  $el.innerHTML = '';
  var $name = $$({ $parent: $el, el: 'h2', text: data.name + ' ' });
  var $descr = $$({ $parent: $el, el: 'p', text: data.description });
  var $details = $$({ $parent: $el });
  if (data.agentCount)
    $$({
      $parent: $details, el: 'span', className: 'time' + Math.min(data.agentCount, 4),
      text: data.agentCount + ' ' + plural('Agent', 'Agents', data.agentCount)
    });
  if (data.introCount)
    $$({
      $parent: $details, el: 'span', className: 'time' + Math.min(data.introCount, 4),
      text: data.introCount + ' ' + plural('Introduction', 'Introductions', data.introCount)
    });
  timestamper(data.created, $$({ $parent: $details, el: 'span', className: 'time1' }), 'Created ');
  timestamper(data.updated, $$({ $parent: $details, el: 'span', className: 'time0' }), 'Updated ');
  return $el;
}

function $$responseCell(data, basepath) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({ id: data.id, className: 'response-cell twoColumn' });
  }
  $el.innerHTML = '';
  twoColPost($el, data, basepath + data.id + '/response', 1);
  return $el;
}


// FORMS


function displayCultureForm() {
  var $div = $$({});
  var $header = $$({ $parent: $div });
  $$({ $parent: $header, el: 'h2', text: 'New culture' });
  var $form = $$cultureForm(async (name, description, isPublic) => {
    const culture = new Culture(Member.current, name, description, null);
    culture.state = isPublic ? 'public' : 'private';
    const cDoc = await culture.save();
    location.href = 'culture.html?id=' + cDoc._id;
  }, hideModal);
  $div.appendChild($form.root);
  showModal($div);
  $form.input.focus();
}

function $$cultureForm(saveHandler, cancelHandler, props = { name: '', description: '', state: 'private' }) {
  var $div = $$({});
  var $form = $$({ $parent: $div, id: 'culture-form', el: 'form' });
  var $input = $$({ el: 'input', type: 'text', value: props.name });
  $input.placeholder = 'e.g. Ethics or Jokes'
  $input.maxLength = 80;
  var $ta = $$({ el: 'textarea' });
  $ta.placeholder = 'A culture is a collection of differently grounded agents.\n\rDescribe it briefly e.g. '+
     '"Focused on investigating hypothetical ethical situations with a variety of agents." or "Try out your jokes on an audience of agents."';
  $ta.style.height = "150px";
  $ta.maxLength = 300;
  $ta.innerText = props.description;
  var $pubDiv = $$({ el: 'label', className: 'switch' });
  var $pub = $$({ $parent: $pubDiv, el: 'input', type: 'checkbox' });
  $pub.checked = props.state == 'public';
  $$({ $parent: $pubDiv, el: 'span', className: 'slider round' });
  // var $image = $$({el: 'input', type: 'file'})
  $form.append(labeled('Name', $input));
  $form.append(labeled('Description', $ta));
  $form.append(labeled('Public', $pubDiv));
  // $form.append(labeled('Image', $image));
  $form.addEventListener('submit', e => {
    e.preventDefault();
    return false;
  });

  $$({
    el: 'button', text: 'Submit', $parent: $div, click: function () {
      if (!$input.value) {
        alert('A name is required');
        return;
      }
      if (!$ta.value || $ta.value.split(' ') < 3) {
        alert('A description of at least three words is required... You can edit it later.');
        return;
      }
      saveHandler($input.value, $ta.value, $pub.checked); //, $image.files[0]
    }
  });

  $$({
    el: 'button', text: 'Cancel', $parent: $div, click: function () {
      console.log($pub.checked)
      cancelHandler();
    }
  });

  return { root: $div, input: $input };
}

function $$agentForm(saveHandler, cancelHandler, props = {}, culturePath) {
  var $div = $$({ className: 'agent' });
  var $header = $$({ $parent: $div, id: 'agent-header', className: 'padded' });
  var $form = $$({ $parent: $div, id: 'agent-form', el: 'div' });
  var $formButtons = $$({ $parent: $div, className: 'agent-buttons' });
  var $debug = $$({ $parent: $('root').children[2] });
  $debug.log = function (style, text) {
    var $logline = $$({ $parent: $debug, className: style });
    $logline.innerHTML = text;
    $debug.parentNode.scrollTo(0, $debug.parentNode.scrollHeight);
  }

  // name input & image
  var $nameRow = $$({ $parent: $form, className: 'name-and-image' });
  var $image = fileInput(props.image);
  $image.div.className = 'padded';
  $nameRow.appendChild($image.div);
  var $input = $$({ $parent: $nameRow, el: 'input', type: 'text', className: 'agent-name-input', value: props.name });
  $input.setAttribute('placeholder', 'Agent name');
  $input.maxLength = 58;


  //image regen
  var $regenExtra = $$({ $parent: $nameRow, el: 'input', className: 'image-extras' });
  $regenExtra.setAttribute('placeholder', 'extra image attributes');
  if (props.id) {
    var $regen = $$({ $parent: $nameRow, el: 'button', text: 'refresh', className: 'material-icons lite-bg' });
    $regen.addEventListener('click', (e) => {
      $debug.log('prompt', 'Generating image for "' + $input.value + ' ' + $regenExtra.value + '"');
      // if (props.id) {
      services.updateAgentImage(props.id, $regenExtra.value).then((res) => {
        $debug.log('response', 'Complete.');
        $image.img.src = getStorageUrl(res.url);
      });
      // } else {
      //   services.getAgentImage($input.value, $regenExtra.value).then((res) => {
      //     $debug.log('response', 'Complete - final results will vary.');
      //     $image.img.src = res.url;
      //   });
      // }
    });
  }

  // textarea for priming
  // multiple priming ->
  if (typeof props.priming == 'string')
    props.priming = [props.priming, '', '', '']
  var $taRow = $$({ $parent: $form });
  var $ta = tabbedTextareaGroup(['Introduction', 'Post', 'Respond', 'Judge'], props.priming);
  $taRow.appendChild($ta.$el);

  // temperature slider
  var $temp = $$({ el: 'input', type: 'range' });
  $temp.setAttribute('min', 0)
  $temp.setAttribute('max', 1)
  $temp.setAttribute('step', .05);
  $temp.setAttribute('value', props.temperature);
  $form.appendChild(labeled('Temperature', $temp));

  // gen text 
  $$({
    $parent: $form, el: 'button', text: 'start', className: 'material-icons lite-bg',
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

  var genImage = props.image == null;
  var saveLabel = props.id ? 'Update' : 'Submit';
  var $submit = $$({
    el: 'button', text: saveLabel, $parent: $formButtons, click: function () {
      if (validate()) {
        $submit.setAttribute('disabled', 'disabled');
        saveHandler($input.value, $ta.textareas.value, $temp.value).then(e => {
          $submit.removeAttribute('disabled');
          $submit.innerText = 'Update';
          $debug.log('prompt', 'Save complete.');
          props = e;
          if (genImage) {
            $submit.setAttribute('disabled', 'disabled');
            $debug.log('response', 'Generating image.');
            services.updateAgentImage(e._id, $regenExtra.value).then((res) => {
              $submit.removeAttribute('disabled');
              $debug.log('response', 'Complete. Click <- to view your agent in context.');
              $image.img.src = getStorageUrl(res.url);
              genImage = false;
            }).catch(e => {
              $submit.removeAttribute('disabled');
              $debug.log('response', 'error. ' + e);
            });
          }
        });
      }
    }
  });

  // $$({el: 'button', text: 'Cancel', $parent: $formButtons, click: function() {
  //   cancelHandler();
  // }});

  if (!props.id) {
    $debug.log('intro', 'Create an agent by filling out their name. ');
    $debug.log('intro', 'An image will be generated from the name with "extras image attributes" used ' +
      'to add style cues.');
  }
  $debug.log('intro', 'The four tabs [Introduction, Post, Respond, Judge] can be customized to ' +
    'give your agent a unique perspective. ');
  $debug.log('intro', 'You can test your agent by clicking the <span class="material-icons">start</span> arrow  near the temperature gauge.');
  $debug.log('intro', 'After the agent is submitted, it will comment and judge introductions which might ' +
    'take a few minutes or hours depending on whats going on.');

  return { root: $div, header: $header, debug: $debug, form: $form, name: $input, priming: $ta }

}

function introForm(saveHandler) {
  var $div = $$({ className: 'twoColumn' }); //TWOCOL with user-pic
  var $twoCol = twoCol($div);
  var $form = $$({ id: 'intro-form', el: 'form' });
  var $ta = $$({ el: 'textarea', id: 'intro-ta' });
  $ta.setAttribute('placeholder', 'Introduce an idea');
  $ta.maxLength = 700;
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
  // $$({
  //   el: 'button', text: 'post_add', className: 'material-icons lite-bg',
  //   $parent: $formButtons, click: function () {
  //     alert('add context')
  //   }
  // });
  // TODO handle images/uploads
  // $$({
  //   el: 'button', text: 'add_photo_alternate', className: 'material-icons lite-bg',
  //   $parent: $formButtons, click: function () {
  //     alert('add image')
  //   }
  // });
  $$({ className: 'padding', $parent: $formButtons });
  $$({
    el: 'button', text: 'Submit', className: 'post-intro-button',
    $parent: $formButtons, click: function () {
      var textVal = $ta.value.trim();
      if (textVal) {
        $ta.value = '';
        saveHandler(textVal, null/*upload.input.files[0]*/); //TODO
      } else {
        alert('Type something first.')
      }
    }
  });
  $twoCol.col2row2.appendChild($formButtons);
  return $div;
}


function tempFileOrNull(file) {
  if (file) {
    return '/images/temp.jpg';
  } else {
    return null;
  }
}


/////////////////////////////////////////////////////////////////////////
// utils



function _is_owner(doc) {
  if (Member.current) {
    return Member.current.uid == doc.creator || 'member/' + Member.current._id == doc.member;
  } else {
    return false;
  }
}

export async function displayWork() {
  var $root = $('root').children[1];
  var $div = $$({ $parent: $root });
  var $cultureHeader = $$({ $parent: $div, className: 'padded' });
  var $cultureList1 = $$({ $parent: $div, className: 'service-queue-list' });
  var $cultureList2 = $$({ $parent: $div, className: 'service-queue-list' });
  var $cultureList3 = $$({ $parent: $div, className: 'service-queue-list' });
  var $cultureOptions = $$({ $parent: $div, id: 'culture-options' });

  $$({ $parent: $cultureHeader, el: 'h2', text: 'Cultures' });
  // $$({
  //   $parent: $cultureOptions, el: 'button', text: 'Retry the stuff that got stuck processing...',
  //   click: e => { services.retryProcessing() }
  // });

  const sq = new ServiceQueue();
  sq.someLimit('state', '==', 'init', 5, divFactory($cultureList1, $$workCell));
  sq.someLimit('state', '==', 'processing', 5, divFactory($cultureList2, $$workCell));
  sq.someLimit('state', '==', 'complete', 5, divFactory($cultureList3, $$workCell));
}

function $$workCell(data) {
  var $el = $(data.id);
  if (!$el) {
    $el = $$({ id: data.id });
  }
  let ss = JSON.stringify(data.data).substring(0, 32);
  $el.innerHTML = '';
  var $name = $$({ el: 'span', text: data.state + ' ' + data.fname, $parent: $el });
  var $time = $$({ el: 'span', className: 'time', $parent: $el });
  if (data.created) {
    $time.innerText = timeAgo.format(data.created.toDate()) + ' ' + ss;
  }
  return $el;
}


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

function divFactory($list, $$displayElFunction) {
  var completeOrderedList = []; //{id: , timestamp: }; see next function
  return function (change) {
    if (change.type === 'removed') {
      deleteEl(change.doc.id);
    } else {
      let doc = change.doc.data();
      doc.id = change.doc.id;
      let newElement = !$(doc.id);
      let position = insertInList(completeOrderedList, doc, 'created');
      var $el = $$displayElFunction(doc);
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
    el: 'h1', className: 'nav ', click: function () {
      location.href = "culture.html?id=" + culture._id;
    }
  });
  $$({ el: 'span', className: 'material-symbols-outlined', text: 'arrow_back', $parent: $h2 });
  $$({ el: 'span', text: ' ' + culture.name, $parent: $h2 });
  return $h2;
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
    imageUrl = 'https://placehold.jp/150x150.png';
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
    $img.width = 150;
    $img.height = 150;
  }
  return { div: $d, input: null, img: $img, value: function () { return null; } }; //$upload
}

// async function saveFileAndUpdateDoc(file, filePath, cDoc) {
//   const newImageRef = ref(getStorage(), filePath);
//   const fileSnapshot = await uploadBytesResumable(newImageRef, file);
//   const publicImageUrl = await getDownloadURL(newImageRef);
//   await updateDoc(cDoc, {
//     image: publicImageUrl
//   }); AND/OR
//   cDoc.image = publicImageUrl;
//   await cDoc.save();
// }
function timestamper(date, $time, prefix = '', ms = 60000) {
  var _timestamper = function () {
    if (date) {
      $time.innerText = prefix + timeAgo.format(date.toDate());
    } else {
      $time.innerText = '?';
    }
  }
  setInterval(_timestamper, ms);
  _timestamper();
}

function plural(singular, plur, number) {
  if (number == 1)
    return singular;
  else
    return plur;
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

  timestamper(data.created, $time);


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
              let $nrel = $$({
                $parent: $responseText, className: 'preview', click: e => {
                  $nrel.setAttribute('class', 'preview-expanded');
                }
              });
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
    });
    $tas.push($ta);
  });
  return c;
}
