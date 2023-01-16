import { Configuration, OpenAIApi } from "openai";


export class Agents {
  constructor(config) {
    this.openai = new OpenAIApi(new Configuration({
      apiKey: config.openAIKey,
    }));
  }

  async getAgent1Response(){
    const response = await openai.createCompletion({
      model: "text-davinci-001",
      prompt: "Vertical farming provides a novel solution for producing food locally, reducing transportation costs and",
      temperature: 0.29,
      max_tokens: 64,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });
  }
}
