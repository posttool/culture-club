const {Firestore} = require('@google-cloud/firestore');
const functions = require("firebase-functions");
const { defineSecret } = require('firebase-functions/params');
const openAIApiKey = defineSecret('OPENAI_API_KEY');


// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

// const MAX_AGENTS_PER_INTRO = 100;

exports.helloWorld = functions.https.onRequest((request, response) => {
  response.send("Hello  !");
});

exports.getUrl = functions.https.onCall(async (data, context) => {
    const options = {
      version: 'v4',
      action: 'read',
      expires: Date.now() + 15 * 60 * 1000, // 15 minutes
    };
    const [url] = await bucket.file(data).getSignedUrl(options);
    return url;
});

exports.testPriming =  functions
  .runWith({ secrets: [openAIApiKey] })
  .https.onCall(async (data, context) => {
    var priming = data.priming;
    var temp = data.temperature;
    var e = await ___cquery(openAIApiKey.value(), priming, temp);
    return {text: e.choices[0].text};
  });

exports.testImage = functions
  .runWith({ secrets: [openAIApiKey] })
  .https.onCall(async (data, context) => {
    var prompt = data.prompt;
    var e = await ___igquery(openAIApiKey.value(), prompt);
    return {url: e.data[0].url};
  });

// exports.onCreateCulture = functions.firestore.document('/culture/{docId}')
//   .onCreate((change, context) => {
//     functions.logger.info("Hello !!!! - >", change, context);
//     console.log("XXX@@@@")
//   });

exports.onCreateMember = functions
  .runWith({ secrets: [openAIApiKey] })
  .firestore.document('/member/{docId}')
  .onCreate(async (change, context) => {
    const member = change.data();
    member.id = context.params.docId;
    functions.logger.info(member);
    if (member.priming) {
      // its an agent
      if (!member.image) {
        var prompt = member.name;
        var e = await ___igquery(openAIApiKey.value(), prompt);
        let fimg = await fetch(e.data[0].url)
        let fimgb = Buffer.from(await fimg.arrayBuffer());
        //copy to storageBucket
        const filePath = `${member.id}/user-pic.jpg`;
        const file = await bucket.file(filePath);
        await file.save(fimgb);
        return change.ref.set({
          image: filePath
        }, {merge: true});
      }
    }
    return true;
  });

// When an introduction is created, fire up all the agents...
exports.onCreateIntroduction = functions
  .runWith({ secrets: [openAIApiKey] })
  .firestore.document('/introduction/{docId}')
  .onCreate((change, context) => {
    var intro = change.data();
    intro.id = context.params.docId;
    functions.logger.info(intro);

    let agentQuery = db.collection('member')
      .where('culture', '==', intro.culture)
      .orderBy('created', 'asc');

    agentQuery.stream().on('data', (doc) => {
      var agent = doc.data();
      agent.id = doc.id;
      if (agent.type == 'Responder') {
        ___queue(function(){
          return addResponse(openAIApiKey.value(), agent, intro);
        });
      }
    }).on('end', () => {
      console.log(`end`);
      return true;
    });

});

function addResponse(key, agent, intro) {
  console.log(agent.priming + intro.text);
  return new Promise((resolve, reject) => {
    ___cquery(key, agent.priming + intro.text).then(function(e){
      console.log(e);
      // create a response and add it
      const data = {
        created: Firestore.FieldValue.serverTimestamp(),
        member: 'member/'+agent.id,
        text: e.choices[0].text,
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
        console.log('inserted agent response '+doc.text);
        resolve(doc);
      });
    });
  });
}

exports.scheduledFunction = functions.pubsub.schedule('every 30 seconds').onRun((context) => {
  functions.logger.info('This will be run every 30 seconds!');
  let cultureQuery = db.collection('culture')
    .orderBy('created', 'asc');

  agentQuery.stream().on('data', (doc) => {
    let agent = doc.data();
    let agentId = agent.id = doc.id;
    if (agent.type == 'Prompter') {
      addIntro(openAIApiKey.value(), agent);
    }
  }).on('end', () => {
    console.log(`end`);
  });

  return true;
});

exports.startPromptingAgentsForCulture = functions.https.onRequest((request, response) => {
  if (!request.query.id)
    throw new Error('need id')
  promptAgents(request.query.id);
  response.send("OK "+request.query.id);
});

function promptAgents(cultureId) {
  if (!cultureId.startsWith('culture/')) {
    cultureId = 'culture/' + cultureId;
  }
  let agentQuery = db.collection('member')
    .where('culture', '==', cultureId)
    .orderBy('created', 'asc');

  agentQuery.stream().on('data', (doc) => {
    let agent = doc.data();
    let agentId = agent.id = doc.id;
    if (agent.type == 'Prompter') {
      addIntro(openAIApiKey.value(), agent);
    }
  }).on('end', () => {
    console.log(`end`);
  });
}

function addIntro(key, agent) {
  ___cquery(key, agent.priming ).then(function(e){
    // create a response and add it
    const data = {
      created: Firestore.FieldValue.serverTimestamp(),
      member: 'member/' + agent.id,
      culture: agent.culture,
      text: e.choices[0].text,
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
      console.log('inserted agent  '+doc.text);
    })

  });
}


async function ___cquery(openai_api_key, prompt) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + openai_api_key
    },
    body: JSON.stringify({
      "model": "text-davinci-003",
      "temperature": 0.35,
      "max_tokens": 128,
      "top_p": 1,
      "frequency_penalty": 0,
      "presence_penalty": 0,
      "prompt": prompt
    })
  };
  const response = await fetch('https://api.openai.com/v1/completions', requestOptions);
  const data = await response.json();
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


// could be better
var __q = [];
var __working = false;
function ___queue(f){
  __q.push(f);
  if (!__working)
    __checkQ();
}
function __checkQ() {
  if (__q.length ==0) {
    __working = false;
    return;
  }
  __working = true;
  var f = __q.pop();
  f()
    .then((e)=> {
      console.log("q finished work with result "+e)
      __checkQ();
    })
    .catch((err) => {
      console.error(err);
      __working = false;
    });;
}


// sample delete collection https://firebase.google.com/docs/firestore/manage-data/delete-data#node.js_2


async function deleteCollection(db, collectionPath, batchSize) {
  const collectionRef = db.collection(collectionPath);
  const query = collectionRef.orderBy('__name__').limit(batchSize);

  return new Promise((resolve, reject) => {
    deleteQueryBatch(db, query, resolve).catch(reject);
  });
}

async function deleteQueryBatch(db, query, resolve) {
  const snapshot = await query.get();

  const batchSize = snapshot.size;
  if (batchSize === 0) {
    // When there are no documents left, we are done
    resolve();
    return;
  }

  // Delete documents in a batch
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();

  // Recurse on the next process tick, to avoid
  // exploding the stack.
  process.nextTick(() => {
    deleteQueryBatch(db, query, resolve);
  });
}
