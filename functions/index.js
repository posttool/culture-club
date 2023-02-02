
const { google } = require('googleapis');
const customsearch = google.customsearch('v1');

const { Firestore } = require('@google-cloud/firestore');
const functions = require("firebase-functions");
const { defineSecret } = require('firebase-functions/params');
const openAIApiKey = defineSecret('OPENAI_API_KEY');
const googleSearchKey = defineSecret('GOOGLE_SEARCH_KEY');


// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

const chain = require('./chain');

const MODEL = "text-davinci-003";
// const MODEL = "text-curie-001";
// const MAX_AGENTS_PER_INTRO = 100;
const STYLE = [
  'jeff koons',
  'damien hirst',
  'yayoi kusama',
  'octane renderer, trending on CGsociety, 4k , unreal engine , wallpaper',
];

function oneOf(a) {
  return a[Math.floor(Math.random() * a.length)];
}

exports.helloWorld = functions
  .runWith({ secrets: [openAIApiKey, googleSearchKey] })
  .https.onRequest((request, response) => {
    // getAll().then(o => {
    //   response.json(o);
    // });
    _processQ(getServices(openAIApiKey.value(), googleSearchKey.value()));
    return true;
  });

exports.testSearch = functions
  .runWith({ secrets: [googleSearchKey] })
  .https.onRequest((req, res) => {
    customsearch.cse.list({
      cx: 'b31b5c857da0046b8',
      q: 'howdee',
      auth: googleSearchKey.value(),
    }).then(r => {
      res.json(r.data);
    });
  });

// exports.getUrl = functions.https.onCall(async (data, context) => {
//     const options = {
//       version: 'v4',
//       action: 'read',
//       expires: Date.now() + 15 * 60 * 1000, // 15 minutes
//     };
//     const [url] = await bucket.file(data).getSignedUrl(options);
//     return url;
// });

async function getContext(culturePath, ctx = {}) {
  var C = {
    ...ctx, //agent_intro
    culture_name: null,
    culture_description: null,
    now: new Date()
  };
  if (culturePath) {
    var cultureSnap = await db.doc(culturePath).get();
    var culture = cultureSnap.data();
    C.culture_name = culture.name;
    C.culture_description = culture.description;
  }
  return C;
}

async function addContextSamples(culturePath, ctx = {}) {
  ctx.intro_samples = [];
  var introSnap = await db.collection('introduction')
    .where('culture', '==', culturePath)
    .orderBy('created', 'asc').limit(3).get();
  introSnap.docs.forEach((doc) => {
    ctx.intro_samples.push(doc.data())
  });
  if (ctx.intro_samples.length != 0)
    ctx.intro_text = oneOf(ctx.intro_samples).text;
}

function getServices(openai, google) {
  return {
    predict: async (p, temp) => {
      var e = await ___cquery(openai, p, temp);
      return e.choices[0].text;
    },
    search: async q => {
      var result = await customsearch.cse.list({
        cx: 'b31b5c857da0046b8',
        q: q,
        auth: google,
      });
      //console.log(result.data.items);
      return result.data.items;
    }
  }
}

exports.testPriming = functions
  .runWith({ secrets: [openAIApiKey, googleSearchKey] })
  .https.onCall(async (data, context) => {
    const services = getServices(openAIApiKey.value(), googleSearchKey.value());
    var ctx = await getContext(data.culture_id, data);
    await addContextSamples(data.culture_id, ctx);
    var c = new chain.Chain(data.prompt, data.temp, ctx, services);
    try {
      await c.execute()
    } catch (e) {
    }
    return { text: c.lastResult, log: c.log };
  });

exports.testImage = functions
  .runWith({ secrets: [openAIApiKey] })
  .https.onCall(async (data, context) => {
    var prompt = data.prompt + ' ' + data.xtra;
    const e = await ___igquery(openAIApiKey.value(), prompt.trim());
    return { url: e.data[0].url };
  });

exports.updateImage = functions
  .runWith({ secrets: [openAIApiKey] })
  .https.onCall(async (data, context) => {
    const agentDoc = db.collection('member').doc(data.agent_id);
    const agentSnap = await agentDoc.get();
    const agent = agentSnap.data();
    agent.id = agentSnap.id;
    const url = await createImageForAgent(openAIApiKey.value(), agent, data.xtra);
    const r = await agentDoc.update({ image: url });
    return { url: url };
  });

async function createImageForAgent(key, member, xtra) {
  var prompt = member.name + ' ' + xtra;
  console.log('create ' + prompt);
  var e = await ___igquery(key, prompt.trim());
  // if e.error ...
  let fimg = await fetch(e.data[0].url);
  let fimgb = Buffer.from(await fimg.arrayBuffer());
  //copy to storageBucket
  const morepath = Math.floor(Math.random() * 10000000000);
  const filePath = `${member.id}/${morepath}/user-pic.jpg`;
  const file = bucket.file(filePath);
  await file.save(fimgb);
  return filePath;
}

