const {Firestore} = require('@google-cloud/firestore');
const functions = require("firebase-functions");
const { defineSecret } = require('firebase-functions/params');
const openAIApiKey = defineSecret('OPENAI_API_KEY');


// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();
const bucket = admin.storage().bucket();

const search = require('./search');

// const MAX_AGENTS_PER_INTRO = 100;
const STYLE = [
  'jeff koons',
  'damien hirst',
  'yayoi kusama',
  'octane renderer, trending on CGsociety, 4k , unreal engine , wallpaper',
];

function oneOf(a) {
  return a[Math.floor(Math.random()*a.length)];
}

function TemplateEngine(tpl, data = {}) {
  var re = /\$\{([^\}]+)?\}/g, match;
  while(match = re.exec(tpl)) {
      tpl = tpl.replace(match[0], data[match[1]]);
  }
  return tpl;
}

function FunctionEngine(tpl, data = {}) {
  var funcs = [];
  var re = /\$\$(.+)?\$\$/g, match;
  while(match = re.exec(tpl)) {
    tpl = tpl.replace(match[0], '');
    funcs.push(match[1])
  }
  return {text: tpl, funcs: funcs};
}

exports.helloWorld = functions.https.onRequest((request, response) => {
  search.googs2('mystic minimalist music').then(results => {
    response.send("Hello  !"+results);
  })
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
async function getContext(culturePath){
  var C = {
    culture_name: '',
    intro_samples: [],
    intro_text: '',
    now: new Date()
  };
  if (culturePath) {
    var culture = await db.doc(culturePath).get();
    C.culture_name = culture.data().name;
    var introSnap = await db.collection('introduction')
      .where('culture', '==', culturePath)
      .orderBy('created', 'asc').limit(3).get();
    introSnap.docs.forEach((doc) => {
        C.intro_samples.push(doc.data())
    });
    if (C.intro_samples.length != 0)
      C.intro_text = oneOf(C.intro_samples);
  }
  return C;
}

exports.testPriming =  functions
  .runWith({ secrets: [openAIApiKey] })
  .https.onCall(async (data, context) => {
    async function predictF(p) {
      var e = await ___cquery(openAIApiKey.value(), p, data.temperature);
      return e.choices[0].text;
    }
    var ctx = await getContext(data.cultureId);
    if (data.prompt.startsWith('// chain')) {
      var c = new Chain(data.prompt, ctx, predictF);
      await c.execute()
      return {text: c.lastResult};
    } else {
      return {text: await predictF(data.prompt)};
    }
  });

exports.testImage = functions
  .runWith({ secrets: [openAIApiKey] })
  .https.onCall(async (data, context) => {
    var prompt = data.prompt;
    var e = await ___igquery(openAIApiKey.value(), prompt);
    return {url: e.data[0].url};
  });

class Chain {
  constructor(rawtext, context, predictionFunction) {
    this.rawtext = rawtext;
    this.context = context;
    this.predictionFunction = predictionFunction;
    this.chain = rawtext.split(/\d+\./g);
    if (this.chain[0].startsWith('// chain'))
      this.chain.shift();
    this.step = 0;
    this.results = new Array(this.chain.length);
    this.log = [];
  }
  async execute(){
    await this._exec();
    return true;
  }
  async _exec() {
    if (this.step == this.chain.length) {
      return;
    }
    var p = this.chain[this.step].trim();
    // var result = await this.predictionFunction(FunctionEngine(p, this.context));
    var preprocessed = FunctionEngine(p, this.context);
    var result;
    if (preprocessed.text) {
      var p = TemplateEngine(preprocessed.text, this.context);
      result = String(await this.predictionFunction(p)).trim();
      this.log.push(this.step+" -> "+preprocessed.text+' '+result)
    }
    if (preprocessed.funcs.length != 0) {
      let func = preprocessed.funcs[0];
      if (func.startsWith('rejectif')) {
        this.log.push(this.step+"  rrr "+func.substring(9).trim()+" "+result)
        if (result == func.substring(9).trim()) {
          this.log.push("REJECTED "+result)
          throw new Error('exit', this);
        }
      }
      if (func.startsWith('search') ) {
        var arg = TemplateEngine(func.substring(7), this.context);
        this.log.push(this.step+"  sss "+arg.substring(0,30))
        result =  await search.googs2(arg);
        if (result.length>2000)
          result = result.substring(result.length-2000);
      }
    }
    this.lastResult = result;
    this.log.push(result);
    this.results.push(result);
    this.context['result_'+(this.step+1)] = result;
    this.step++;
    await this._exec();
  }
}




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
      if (agent.priming[3] && 'member/' + agent.id != intro.member) {
        ___queue(function() {
          return addResponse(openAIApiKey.value(), agent, intro);
        });
      }
    }).on('end', () => {
      return true;
    });
});

