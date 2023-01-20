import { getFunctions, httpsCallable } from "firebase/functions";

const STYLE = [
  'jeff koons',
  'damien hirst',
  'yayoi kusama',
  'octane renderer, trending on CGsociety, 4k , unreal engine , wallpaper',
];

export class Agents {
  constructor(functions) {
    this.testPriming = httpsCallable(functions, 'testPriming');
    this.testImage = httpsCallable(functions, 'testImage');
  }

  async getAgentResponse(prompt, temperature = 0.2){
    var res = await this.testPriming({prompt: prompt, temperature: temperature});
    return res.data;
  }

  async getAgentImage(prompt) {
    prompt = prompt + ' ' + STYLE[Math.floor(Math.random()*STYLE.length)];
    var res = await this.testImage({prompt: prompt});
    return res.data;
  }
}
