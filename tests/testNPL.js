const nlp = require('compromise');

let text = [
  `
  Everyone WANTS to invest in fundamentals for 🚀, but we are being FORCED to invest in memes for 💰 

  So, how do we turn this degen meme energy into a sustainable flywheel 🛞 for AI 🤖?
  `,

  `You either die a hero or live long enough to get followed by 
  @MarioNawfal
   
  
  If DePIN isn't on your radars yet, it will be soon
  `,

  `Over the last month, over 100TB of data was offloaded to 
  @helium_mobile
   from users of other carriers - 6x more data than 3 months prior combined
  
  That's the power of DePIN🎈
  `,

  `There's nothing wrong with centralization, except...
  FLUX legend 
  @Jefke_ST
   at the DePIN Day event.
  `,

  `Gm! Got to have dinner with U.S. Department of Housing and Urban Development and California Department of Financial Protection and Innovation talking peaq, DePIN & RWA's.
  `
  ,
  `
  Getting back into DePIN spaces next week, set those reminders and add to calendar fam!
  `,
  `On the last episode of the DePIN Hub Podcast, we have 
  @Qualoo_Network
  , 
  @LProundtable
  , and 
  @DePIN_aaron
   in our beautiful mansion in Koh Samui 🇹🇭
  
  Our intern forgot to add the video to X as a long form, but we want to post here as it was an amazing conversation, hope you enjoy it
  `
]
let n = 0;
console.log('starting ', text.length)
for ( let n = 0; n < text.length; n++ ) {

  let result = genText(text[n]);
  console.log(n, result);

}

// @SOMA please add lines below into your code
// const nlp = require('compromise');

/*
  @genText
  Receives a blurb to read, then returns a random koii-themed blurb
  * textToRead receives a blurb of text 
  @return => templated blurb
*/
function genText (textToRead) {
  let snippetSelectors = [
      '#Preposition #Noun #Noun #Noun',
      '#Person',
      '#Adverb #Verb',
      '#Possessive #Noun',
      '#Preposition #Noun',
      '#ProperNoun',
      '#FirstName',
      '#Adjective #Noun #Noun',
      '#Adjective #Noun',
      '#Noun #Noun #Noun'
  ]
  let result = 0;
  let n = 0;
  do {
      let snippet = selectSnippet(snippetSelectors[n], textToRead)
      if (snippet.length > 1) {
          // console.log('found result', snippet, 'with selector ', snippetSelectors[n])
          if (snippet.length < 20) {
              result = snippet;
              // console.log('\r\nfound: "', result ,'" on selector ', n)
          }
      } 
      n++;
  } while (result == 0 && n < snippetSelectors.length)

  if (result == 0 ) {
      // console.log('\r\nFAILED to find text in ', textToRead)
      result = "#REDTober"
  }

  let templates = [
      `We got ${result} before we got Koii mainnet`,
      `I can't believe we got ${result} before Koii launched.`,
      `Wow, ${result} is cool, but I want Koii.`,
      `Wen ${result}, Koii launch?`
  ];
  let template_index = Math.floor(Math.random() * (templates.length));
  console.log('template', template_index)
  return templates[template_index];
}

/**
* Attempts to return a sensible snippet from the provided text
* @param {*} text 
*/
function selectSnippet (snippetSelector, textToRead) {
  let doc = nlp(textToRead);

  let snippet = doc.match(snippetSelector).text()
      snippet = nlp(snippet);
      snippet.nouns().toPlural();
      snippet.people().normalize();
      snippet.toLowerCase();
      snippet = snippet.text();
      if (snippet.length < 1) snippet = 0;
      // console.log( 'selector', snippetSelector, 'found snippet: ', snippet);
      
  return snippet;
}