exports.onCreateResponse = functions
  .runWith({ secrets: [openAIApiKey] })
  .firestore.document('/introduction/{introId}/response/{responseId}')
  .onCreate((change, context) => {
    var response = change.data();
    response.id = context.params.responseId;
    const intro = db
      .collection('introduction')
      .doc(context.params.introId).get().then((e)=>{
        let intro = e.data();
        intro.id = e.id;

        let agentQuery = db.collection('member')
          .where('culture', '==', intro.culture)
          .orderBy('created', 'asc');

        agentQuery.stream().on('data', (doc) => {
          var agent = doc.data();
          agent.id = doc.id;
          if (agent.priming[3] && 'member/' + agent.id != response.member) {
            ___queue(function() {
              return addResponseJudgement(openAIApiKey.value(), agent, intro, response);
            });
          }
        }).on('end', () => {
          return true;
        });

      });
});


function addResponse(key, agent, intro) {
  return new Promise((resolve, reject) => {
    var context = {
      author_name: '*',
      intro_text: intro.text,
      created: intro.created.toDate().toString()
    };
    var prompt = TemplateEngine(agent.priming[0] + agent.priming[2], context);
    ___cquery(key, prompt).then(function(e){
      if (e.error) {
        reject(e);
        return;
      }
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
        resolve(doc);
      });
    });
  });
}


function addResponseJudgement(key, agent, intro, response) {
  return new Promise((resolve, reject) => {
    var context = {
      author_name: '*',
      intro_text: intro.text,
      response_text: response.text,
      created: response.created.toDate().toString()
    };
    var prompt = TemplateEngine(agent.priming[0] + agent.priming[3], context);
    ___cquery(key, prompt).then(function(e){
      if (e.error) {
        reject(e);
        return;
      }
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
        .doc(response.id)
        .collection('response')
        .add(data);

      res.then(doc => {
        // console.log(doc)
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
    let culture = doc.data();
    culture.id = doc.id;
    if (culture) {
      // addIntro(openAIApiKey.value(), agent);
      functions.logger.info('   '+aculture.name+' wants to hear from its agents!');
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

exports.callAgentsForCulture = functions.https.onCall((data, context) => {
  promptAgents(data);
  return true;
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
    if (agent.priming[1]) {
      ___queue(function() {
        return addIntro(openAIApiKey.value(), agent);
      });
    }

  }).on('end', () => {
    console.log(`end`);
  });
}

function addIntro(key, agent) {
  return new Promise((resolve, reject) => {
    // TODO context?
    ___cquery(key, agent.priming[0] +' '+ agent.priming[1]).then(e => {
      if (e.error) {
        reject(e);
        return;
      }
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
        resolve(doc)
      })

    });
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
      console.log("q finished work  ")
      __checkQ();
    })
    .catch((err) => {
      console.log("q ERROR")
      console.error(err);
      __checkQ();
    });;
}


// TODO persist q something like this

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
