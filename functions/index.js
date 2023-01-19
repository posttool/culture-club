const {Firestore} = require('@google-cloud/firestore');
const functions = require("firebase-functions");
// The Firebase Admin SDK to access Firestore.
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

const openAIKey = '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';
const MAX_AGENTS_PER_INTRO = 100;


exports.helloWorld = functions.https.onRequest((request, response) => {
  functions.logger.info(functions.firestore);
  response.send("Hello from XXX!");
});

exports.onCreateCulture = functions.firestore.document('/culture/{docId}')
  .onCreate((change, context) => {
    functions.logger.info("Hello !!!! - >", change, context);
    console.log("XXX@@@@")
  });

exports.onCreateIntroduction = functions.firestore.document('/introduction/{docId}')
  .onCreate((change, context) => {
    var intro = change.data();
    intro.id = context.params.docId;
    functions.logger.info(intro);

    let agentQuery = db.collection('member')
      .where('culture', '==', intro.culture)
      .orderBy('created', 'asc');

    // operation could be more durable :D
    agentQuery.stream().on('data', (doc) => {
        var agent = doc.data();
        if (agent.type == 'Responder') {
          ___cquery(openAIKey, agent.priming + intro.text).then(function(e){
            //console.log(e.choices[0].text);
            // create a response and add it an array in the intro?
            const data = {
              created: Firestore.FieldValue.serverTimestamp(),
              text: e.choices[0].text,
              stats: {
                adopted: 0,
                rejected: 0
              }
            };
            // Add a new response to the intro
            const res = db
              .collection('introduction')
              .doc(intro.id)
              .collection('response')
              .add(data);

            res.then(doc => {
              console.log('inserted agent response '+doc.text);
            })

          });
        }
    }).on('end', () => {
      console.log(`end`);
    });

});



async function ___cquery(openai_api_key, prompt) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + openai_api_key
    },
    body: JSON.stringify({
      "model": "text-curie-001",
      "temperature": 0.2,
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
