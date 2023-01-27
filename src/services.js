import { getFunctions, httpsCallable } from "firebase/functions";



export class Services {
  constructor(functions) {
    this.testPriming = httpsCallable(functions, 'testPriming');
    this.testImage = httpsCallable(functions, 'testImage');
    this.startAgents = httpsCallable(functions, 'callAgentsForCulture');
    this.getUrl = httpsCallable(functions, 'getUrl');
    this.urlCache = {};
  }

  async getAgentResponse(prompt, temperature = 0.333, options = {}){
    var res = await this.testPriming({ ...options,
      prompt: prompt, temperature: temperature});
    return res.data;
  }

  async getAgentImage(prompt) {
    prompt = prompt + ' ' + STYLE[Math.floor(Math.random()*STYLE.length)];
    var res = await this.testImage({prompt: prompt});
    return res.data;
  }

  async startAgents(cultureId){
    var res = await this.startAgents({cultureId: cultureId});
    return res.data;
  }

  async getUrl(path){
    if (this.urlCache[path])
      return this.urlCache[path];
    var res = await this.getUrl({path: path});
    this.urlCache[path] = res.data;
    return res.data;
  }
}