// exports.onCreateMember = functions
//   .runWith({ secrets: [openAIApiKe, googleSearchKey] })
//   .firestore.document('/member/{docId}')
//   .onCreate(async (change, context) => {
//     const member = change.data();
//     member.id = context.params.docId;
//     functions.logger.info(member);
//     if (member.priming) {
//       // its an agent
//       if (!member.image) {
//         var filePath = await createImageForAgent(openAIApiKey.value(), member);
//         return change.ref.set({
//           image: filePath
//         }, { merge: true });
//       }
//     }
//     return true;
//   });

// When an introduction is created, fire up all the agents...
exports.onCreateIntroduction = functions
  .runWith({ secrets: [openAIApiKey, googleSearchKey] })
  .firestore.document('/introduction/{docId}')
  .onCreate((change, context) => {
    var intro = change.data();
    intro.id = context.params.docId;
    let agentQuery = db.collection('member')
      .where('culture', '==', intro.culture)
      .orderBy('created', 'asc');

    agentQuery.stream().on('data', (doc) => {
      var agent = doc.data();
      agent.id = doc.id;
      if ('member/' + agent.id != intro.member) {
        // ___queue(function () {
        //   return addResponse(openAIApiKey.value(), googleSearchKey.value(), agent, intro);
        // });
        _queue('add-response', { agent: agent, intro: intro });
      }
    }).on('end', () => {
    });
    return true;
  });

exports.onCreateResponse = functions
  .runWith({ secrets: [openAIApiKey, googleSearchKey] })
  .firestore.document('/introduction/{introId}/response/{responseId}')
  .onCreate((change, context) => {
    var response = change.data();
    response.id = context.params.responseId;
    const intro = db.collection('introduction')
      .doc(context.params.introId)
      .get().then((e) => {
        let intro = e.data();
        intro.id = e.id;

        let agentQuery = db.collection('member')
          .where('culture', '==', intro.culture)
          .orderBy('created', 'asc');

        agentQuery.stream().on('data', (doc) => {
          var agent = doc.data();
          agent.id = doc.id;
          if ('member/' + agent.id != response.member) {
            // ___queue(function () {
            //   return addResponseJudgement(openAIApiKey.value(), googleSearchKey.value(), agent, intro, response);
            // });
            _queue('add-response-judgement', { agent: agent, intro: intro, response: response });

          }
        }).on('end', () => {
        });
        return true;
      });
  });

function addIntro(services, agent) {
  return new Promise((resolve, reject) => {
    getContext(agent.culture, {
      agent_intro: agent.priming[0]
    }).then(ctx => {
      console.log('  add intro agent ' + agent.name);
      var c = new chain.Chain(agent.priming[1], agent.temperature, ctx, services);
      c.execute().then(result => {
        if (!c.lastResult) {
          console.log('error?');
          console.log(c.logs)
          reject();
          return;
        }
        // create a response and add it
        const data = {
          created: Firestore.FieldValue.serverTimestamp(),
          member: 'member/' + agent.id,
          culture: agent.culture,
          text: c.lastResult,
          log: c.log,
          stats: {
            adopted: 0,
            rejected: 0
          }
        };
        // a sub collection in the introduction
        const res = db
          .collection('introduction')
          .add(data);

        res.then(doc => {
          resolve(doc)
        })

      });
    });
  });
}


function addResponse(services, agent, intro) {
  return new Promise((resolve, reject) => {
    getContext(agent.culture, {
      agent_intro: agent.priming[0],
      intro_text: intro.text,
      created: intro.created.toDate().toString()
    }).then(ctx => {
      var c = new chain.Chain(agent.priming[2], agent.temperature, ctx, services);
      c.execute().then(result => {
        if (!c.lastResult) {
          reject();
          return;
        }
        // create a response and add it
        const data = {
          created: Firestore.FieldValue.serverTimestamp(),
          member: 'member/' + agent.id,
          text: c.lastResult,
          log: c.log,
          stats: {
            adopted: 0,
            rejected: 0
          }
        };
        // a sub collection in the introduction
        const res = db
          .collection('introduction')
          .doc(intro.id)
          .collection('response')
          .add(data);

        res.then(doc => {
          resolve(doc);
        });

      }).catch(reject);
    });


  });
}


function addResponseJudgement(services, agent, intro, response) {
  return new Promise((resolve, reject) => {
    getContext(agent.culture, {
      agent_intro: agent.priming[0],
      intro_text: intro.text,
      response_text: response.text,
      created: response.created.toDate().toString()
    }).then(ctx => {
      var c = new chain.Chain(agent.priming[3], agent.temperature, ctx, services);
      c.execute().then(result => {
        if (!c.lastResult) {
          reject();
          return;
        }
        // create a response and add it
        const data = {
          created: Firestore.FieldValue.serverTimestamp(),
          member: 'member/' + agent.id,
          text: c.lastResult,
          log: c.log,
          stats: {
            adopted: 0,
            rejected: 0
          }
        };
        // a sub collection in the introduction
        const res = db
          .collection('introduction')
          .doc(intro.id)
          .collection('response')
          .doc(response.id)
          .collection('response')
          .add(data);

        res.then(doc => {
          // console.log(doc)
          resolve(doc);
        });
      });
    });
  });
}

