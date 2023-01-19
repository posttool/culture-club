const DEFAULT_PARAMS = {
  "model": "text-curie-001",
  "temperature": 0.2,
  "max_tokens": 128,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}

const STYLE = [
  'jeff koons',
  'damien hirst',
  'yayoi kusama',
  'octane renderer, trending on CGsociety, 4k , unreal engine , wallpaper',
];

export class Agents {
  constructor(config, params = {...DEFAULT_PARAMS}) {
    this.openAIKey = config.openAIKey;
    this.params = params;
  }

  async getAgentResponse(prompt){
    return query(this.openAIKey, 'completions', {...this.params, 'prompt': prompt});
  }

  async getAgentImage(prompt) {
    prompt = prompt + ' ' + STYLE[Math.floor(Math.random()*STYLE.length)];
    console.log(prompt)
    return query(this.openAIKey, 'images/generations',
      {'size': '256x256', 'n': 1, 'prompt': prompt});
  }
}



export async function query(openai_api_key, path, params) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + openai_api_key
    },
    body: JSON.stringify(params)
  };
  const response = await fetch('https://api.openai.com/v1/' + path, requestOptions);
  const data = await response.json();
  return data;
}
