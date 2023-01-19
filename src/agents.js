const DEFAULT_PARAMS = {
  "model": "text-curie-001",
  "temperature": 0.2,
  "max_tokens": 128,
  "top_p": 1,
  "frequency_penalty": 0,
  "presence_penalty": 0
}

export class Agents {
  constructor(config, params = {...DEFAULT_PARAMS}) {
    this.openAIKey = config.openAIKey;
    this.params = params;
  }

  async getAgentResponse(prompt){
    return query(this.openAIKey, {...this.params, 'prompt': prompt});
  }
}



export async function query(openai_api_key, params) {
  const requestOptions = {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': 'Bearer ' + openai_api_key
    },
    body: JSON.stringify(params)
  };
  const response = await fetch('https://api.openai.com/v1/completions', requestOptions);
  const data = await response.json();
  return data;
}