exports.scheduledFunction = functions
  .runWith({ secrets: [openAIApiKey, googleSearchKey] })
  .pubsub.schedule('* * * * *').onRun((context) => {
    functions.logger.info('This runs every minute!');
    _processQ(getServices(openAIApiKey.value(), googleSearchKey.value()));
    return true;
  });

exports.callAgentsForCulture = functions
  .https.onCall((data, context) => {
    functions.logger.info('callAgentsForCulture ' + data);
    promptAgents('culture/' + data);
    return true;
  });

function promptAgents(culturePath) {
  let agentQuery = db.collection('member')
    .where('culture', '==', culturePath)
    .orderBy('created', 'asc');

  agentQuery.stream().on('data', (doc) => {
    let agent = doc.data();
    agent.id = doc.id;
    functions.logger.info('   prompt agent ' + agent.name + ' ' + agent.id);
    _queue('add-intro', agent);
  });
}


async function ___cquery(openai_api_key, prompt, temperature) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + openai_api_key
    },
    body: JSON.stringify({
      "model": MODEL,
      "temperature": Number(temperature),
      "max_tokens": 128,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0,
      "prompt": prompt
    })
  };
  const response = await fetch('https://api.openai.com/v1/completions', requestOptions);
  const data = await response.json();
  if (data.error) {
    console.log("ERROR");
    console.log(data.error);
  }
  return data;
}


async function ___igquery(openai_api_key, prompt) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + openai_api_key
    },
    body: JSON.stringify({
      "n": 1,
      "size": "256x256",
      "prompt": prompt
    })
  };
  const response = await fetch('https://api.openai.com/v1/images/generations', requestOptions);
  const data = await response.json();
  return data;
}



async function _queue(fname, data) {
  var qDoc = await db.collection('service-queue').add({
    fname: fname,
    data: data,
    state: 'init',
    created: Firestore.FieldValue.serverTimestamp()
  });
  return qDoc;
}


async function _processQ(services, batchSize = 8) {
  const qRef = db.collection('service-queue')
  const qQuery = qRef.where('state', '==', 'init').orderBy('created', 'asc').limit(batchSize)
  return new Promise((resolve, reject) => {
    _processQBatch(services, qQuery, resolve).catch(reject);
  });
}

async function _processQBatch(services, query, resolve) {
  const snapshot = await query.get();
  const batchSize = snapshot.size;
  if (batchSize === 0) {
    resolve();
    return;
  }

  functions.logger.info('processing batch');
  const batch = db.batch();
  for (let i = 0; i < snapshot.docs.length; i++) {
    let doc = snapshot.docs[i];
    doc.ref.update({ state: 'processing' });
  }
  await batch.commit();
  for (let i = 0; i < snapshot.docs.length; i++) {
    let doc = snapshot.docs[i];
    await _processRequest(services, doc.data());
    await doc.ref.update({ state: 'complete' });
  };
  // TODO clean up processing ...
}

async function _processRequest(services, r) {
  functions.logger.info('  process request '+r.fname);
  switch (r.fname) {
    case 'add-intro':
      return addIntro(services, r.data);
    case 'add-response':
      return addResponse(services, r.data.agent, r.data.intro);
    case 'add-response-judgement':
      return addResponseJudgement(services, r.data.agent, r.data.intro, r.data.response);
  }
}

// dump
async function getAll() {
  var memberSnapshot = await db.collection('member').get();
  var memberHash = {}
  memberSnapshot.docs.forEach((doc) => {
    memberHash[doc.id] = doc.data();
  });
  var culturesSnapshot = await db.collection('culture').get();
  var cultures = [];
  culturesSnapshot.docs.forEach((cultureDoc) => {
    let culture = cultureDoc.data();
    culture.id = cultureDoc.id;
    cultures.push(culture);
  });
  var intros = [];
  var introHash = {};
  let introSnapshot = await db.collection('introduction')
    .orderBy('created', 'asc').get();
  introSnapshot.docs.forEach(async (introDoc) => {
    let intro = introDoc.data();
    intro.id = introDoc.id;
    intro.responses = [];
    intros.push(intro);
    introHash[intro.id] = intro;
  });
  for (var i = 0; i < intros.length; i++) {
    let intro = intros[i];
    let respSnapshot = await db.collection('introduction').doc(intro.id)
      .collection('response').get()
    for (var j = 0; j < respSnapshot.docs.length; j++) {
      let respDoc = respSnapshot.docs[j];
      let response = respDoc.data();
      response.id = respDoc.id;
      response.responses = [];
      introHash[intro.id].responses.push(response);
      let resprespSnapshot = await db.collection('introduction').doc(intro.id)
        .collection('response').doc(response.id).collection('response').get();
      for (var k = 0; k < resprespSnapshot.docs.length; k++) {
        let resprespDoc = resprespSnapshot.docs[k];
        let respresp = resprespDoc.data();
        respresp.id = resprespDoc.id;
        response.responses.push(respresp);
      }
    }
  }

  return { cultures: cultures, members: memberHash, intros: intros };
}