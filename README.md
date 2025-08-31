# culture-club

some creative decoding

a text adventure, a game

# Notes about setup:

## Requires NPM
https://nodejs.org/en/download/

## Requires Firebase Tools
npm install -g firebase-tools

## Starting the app
npm run start  
firebase emulators:start  
firebase serve --only functions,hosting,firestore  

## Consuming response queue
Since queueing only works in production, you have to hit
http://localhost:5001/culture-club-333/us-central1/localUtility
to get agents to respond to an introduction

## To deploy
firebase deploy

## To view logs
https://console.cloud.google.com/logs/query;query=resource.type%20%3D%20%22cloud_function%22%0Aresource.labels.region%20%3D%20%22us-central1%22%0A%20severity%3E%3DDEFAULT;storageScope=project;?inv=1&invt=Ab5a8Q&project=culture-club-333