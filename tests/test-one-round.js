const dotenv = require('dotenv');
require('dotenv').config();
const TwitterTask = require('../twitter-task');
const Twitter = require('../adapters/twitter/twitter.js');
const { coreLogic } = require('../coreLogic');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function executeTasks() {
  let db;
  const username = process.env.TWITTER_USERNAME;
  const password = process.env.TWITTER_PASSWORD;
  const verification = process.env.TWITTER_VERIFICATION;
  let credentials = {
    username: username,
    password: password,
    verification: verification,
  };
  let data = {
    id: '1846219510002352547',
    round: 3,
    data: {
      user_name: 'Crypto.com',
      screen_name: '@cryptocom',
      user_url: 'https://x.com/cryptocom',
      user_img:
        'https://pbs.twimg.com/profile_images/1823982186430660608/mz_MOBJ6_x96.jpg',
      tweets_id: '1846219510002352547',
      tweets_content:
        'Can you pause on #BabyDoge #CROFam<br><br>Screenshot for proof',
      time_post: 1729008006,
      keyword: 'crypto',
      hash: '$2a$10$yFnnVcFV2JZUqU6oEflTyOR4WMZOCIVCLMCcybNsvT.oiDK4wxgQe',
    },
    _id: '4q5fp9E50cmAmKVb',
  };
  for (let i = 3; i < 4; i++) {
    let delay = 600000;
    let round = i;
    coreLogic.task(round);
    // await sleep(50000);

    // let adapter = new Twitter(credentials, db, 3);
    // await adapter.verify(data, i);
    // coreLogic.auditTask(round - 1);

    await sleep(delay);

    console.log('stopping searcher at round', round);
  }
}

executeTasks();
