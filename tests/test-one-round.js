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
    id: '1848330237488054461',
    round: 3,
    data: {
      user_name: 'Noir Blaq',
      screen_name: '@Noirblaq',
      user_url: 'https://x.com/Noirblaq',
      user_img:
        'https://pbs.twimg.com/profile_images/1829791306719096832/P1RyKwc9_x96.jpg',
      tweets_id: '1848330237488054461',
      tweets_content:
        "The DEPIN narrative took 2024 by storm.<br><br>It is expected to be a $13 Trillion category by 2030<br><br>You're likely to hear much more about it in the future.<br><br>This guide will help you understand DePin like a pro<br><br>A ",
      time_post: 1729511243,
      keyword: 'depin',
      hash: '$2a$10$1w3jhZBOrUaZqqSk2ghhGOvUKRXSAK6zka3b/iEO5lhp0bOWoA8Gi',
      commentDetails: {
        username: 'Soma41717079',
        commentId: '1848831340877385823',
        commentText:
          'Wow,  you pins is liking is dope and all, but I want Koii.',
      },
    },
    _id: 'CJGAQ2u78mCyhmds',
  };

  for (let i = 3; i < 4; i++) {
    let delay = 600000;
    let round = i;
    coreLogic.task(round);
    // await sleep(50000);

    // let adapter = new Twitter(credentials, db, 3);
    // let audit = await adapter.verify(data, i);
    // console.log('audit', audit);
    // coreLogic.auditTask(round - 1);

    await sleep(delay);

    console.log('stopping searcher at round', round);
  }
}

executeTasks();
