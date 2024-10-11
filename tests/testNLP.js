const winkNLP = require('wink-nlp');
const model = require('wink-eng-lite-web-model');
const nlp = winkNLP(model);

function extractProperNouns(article) {
  const patterns = [
    { name: 'nounPhrase', patterns: ['[|DET] [|ADJ] [NOUN|PROPN]'] },
  ];
  nlp.learnCustomEntities(patterns);
  const doc = nlp.readDoc(article);

  const properNouns = doc.customEntities().out();

  return properNouns;
}

function createSentence(article) {
  const properNouns = extractProperNouns(article);
  if (properNouns.length === 0) {
    return 'No proper nouns found.';
  }

  const sentences = properNouns.map(
    noun => `Wow, I can’t believe we got ${noun} before Koii mainnet.`,
  );
  return sentences;
}

const articleText =
  'Our border czar Kamala Harris opened up the border by design. Now real people are suffering.';

console.log(createSentence(articleText));

// // Load wink-nlp package.
// const winkNLP = require('wink-nlp');
// // Load english language model — light version.
// const model = require('wink-eng-lite-web-model');
// // Instantiate winkNLP.
// const nlp = winkNLP(model);
// // Obtain "its" helper to extract item properties.
// const its = nlp.its;
// // Obtain "as" reducer helper to reduce a collection.
// const as = nlp.as;

// async function main() {
//   const text = "Over the last month, over 100TB of data was offloaded to @helium_mobilefrom users of other carriers - 6x more data than 3 months prior combined. That's the power of DePIN🎈";

//   // Read the text into wink-nlp.
//   const doc = nlp.readDoc(text);

//   // Print all tokens to see how DePIN is classified
//   const allTokens = doc.tokens().out(its.detail);
//   console.log('All Tokens:', allTokens);

//   // Get tokens and filter for nouns, including manually flagging "DePIN"
//   const nounTokens = doc.tokens()
//     .filter(token => token.out(its.pos) === 'NOUN' || token.out(its.text) === 'DePIN')
//     .out(its.text);

//   // Output the filtered nouns including DePIN
//   console.log('Nouns:', nounTokens);
// }

// main();
