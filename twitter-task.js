const Twitter = require('./adapters/twitter/twitter.js');
const Data = require('./model/data');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk');
const dotenv = require('dotenv');
const { CID } = require('multiformats/cid');
const path = require('path');
const fs = require('fs');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const { default: axios } = require('axios');
const { askBoth } = require('./adapters/AI_Gen');
async function isValidCID(cid) {
  try {
    CID.parse(cid);
    return true;
  } catch (error) {
    return false;
  }
}

dotenv.config();

/**
 * TwitterTask is a class that handles the Twitter crawler and validator
 *
 * @description TwitterTask is a class that handles the Twitter crawler and validator
 *              In this task, the crawler asynchronously populates a database, which is later
 *              read by the validator. The validator then uses the database to prepare a submission CID
 *              for the current round, and submits that for rewards.
 *
 *              Four main functions control this process:
 *              @crawl crawls Twitter and populates the database
 *              @validate verifies the submissions of other nodes
 *              @getRoundCID returns the submission for a given round
 *              @stop stops the crawler
 *
 * @param {function} getRound - a function that returns the current round
 * @param {number} round - the current round
 * @param {string} searchTerm - the search term to use for the crawler
 * @param {string} adapter - the adapter to use for the crawler
 * @param {string} db - the database to use for the crawler
 *
 * @returns {TwitterTask} - a TwitterTask object
 *
 */

class TwitterTask {
  constructor(round) {
    this.round = round;
    this.lastRoundCheck = Date.now();
    this.isRunning = false;
    this.searchTerm = [];
    this.adapter = null;
    this.comment = '';
    this.username = '';
    this.db = new Data('db', []);
    this.db.initializeData();
    this.initialize();

    this.setAdapter = async () => {
      const username = process.env.TWITTER_USERNAME;
      const password = process.env.TWITTER_PASSWORD;
      const verification = process.env.TWITTER_VERIFICATION;

      if (!username || !password) {
        throw new Error(
          'Environment variables TWITTER_USERNAME and/or TWITTER_PASSWORD are not set',
        );
      }

      let credentials = {
        username: username,
        password: password,
        verification: verification,
      };

      this.username = username;
      this.adapter = new Twitter(credentials, this.db, 3);
      await this.adapter.negotiateSession();
    };

    this.start();
  }

  async initialize() {
    try {
      console.log('initializing twitter task');
      const { comment, search } = await this.fetchSearchTerms();
      this.comment = comment;
      this.searchTerm = search;

      //Store this round searchTerm
      // console.log(
      //   'creating crawler for user:',
      //   this.searchTerm,
      //   this.round,
      //   this.comment,
      // );
      this.db.createSearchTerm(this.searchTerm, this.round, this.comment);
    } catch (error) {
      throw new Error('Environment variables TWITTER_PROFILE is not set');
    }
  }

  /**
   * fetchSearchTerms
   * @description return the search terms to use for the crawler
   * @returns {array} - an array of search terms
   */
  async fetchSearchTerms() {
    let keyword;
    let search;
    try {
      const response = await axios.get('http://localhost:3000/keywords', {
        params: {
          key,
        },
      });
      console.log('Keywords from middle server', response.data);
      keyword = response.data;
    } catch (error) {
      console.log('Error fetching keywords:, use random keyword');
      // pick random search term
      let searchList = ['crypto', 'depin'];
      search = searchList[Math.floor(Math.random() * searchList.length)];
    }

    return { comment: keyword, search: search };
  }

  /**
   * strat
   * @description starts the crawler
   *
   * @returns {void}
   *
   */
  async start() {
    await this.setAdapter();

    this.isRunning = true;

    // random emojis
    const emojis = ['🛋️', '🛋️', '🛋️'];
    for (let i = emojis.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [emojis[i], emojis[j]] = [emojis[j], emojis[i]];
    }
    const numEmojis = Math.floor(Math.random() * 3) + 1;
    const getRandomEmojis = emojis.slice(0, numEmojis).join('');

    // random selected hashtags
    const hashtags = ['#releaseDrats', '#couchLover'];
    for (let i = hashtags.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [hashtags[i], hashtags[j]] = [hashtags[j], hashtags[i]];
    }
    const numHashtags = Math.floor(Math.random() * hashtags.length) + 1;
    const selectedHashtags = hashtags.slice(0, numHashtags).join(' ');

    let query = {
      limit: 100,
      searchTerm: this.searchTerm,
      query: `https://x.com/search?q=${this.searchTerm}&src=typed_query&f=live`,
      comment: `${this.comment} ${getRandomEmojis}  ${selectedHashtags}`,
      depth: 3,
      round: this.round,
      recursive: true,
      username: this.username,
    };

    this.adapter.search(query); // let it ride
  }

  /**
   * stop
   * @description stops the crawler
   *
   * @returns {void}
   */
  async stop() {
    this.isRunning = false;
    this.adapter.stop();
  }

  /**
   * getRoundCID
   * @param {*} roundID
   * @returns
   */
  async getRoundCID(roundID) {
    console.log('starting submission prep for ');
    let result = await this.adapter.getSubmissionCID(roundID);
    console.log('returning round CID', result, 'for round', roundID);
    return result;
  }

  /**
   * getJSONofCID
   * @description gets the JSON of a CID
   * @param {*} cid
   * @returns
   */
  async getJSONofCID(cid) {
    return await getJSONFromCID(cid, 'dataList.json');
  }

