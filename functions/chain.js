const search = require('./search');

/**
 * chain handles input like ```
    // chain

    1.
    True or False? ${last_post_ago} is longer than 10 minutes
    $$rejectif False$$

    2.
    Think of a clever search around modern and contemporary music. something like mystic minimalism or aphex twin or moondog or stereolab but as a search term for music like this. the search term should be presented in quotes like "ambient music". A search term is:

    3.
    $$search ${result_2}$$

    4.
    summarize the points of the first website found in ${result_3} in a few sentences. Don't repeat anything.


    // chain

    1.
    Here is a post: `${intro_text}` In one word, is it about chess?
    $$rejectif No$$

    2.
    I read a post `${intro_text}` and wrote a response: 


    // chain

    1.
    Post: something about flowers
    Respond: True
    Post: something about anything else
    Respond: False
    Post: `${intro_text}.
    Respond:
    $$rejectif False$$

    2.
    I read a post `${intro_text}` and wrote a response about flowers and butterflies and what I read:

*/

class Chain {
  constructor(rawtext, context, predictionFunction) {
    if (!rawtext.startsWith('// chain'))
      rawtext = "// chain\n\r1.\n\r" + rawtext;
    this.rawtext = rawtext;
    this.context = context;
    this.predictionFunction = predictionFunction;
    this.chain = rawtext.split(/\d+\./g);
    if (this.chain[0].startsWith('// chain'))
      this.chain.shift();
    this.step = 0;
    this.results = [];
    this.log = [];
  }
  async execute() {
    await this._exec();
    return true;
  }
  async _exec() {
    if (this.step == this.chain.length) {
      return;
    }
    this.log.push('--------------------------');
    var p = this.chain[this.step].trim();
    var preprocessed = FunctionEngine(p, this.context);
    var result;
    if (preprocessed.text) {
      var p = TemplateEngine(preprocessed.text, this.context).trim();
      result = String(await this.predictionFunction(p)).trim();
      this.log.push(this.step + " t -> " + p.substring(0, 512))
    }
    if (preprocessed.funcs.length != 0) {
      let func = preprocessed.funcs[0];
      if (func == 'reject' || func == 'exit') {
        this.log.push("exiting " + result)
        // throw new Error('exit', this);
        return;
      }
      if (func.startsWith('rejectif ')) {
        this.log.push(this.step + " rejectif -> " + func.substring(9).trim()+ " -> " + result)
        if (result.startsWith(func.substring(9).trim())) {
          this.log.push("exiting " + result)
          // throw new Error('exit', this);
          return;
        }
      }
      if (func.startsWith('search ')) {
        var arg = TemplateEngine(func.substring(7), this.context);
        this.log.push(this.step + " search -> " + arg.substring(0, 512))
        result = await search.googs2(arg);
        if (result.length > 2000)
          result = result.substring(result.length - 2000);
      }
    }
    this.lastResult = result;
    this.log.push(this.step + " result -> " + result);
    this.results.push(result);
    this.context['result_' + (this.step + 1)] = result;
    this.step++;
    await this._exec();
  }
}

exports.Chain = Chain;



function TemplateEngine(tpl, data = {}) {
  var re = /\$\{([^\}]+)?\}/g, match;
  while (match = re.exec(tpl)) {
    tpl = tpl.replace(match[0], data[match[1]].trim());
  }
  return tpl;
}

function FunctionEngine(tpl, data = {}) {
  var funcs = [];
  var re = /\$\$(.+)?\$\$/g, match;
  while (match = re.exec(tpl)) {
    tpl = tpl.replace(match[0], '').trim();
    funcs.push(match[1])
  }
  return { text: tpl, funcs: funcs };
}