  /**
   * validate
   * @description validates a round of results from another node against the Twitter API
   * @param {*} proofCid
   * @returns
   */
  async validate(proofCid, round) {
    // in order to validate, we need to take the proofCid
    // and go get the results from IPFS
    try {
      await new Promise(resolve => setTimeout(resolve, 30000)); // 30-second delay
      let data = await getJSONFromCID(proofCid, 'dataList.json');
      let idSet = new Set();
      let duplicatedIDNumber = 0;
      for (let item of data) {
        if (idSet.has(item.id)) {
          console.log('Duplicate Item ID found: ', item.id);
          duplicatedIDNumber += 1;
        }
        idSet.add(item.id);
      }
      if (duplicatedIDNumber > 10) {
        console.log(
          `Detected Potential Risk ; Duplicated ID is ${duplicatedIDNumber}`,
        );
      } else {
        console.log(
          `Duplicated ID Check Passed ; Duplicated ID numebr is ${duplicatedIDNumber}`,
        );
      }

      let proofThreshold = 1;
      let passedNumber = 0;

      // Check if task in cooldown period
      const currentTime = new Date().getTime(); // in milliseconds
      // console.log('Current time:', currentTime);

      // Fetch the current runtime data from the database
      let runtimeData = await namespaceWrapper.storeGet('twitterTask');
      console.log('runtimeData:', runtimeData);
      // If no data exists in the database for the task, initialize it
      if (!runtimeData) {
        runtimeData = {
          targetStopTime: 0,
          targetRunTime: currentTime,
        };
        await namespaceWrapper.storeSet('twitterTask', runtimeData);
      }

      // Set the minimum and maximum allowed runtime per day (in milliseconds)
      const MIN_RUNTIME_PER_DAY = 2 * 60 * 60 * 1000; // 2 hours in milliseconds
      const MAX_RUNTIME_PER_DAY = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
      // Generate a random runtime between the minimum and maximum allowed time
      const randomRuntime =
        Math.floor(
          Math.random() * (MAX_RUNTIME_PER_DAY - MIN_RUNTIME_PER_DAY + 1),
        ) + MIN_RUNTIME_PER_DAY;

      // Set the minimum and maximum allowed cooldown time between task runs (in milliseconds)
      const MIN_COOLDOWN_TIME = 4 * 60 * 60 * 1000; // 4 hours in milliseconds
      const MAX_COOLDOWN_TIME = 12 * 60 * 60 * 1000; // 12 hours in milliseconds
      // Generate a random cooldown time between the minimum and maximum allowed time
      const randomCooldownTime =
        Math.floor(
          Math.random() * (MAX_COOLDOWN_TIME - MIN_COOLDOWN_TIME + 1),
        ) + MIN_COOLDOWN_TIME;

      // Get the last run time and total runtime from the database
      let { targetStopTime, targetRunTime } = runtimeData;

      if (
        targetRunTime <= currentTime &&
        (targetStopTime > currentTime ||
          targetStopTime === 0 ||
          currentTime > targetStopTime + 6 * 60 * 60 * 1000) // 6 hours after the target stop time
      ) {
        // If the task has not been run before, set the target stop time and run time
        if (
          targetStopTime === 0 ||
          currentTime > targetStopTime + 6 * 60 * 60 * 1000
        ) {
          let targetStopTime = currentTime + randomRuntime;
          let targetRunTime = 0;
          let runtimeData = {
            targetStopTime,
            targetRunTime,
          };
          await namespaceWrapper.storeSet('twitterTask', runtimeData);
        }

        if (data && data !== null && data.length > 0) {
          for (let i = 0; i < proofThreshold; i++) {
            console.log(`Checking the ${i} th tweet.`);
            let randomIndex = Math.floor(Math.random() * data.length);
            let item = data[randomIndex];

            if (item.id) {
              const result = await this.adapter.verify(item.data, round);
              console.log('Result from verify', result);
              if (result) {
                passedNumber += 1;
              }
            } else {
              console.log('Invalid Item ID: ', item.id);
              continue;
            }
          }
          if (passedNumber === 1) {
            console.log(passedNumber, 'is passedNumber');
            return true;
          } else {
            console.log(passedNumber, 'is passedNumber');
            return false;
          }
        } else {
          console.log('no data from proof CID');
        }
        // if none of the random checks fail, return true
        return true;
      } else {
        // Do not run the task
        if (targetRunTime === 0) {
          let targetRunTime = currentTime + randomCooldownTime;
          let targetStopTime = 0;
          let runtimeData = {
            targetStopTime,
            targetRunTime,
          };
          await namespaceWrapper.storeSet('twitterTask', runtimeData);
        }
        console.log('reach the maximum runtime for the day');
        return;
      }
    } catch (e) {
      console.log('error in validate', e);
      return true;
    }
  }
}

module.exports = TwitterTask;

/**
 * getJSONFromCID
 * @description gets the JSON from a CID
 * @param {*} cid
 * @returns promise<JSON>
 */
const getJSONFromCID = async (cid, fileName, retries = 3) => {
  const validateCID = await isValidCID(cid);
  if (!validateCID) {
    console.log(`Invalid CID: ${cid}`);
    return null;
  }

  const client = new KoiiStorageClient(undefined, undefined, false);

  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const blob = await client.getFile(cid, fileName);
      const text = await blob.text(); // Convert Blob to text
      const data = JSON.parse(text); // Parse text to JSON
      return data;
    } catch (error) {
      console.log(
        `Attempt ${attempt}: Error fetching file from Koii IPFS: ${error.message}`,
      );
      if (attempt === retries) {
        throw new Error(`Failed to fetch file after ${retries} attempts`);
      }
      // Optionally, you can add a delay between retries
      await new Promise(resolve => setTimeout(resolve, 3000)); // 3-second delay
    }
  }

  return null;
};
