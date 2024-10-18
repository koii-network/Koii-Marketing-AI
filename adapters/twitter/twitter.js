// Import required modules
const Adapter = require('../../model/adapter');
const cheerio = require('cheerio');
const { KoiiStorageClient } = require('@_koii/storage-task-sdk');
const Data = require('../../model/data');
const PCR = require('puppeteer-chromium-resolver');
const { namespaceWrapper } = require('@_koii/namespace-wrapper');
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const nlp = require('compromise');

/**
 * Twitter
 * @class
 * @extends Adapter
 * @description
 * Provides a searcher interface for the data gatherer nodes to use to interact with twitter
 */

class Twitter extends Adapter {
  constructor(credentials, db, maxRetry) {
    super(credentials, maxRetry);
    this.credentials = credentials;
    this.db = new Data('db', []);
    this.db.initializeData();
    this.proofs = new Data('proofs', []);
    this.proofs.initializeData();
    this.cids = new Data('cids', []);
    this.cids.initializeData();
    this.commentsDB = new Data('comment', []);
    this.commentsDB.initializeData();
    this.searchTerm = [];
    this.lastSessionCheck = null;
    this.sessionValid = false;
    this.browser = null;
    this.round = null;
    this.maxRetry = maxRetry;
    this.comment = '';
    this.meme = '';
    this.username = '';
  }

  /**
   * checkSession
   * @returns {Promise<boolean>}
   * @description
   * 1. Check if the session is still valid
   * 2. If the session is still valid, return true
   * 3. If the session is not valid, check if the last session check was more than 1 minute ago
   * 4. If the last session check was more than 1 minute ago, negotiate a new session
   */
  checkSession = async () => {
    if (this.sessionValid) {
      return true;
    } else if (Date.now() - this.lastSessionCheck > 50000) {
      await this.negotiateSession();
      return true;
    } else {
      return false;
    }
  };

  /**
   * negotiateSession
   * @returns {Promise<void>}
   * @description
   * 1. Get the path to the Chromium executable
   * 2. Launch a new browser instance
   * 3. Open a new page
   * 4. Set the viewport size
   * 5. Queue twitterLogin()
   */
  negotiateSession = async () => {
    try {
      if (this.browser) {
        await this.browser.close();
        console.log('Old browser closed');
      }
      const options = {};
      const userDataDir = path.join(
        __dirname,
        'puppeteer_cache_AIC_twitter_archive',
      );
      const stats = await PCR(options);
      console.log(
        '*****************************************CALLED PURCHROMIUM RESOLVER*****************************************',
      );
      this.browser = await stats.puppeteer.launch({
        executablePath: stats.executablePath,
        userDataDir: userDataDir,
        headless: false,
        userAgent:
          'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
        args: [
          '--aggressive-cache-discard',
          '--disable-cache',
          '--disable-application-cache',
          '--disable-offline-load-stale-cache',
          '--disable-gpu-shader-disk-cache',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
          '--disable-dev-shm-usage',
        ],
      });
      console.log('Step: Open new page');
      this.page = await this.browser.newPage();
      // Emulate a specific mobile device, e.g., iPhone X
      const iPhone = stats.puppeteer.devices['iPhone X'];
      await this.page.emulate(iPhone);

      // Set a mobile viewport size
      await this.page.setViewport({
        width: 397,
        height: 812,
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
      });

      // Set a mobile user agent
      await this.page.setUserAgent(
        'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0 Mobile/15E148 Safari/604.1',
      );
      console.log('Setup as mobile device complete');
      // await this.page.setViewport({ width: 1920, height: 1080 });
      await this.page.waitForTimeout(await this.randomDelay(3000));
      await this.twitterLogin(this.page, this.browser);
      return true;
    } catch (e) {
      console.log('Error negotiating session', e);
      return false;
    }
  };

  /**
   * twitterLogin
   * @returns {Promise<void>}
   * @description
   * 1. Go to x.com
   * 2. Go to login page
   * 3. Fill in username
   * 4. Fill in password
   * 5. Click login
   * 6. Wait for login to complete
   * 7. Check if login was successful
   * 8. If login was successful, return true
   * 9. If login was unsuccessful, return false
   * 10. If login was unsuccessful, try again
   */
  twitterLogin = async (currentPage, currentBrowser) => {
    let currentAttempt = 0;
    const cookieLoginSuccess = await this.tryLoginWithCookies(currentPage);
    if (cookieLoginSuccess) {
      this.sessionValid = true;
      return this.sessionValid;
    }
    while (currentAttempt < this.maxRetry && !this.sessionValid) {
      try {
        console.log(currentAttempt, this.maxRetry);
        console.log('Step: Go to login page');
        await currentPage.goto('https://x.com/i/flow/login', {
          timeout: await this.randomDelay(60000),
          waitUntil: 'networkidle0',
        });
        let basePath = '';
        basePath = await namespaceWrapper.getBasePath();
        console.log('Waiting for login page to load');

        // Retrieve the outer HTML of the body element
        const bodyHTML = await currentPage.evaluate(
          () => document.body.outerHTML,
        );

        // Write the HTML to a file
        fs.writeFileSync(`${basePath}/bodyHTML.html`, bodyHTML);

        await currentPage.waitForSelector('input', {
          timeout: await this.randomDelay(60000),
        });
        // Select the div element by its aria-labelledby attribute
        const usernameHTML = await currentPage.$eval(
          'input',
          el => el.outerHTML,
        );

        // Use fs module to write the HTML to a file
        fs.writeFileSync(`${basePath}/usernameHTML.html`, usernameHTML);

        await currentPage.waitForSelector('input[name="text"]', {
          timeout: await this.randomDelay(60000),
        });

        console.log('Step: Fill in username');
        console.log(this.credentials.username);

        await this.humanType(
          currentPage,
          'input[name="text"]',
          this.credentials.username,
        );

        await currentPage.keyboard.press('Enter');
        await currentPage.waitForTimeout(await this.randomDelay(5000));

        const twitter_verify = await currentPage
          .waitForSelector('input[data-testid="ocfEnterTextTextInput"]', {
            timeout: await this.randomDelay(5000),
            visible: true,
          })
          .then(() => true)
          .catch(() => false);

        if (twitter_verify) {
          console.log('Twitter verify needed, trying verification');
          console.log('Step: Fill in verification');

          await this.humanType(
            currentPage,
            'input[data-testid="ocfEnterTextTextInput"]',
            this.credentials.verification,
          );
          await currentPage.keyboard.press('Enter');

          // add delay
          await new Promise(resolve => setTimeout(resolve, 3000));
        }

        // Select the div element by its aria-labelledby attribute
        const passwordHTML = await currentPage.$$eval('input', elements =>
          elements.map(el => el.outerHTML).join('\n'),
        );

        // Use fs module to write the HTML to a file
        fs.writeFileSync(`${basePath}/passwordHTML.html`, passwordHTML);

        await currentPage.waitForSelector('input[name="password"]');
        console.log('Step: Fill in password');
        await this.humanType(
          currentPage,
          'input[name="password"]',
          this.credentials.password,
        );

        console.log('Step: Click login button');
        await currentPage.keyboard.press('Enter');
        await currentPage.waitForTimeout(await this.randomDelay(5000));
        if (!(await this.checkLogin(currentBrowser))) {
          console.log('Password is incorrect or email verification needed.');
          await currentPage.waitForTimeout(await this.randomDelay(5000));
          this.sessionValid = false;
          process.exit(1);
        } else if (await this.isEmailVerificationRequired(currentPage)) {
          console.log('Email verification required.');
          this.sessionValid = false;
          await currentPage.waitForTimeout(await this.randomDelay(10000));
          process.exit(1);
        } else {
          console.log('Password is correct.');
          currentPage.waitForNavigation({ waitUntil: 'load' });
          await currentPage.waitForTimeout(await this.randomDelay(10000));

          this.sessionValid = true;
          this.lastSessionCheck = Date.now();

          console.log('Step: Login successful');

          // Extract cookies
          const cookies = await currentPage.cookies();
          // console.log('cookies', cookies);
          // Save cookies to database
          await this.saveCookiesToDB(cookies);
        }
        return this.sessionValid;
      } catch (e) {
        console.log(
          `Error logging in, retrying ${currentAttempt + 1} of ${
            this.maxRetry
          }`,
          e,
        );
        currentAttempt++;

        if (currentAttempt === this.maxRetry) {
          console.log('Max retry reached, exiting');
          process.exit(1);
        }
      }
    }
  };

  tryLoginWithCookies = async currentPage => {
    const cookies = await this.db.getItem({ id: 'cookies' });
    // console.log('cookies', cookies);
    if (cookies !== null) {
      // set the cookies
      await currentPage.setCookie(...cookies[0].data);
      await currentPage.goto('https://x.com/home');
      await currentPage.waitForTimeout(await this.randomDelay(3000));

      const isLoggedIn =
        (await currentPage.url()) !==
          'https://x.com/i/flow/login?redirect_after_login=%2Fhome' &&
        !(await currentPage.url()).includes('https://x.com/?logout=');

      if (isLoggedIn) {
        console.log('Logged in using existing cookies');
        console.log('Updating last session check');
        const cookies = await currentPage.cookies();
        this.saveCookiesToDB(cookies);
        this.sessionValid = true;
        // Optionally, refresh or validate cookies here
      } else {
        console.log('No valid cookies found, proceeding with manual login');
        this.sessionValid = false;
      }
      return this.sessionValid;
    } else {
      console.log('No cookies found');
      return false;
    }
  };

  checkLogin = async currentBrowser => {
    const newPage = await currentBrowser.newPage();
    await newPage.waitForTimeout(await this.randomDelay(2000));
    await newPage.goto('https://x.com/home');
    await newPage.waitForTimeout(await this.randomDelay(4000));
    // Replace the selector with a Twitter-specific element that indicates a logged-in state
    const isLoggedIn =
      (await newPage.url()) !==
        'https://x.com/i/flow/login?redirect_after_login=%2Fhome' &&
      !(await newPage.url()).includes('https://x.com/?logout=');
    if (isLoggedIn) {
      // console.log('Logged in using existing cookies');
      console.log('Updating last session check');
      this.sessionValid = true;
    } else {
      console.log('No valid cookies found, proceeding with manual login');
      this.sessionValid = false;
    }
    await newPage.waitForTimeout(await this.randomDelay(2000));
    await newPage.close();
    return this.sessionValid;
  };

  isEmailVerificationRequired = async currentPage => {
    // Wait for some time to allow the page to load the required elements
    await currentPage.waitForTimeout(await this.randomDelay(5000));

    // Check if the specific text is present on the page
    const textContent = await currentPage.evaluate(
      () => document.body.textContent,
    );
    return textContent.includes(
      'Verify your identity by entering the email address associated with your X account.',
    );
  };

  // create new page
  createNewPage = async () => {
    let currentAttempt = 0;
    while (currentAttempt < 3) {
      try {
        const newPage = await this.browser.newPage();
        return newPage;
      } catch (e) {
        console.log('Error creating new page', e);
        currentAttempt++;
      }
    }
    return null;
  };

  // save to db
  saveCookiesToDB = async cookies => {
    try {
      const data = await this.db.getItem({ id: 'cookies' });
      if (data && data.data) {
        await this.db.updateCookie({ id: 'cookies', data: cookies });
      } else {
        await this.db.create({ id: 'cookies', data: cookies });
      }
    } catch (e) {
      console.log('Error saving cookies to database', e);
    }
  };

  /**
   * getSubmissionCID
   * @param {string} round - the round to get the submission cid for
   * @returns {string} - the cid of the submission
   * @description - this function should return the cid of the submission for the given round
   * if the submission has not been uploaded yet, it should upload it and return the cid
   */
  getSubmissionCID = async round => {
    if (this.proofs) {
      // we need to upload proofs for that round and then store the cid
      const data = await this.cids.getList({ round: round });
      console.log(`got cids list for round ${round}`);

      if (data && data.length === 0) {
        console.log('No cids found for round ' + round);
        return null;
      } else {
        let proof_cid;
        let path = `dataList.json`;
        let basePath = '';
        try {
          basePath = await namespaceWrapper.getBasePath();
          fs.writeFileSync(`${basePath}/${path}`, JSON.stringify(data));
        } catch (err) {
          console.log(err);
        }
        try {
          const client = new KoiiStorageClient(undefined, undefined, false);
          const userStaking = await namespaceWrapper.getSubmitterAccount();
          console.log(`Uploading ${basePath}/${path}`);
          const fileUploadResponse = await client.uploadFile(
            `${basePath}/${path}`,
            userStaking,
          );
          console.log(`Uploaded ${basePath}/${path}`);
          const cid = fileUploadResponse.cid;
          proof_cid = cid;
          await this.proofs.create({
            id: 'proof:' + round,
            proof_round: round,
            proof_cid: proof_cid,
          });

          console.log('returning proof cid for submission', proof_cid);
          return proof_cid;
        } catch (error) {
          if (error.message === 'Invalid Task ID') {
            console.error('Error: Invalid Task ID');
          } else {
            console.error('An unexpected error occurred:', error);
          }
        }
      }
    } else {
      throw new Error('No proofs database provided');
    }
  };

  humanType = async (page, selector, genText) => {
    // let textList = [
    //     `We got ${genText} before we got Koii mainnet`,
    //     `I can't believe we got ${genText} before Koii launched.`,
    //     `Wow, ${genText} is dope and all, but I want Koii.`,
    //     `Wen ${genText}, Koii launch?`
    // ]
    // const randomIndex = Math.floor(Math.random() * textList.length);

    // Get the random element from the array
    // text = textList[randomIndex];
    await page.click(selector); // Focus on the input field
    for (let i = 0; i < genText.length; i++) {
      const char = genText[i];

      // await page.type(selector, char);
      if (char === char.toUpperCase() && char.match(/[a-zA-Z]/)) {
        await page.keyboard.down('Shift'); // Hold down Shift for capital letters
        await page.keyboard.press(char); // Press the capital letter
        await page.keyboard.up('Shift'); // Release Shift
      } else {
        // Directly press other characters (lowercase, numbers, symbols)
        if (char === ' ') {
          await page.keyboard.press('Space'); // Handle spaces explicitly
        } else {
          await page.keyboard.press(char);
        }
      }

      // Randomly vary typing speed to mimic human behavior
      const typingSpeed = Math.random() * 250 + 50;
      await page.waitForTimeout(typingSpeed);

      // Randomly add "thinking pauses" after some words
      if (char === ' ' && Math.random() < 0.2) {
        const thinkingPause = Math.random() * 1500 + 500;
        await page.waitForTimeout(thinkingPause);
      }

      // Randomly simulate small typing errors and corrections
      if (Math.random() < 0.08) {
        // 8% chance of error
        const errorChar = String.fromCharCode(
          Math.floor(Math.random() * 26) + 97,
        ); // Random lowercase letter
        await page.type(selector, errorChar); // Type incorrect character
        await page.waitForTimeout(typingSpeed / 0.8); // Short delay after mistake
        await page.keyboard.press('Backspace'); // Correct the mistake
      }

      // Randomly add a longer pause to mimic thinking (more rarely)
      if (Math.random() < 0.1) {
        const longPause = Math.random() * 2000 + 500;
        await page.waitForTimeout(longPause);
      }
    }

    // Extra delay after finishing typing to simulate human thinking or reviewing
    const finishDelay = Math.random() * 2000 + 1000;
    console.log(
      `Finished typing. Waiting for additional mouse delay of ${finishDelay} ms`,
    );

    // Simulate random mouse movement during the pause
    await this.randomMouseMovement(page, finishDelay);
  };

  // Function to simulate random mouse movement during thinking pauses
  randomMouseMovement = async (page, pauseDuration) => {
    const startX = Math.random() * 500 + 100; // Start somewhere within a random range
    const startY = Math.random() * 300 + 100;

    // Move the mouse to the initial position
    await page.mouse.move(startX, startY);

    const moveSteps = Math.floor(Math.random() * 5 + 3); // Simulate 3 to 5 movements
    const stepDelay = pauseDuration / moveSteps; // Divide the pause duration for smooth movement

    for (let i = 0; i < moveSteps; i++) {
      const randomX = startX + Math.random() * 100 - 50; // Move randomly within a small range
      const randomY = startY + Math.random() * 100 - 50;
      await page.mouse.move(randomX, randomY);
      await page.waitForTimeout(stepDelay); // Wait a bit before the next movement
    }
  };

  // clean text
  cleanText = async text => {
    return text.replace(/\s+/g, '').trim();
  };

  moveMouseSmoothly = async (page, targetX, targetY) => {
    const minSteps = 5;
    const maxSteps = 20;
    const steps =
      Math.floor(Math.random() * (maxSteps - minSteps + 1)) + minSteps;

    for (let i = 0; i <= steps; i++) {
      await page.mouse.move(
        targetX - (targetX / steps) * (steps - i),
        targetY - (targetY / steps) * (steps - i),
      );
      await page.waitForTimeout(await this.randomDelay(1000));
    }
  };

  clickArticle = async (currentPage, tweets_content, tweetId) => {
    console.log('Target article: ' + tweets_content + ' ' + tweetId);
    await currentPage.waitForTimeout(await this.randomDelay(2000));

    // Find the correct article container for the given tweetId or tweets_content
    const articleContainer = await this.getArticleContainer(
      currentPage,
      tweetId,
      tweets_content,
    );

    if (!articleContainer) {
      console.log('Article container not found.');
      return;
    }

    let textContentContainer = await articleContainer.$(
      'div[data-testid="tweetText"]',
    ); // Target the text content specifically

    if (!textContentContainer) {
      console.log('Text content container not found in the article.');
      return;
    }

    let textBox = await textContentContainer.boundingBox();

    // Function to check if the article is within the visible viewport
    const isVisible = async box => {
      const viewport = await currentPage.viewport();
      return box && box.y >= 0 && box.y + box.height <= viewport.height;
    };

    // Scroll until the text content is within the viewport
    while (!(await isVisible(textBox))) {
      const viewport = await currentPage.viewport();
      const scrollAmount = Math.max(0, textBox.y - viewport.height / 2);

      const startY = 500; // starting position for swipe (bottom)
      const endY = startY - scrollAmount; // how much to scroll up by

      if (scrollAmount <= 0) break;

      await this.slowFingerSlide(currentPage, 150, startY, 150, endY, 60, 10);
      await currentPage.waitForTimeout(await this.randomDelay(2000));

      textBox = await textContentContainer.boundingBox(); // Re-evaluate the text container's position after scrolling
    }

    // Once the text content is in view, simulate a click
    if (textBox) {
      await currentPage.mouse.click(
        textBox.x + textBox.width / 2 + this.getRandomOffset(20),
        textBox.y + textBox.height / 2 + this.getRandomOffset(2),
      );

      await currentPage.waitForTimeout(await this.randomDelay(2000));

      // Check if clicking opened a photo by mistake (URL changes to include `/photo/`)
      const currentUrl = currentPage.url();
      if (currentUrl.includes('/photo/')) {
        console.log('Photo was clicked by mistake. Closing the photo.');

        // Close the photo (usually by clicking a "close" button or pressing ESC)
        const closeButtonSelector = 'div[role="button"][aria-label="Close"]'; // Example selector for a close button
        const closeButton = await currentPage.$(closeButtonSelector);

        if (closeButton) {
          await closeButton.click();
          console.log('Photo closed successfully.');

          // Retry clicking the text content container
          console.log('Retrying to click the text content of the article.');
          await currentPage.mouse.click(
            textBox.x + textBox.width / 2 + this.getRandomOffset(20),
            textBox.y + textBox.height / 2 + this.getRandomOffset(2),
          );
          console.log(
            'Text content clicked successfully after closing the photo.',
          );
        } else {
          console.log(
            'Could not find close button for the photo. Trying to close with ESC key.',
          );
          await currentPage.keyboard.press('Escape'); // Fallback: Press the ESC key to close the photo modal
        }
      } else {
        console.log(
          'Article text content clicked successfully, continuing to comment and like.',
        );
      }
    } else {
      console.log('Text content bounding box not available.');
    }
  };

  clickLikeButton = async (currentPage, commentContainer) => {
    try {
      const buttonSelector = 'button[data-testid="like"]'; // Find the like button within the specific comment container
      const likeButton = await commentContainer.$(buttonSelector); // Use container.$ to scope the search inside the comment

      if (!likeButton) {
        console.log('Post already liked.');
        return;
      }

      let buttonBox = await likeButton.boundingBox();

      // Function to check if the button is visible within the viewport
      const isButtonVisible = async box => {
        const viewport = await currentPage.viewport();
        return box && box.y >= 0 && box.y + box.height <= viewport.height;
      };

      // Scroll until the like button is within the viewport
      while (!(await isButtonVisible(buttonBox))) {
        const viewport = await currentPage.viewport();
        const scrollAmount = Math.max(0, buttonBox.y - viewport.height / 2);

        const startY = 500;
        const endY = startY - scrollAmount;

        if (scrollAmount <= 0) break;

        await this.slowFingerSlide(currentPage, 150, startY, 150, endY, 50, 20);
        await currentPage.waitForTimeout(await this.randomDelay(2000));

        buttonBox = await likeButton.boundingBox(); // Recalculate bounding box after scroll
      }

      // Check if the like button is now visible and clickable
      const isLikeButtonVisible =
        buttonBox && (await isButtonVisible(buttonBox));

      if (isLikeButtonVisible) {
        // Now check if the "unlike" button is present but scope it to the comment container
        const unlikeButtonSelector = 'button[data-testid="unlike"]';
        const isUnlike = await commentContainer.$(unlikeButtonSelector);

        if (isUnlike) {
          console.log(
            'Post is already liked (unlike button present). No action taken.',
          );
        } else {
          // Click the like button
          await currentPage.waitForTimeout(await this.randomDelay(1000));
          await currentPage.mouse.click(
            buttonBox.x + buttonBox.width / 2 + this.getRandomOffset(5),
            buttonBox.y + buttonBox.height / 2 + this.getRandomOffset(5),
          );
          console.log('Like button clicked successfully.');
          await currentPage.waitForTimeout(await this.randomDelay(2000));
        }
      } else {
        console.error('Like button is not visible or clickable.');
      }
    } catch (e) {
      console.error('Error clicking the like button:', e);
    }
  };

  clickCommentButton = async (currentPage, tweets_content) => {
    // write a comment and post
    console.log('Start genText *******************');
    let genText = await this.genText(tweets_content);
    console.log('genText', genText);
    console.log('End genText *******************');

    const replybuttonSelector = 'button[data-testid="reply"]'; // Selector for the reply button
    await currentPage.waitForSelector(replybuttonSelector, {
      timeout: 10000,
    });
    await currentPage.waitForTimeout(await this.randomDelay(2000));

    // Find the first reply button
    const replyButton = await currentPage.$(replybuttonSelector); // Gets the first instance of the reply button

    if (replyButton) {
      const replybuttonBox = await replyButton.boundingBox();

      if (replybuttonBox) {
        // Click around the button with random offsets
        await currentPage.mouse.click(
          replybuttonBox.x + replybuttonBox.width / 2 + this.getRandomOffset(5),
          replybuttonBox.y +
            replybuttonBox.height / 2 +
            this.getRandomOffset(5),
        );
      } else {
        console.log('Button is not visible.');
      }
    } else {
      console.log('Reply button not found.');
    }

    await currentPage.waitForTimeout(await this.randomDelay(3000));
    console.log('change to post page:' + currentPage.url());
    const writeSelector = 'textarea[data-testid="tweetTextarea_0"]'; // Updated selector for the text area
    await currentPage.waitForTimeout(await this.randomDelay(1000));
    await currentPage.click(writeSelector);
    await currentPage.waitForTimeout(await this.randomDelay(2000));
    await this.humanType(currentPage, writeSelector, genText);
    await currentPage.waitForTimeout(await this.randomDelay(1000));
    // Wait for the reply button to appear and be ready for interaction
    const tweetButtonSelector = 'button[data-testid="tweetButton"]';
    await currentPage.waitForSelector(tweetButtonSelector, { visible: true });

    const tweetButton = await currentPage.$(tweetButtonSelector);

    if (tweetButton) {
      const buttonBox = await tweetButton.boundingBox();

      if (buttonBox) {
        // Function to add a random offset to simulate human-like clicking
        const getRandomOffset = range => {
          return Math.floor(Math.random() * (range * 2 + 1)) - range;
        };

        // Simulate a click on the button using mouse.click with random offsets
        await currentPage.mouse.click(
          buttonBox.x + buttonBox.width / 2 + getRandomOffset(5),
          buttonBox.y + buttonBox.height / 2 + getRandomOffset(5),
        );

        console.log('Reply button clicked successfully!');
      } else {
        console.log('Button bounding box not available.');
      }
    } else {
      console.log('Reply button not found.');
    }

    await currentPage.waitForTimeout(await this.randomDelay(3000));
  };

  // Helper function to get the comment container
  getCommentContainer = async (currentPage, commentText) => {
    const containers = await currentPage.$$('article[aria-labelledby]');

    for (const container of containers) {
      const textContent = await container.$eval(
        'div[data-testid="tweetText"]',
        el => el.innerText,
      );
      if (textContent.toLowerCase().includes(commentText.toLowerCase())) {
        return container; // Return the correct comment container
      }
    }

    return null; // No matching comment container found
  };

  getArticleContainer = async (currentPage, tweetId, tweets_content) => {
    // Fetch all article containers
    const articles = await currentPage.$$('article[data-testid="tweet"]');

    for (const article of articles) {
      // Check if this article matches the tweetId or tweet content
      const tweetUrl = await article.$eval(
        'a[href*="/status/"]',
        el => el.href,
      );
      const extractedTweetId = tweetUrl.split('/').pop();

      // You can also check the tweet content if needed
      const tweetText = await article.$eval(
        'div[data-testid="tweetText"]',
        el => el.innerText,
      );

      if (extractedTweetId === tweetId || tweetText.includes(tweets_content)) {
        return article; // Return the article container that matches the tweetId or content
      }
    }

    return null; // Return null if no matching article is found
  };

  clickBackButton = async currentPage => {
    await this.slowFingerSlide(this.page, 120, 200, 200, 400, 1, 25); // Slide up to make sure back button is visible
    await currentPage.waitForTimeout(await this.randomDelay(2000));
    const backButtonSelector = 'button[data-testid="app-bar-back"]';

    // Wait for the back button to appear and be visible
    await currentPage.waitForSelector(backButtonSelector, { visible: true });

    // Find the back button
    const backButton = await currentPage.$(backButtonSelector);

    if (backButton) {
      const buttonBox = await backButton.boundingBox();

      if (buttonBox) {
        // Function to add a random offset to simulate human-like clicking
        const getRandomOffset = range => {
          return Math.floor(Math.random() * (range * 2 + 1)) - range;
        };

        // Simulate a click on the back button with random offsets
        await currentPage.mouse.click(
          buttonBox.x + buttonBox.width / 2 + getRandomOffset(5),
          buttonBox.y + buttonBox.height / 2 + getRandomOffset(5),
        );

        console.log('Back button clicked successfully!');
      } else {
        console.log('Back button is not visible.');
      }
    } else {
      console.log('Back button not found.');
    }
  };

  /**
   * parseItem
   * @param {string} url - the url of the item to parse
   * @param {object} query - the query object to use for parsing
   * @returns {object} - the parsed item
   * @description - this function should parse the item at the given url and return the parsed item data
   *               according to the query object and for use in either search() or validate()
   */
  parseItem = async (item, url, currentPage, currentBrowser) => {
    // check if the browser has valid cookie or login session or not
    if (this.sessionValid == false) {
      await this.negotiateSession();
    }
    try {
      const $ = cheerio.load(item);
      let data = {};

      // get the article details
      const articles = $('article[data-testid="tweet"]').toArray();
      const el = articles[0];
      const tweetUrl = $('a[href*="/status/"]').attr('href');
      const tweetId = tweetUrl.split('/').pop();
      // get the other info about the article
      const screen_name = $(el).find('a[tabindex="-1"]').text();
      const allText = $(el).find('a[role="link"]').text();
      const user_name = allText.split('@')[0];
      const user_url =
        'https://x.com' + $(el).find('a[role="link"]').attr('href');
      const user_img = $(el).find('img[draggable="true"]').attr('src');
      const tweet_text = $(el)
        .find('div[data-testid="tweetText"]')
        .first()
        .text();
      const timeRaw = $(el).find('time').attr('datetime');
      const time = await this.convertToTimestamp(timeRaw);
      // this is for the hash and salt
      const tweets_content = tweet_text.replace(/\n/g, '<br>');
      const round = await namespaceWrapper.getRound();
      const originData = tweets_content + round;
      const saltRounds = 10;
      const salt = bcrypt.genSaltSync(saltRounds);
      const hash = bcrypt.hashSync(originData, salt);

      // click on article
      await this.clickArticle(currentPage, tweets_content, tweetId);

      await currentPage.waitForTimeout(await this.randomDelay(3000));

      // Click like button
      const commentContainer = await this.getCommentContainer(
        currentPage,
        tweet_text,
      );
      if (commentContainer) {
        await this.clickLikeButton(currentPage, commentContainer);
      } else {
        console.log('Comment container not found for the tweet.');
      }

      await currentPage.waitForTimeout(await this.randomDelay(3000));

      // check comment cooldown
      const currentTimeStamp = await this.getCurrentTimestamp(); // Fetch the current timestamp
      let isTimestampValid = await this.checkCommentTimestamp(currentTimeStamp);
      console.log('isTimestampValid', isTimestampValid);
      if (isTimestampValid) {
        // Click the comment button if the timestamp check is valid
        await this.clickCommentButton(currentPage, tweets_content);

        // Store the current timestamp as the new 'LAST_COMMENT_MADE'
        this.commentsDB.createTimestamp('LAST_COMMENT_MADE', currentTimeStamp);

        console.log('Comment action performed, and timestamp updated.');
      } else {
        console.log('No comment action was taken due to recent activity.');
      }

      // Check other comments and like comments who have keyword "koii"
      console.log(
        "Check other comments and like comments who have keyword 'koii'",
      );
      for (let i = 0; i < 5; i++) {
        await this.slowFingerSlide(this.page, 150, 500, 250, 200, 15, 10);
        await currentPage.waitForTimeout(await this.randomDelay(2000));
        const comments = await currentPage.evaluate(() => {
          const elements = document.querySelectorAll(
            'article[aria-labelledby]',
          );
          return Array.from(elements).map(element => element.outerHTML);
        });
        console.log('Found comments: ', comments.length);
        for (const comment of comments) {
          await currentPage.waitForTimeout(await this.randomDelay(500));
          const $ = cheerio.load(comment);
          const commentText = $('div[data-testid="tweetText"]').text();
          // console.log('Comment text:', commentText);

          if (commentText.toLowerCase().includes('koii')) {
            console.log('Found comment with keyword "koii"');
            // Find the correct like button for this comment
            const commentContainer = await this.getCommentContainer(
              currentPage,
              commentText,
            );
            if (commentContainer) {
              console.log('Found comment container for the matching comment.');
              await this.clickLikeButton(currentPage, commentContainer); // Pass the comment container to the click function
            } else {
              console.log(
                'Could not find comment container for the matching comment.',
              );
            }
          }
        }
      }

      // click back button after all comments and like
      await this.clickBackButton(currentPage);

      if (screen_name && tweet_text) {
        data = {
          user_name: user_name,
          screen_name: screen_name,
          user_url: user_url,
          user_img: user_img,
          tweets_id: tweetId,
          tweets_content: tweets_content,
          time_post: time,
          keyword: this.searchTerm,
          hash: hash,
          // commentDetails: getCommentDetailsObject,
        };
      }
      return data;
    } catch (e) {
      console.log('Something went wrong when comment or like post :: ', e);
    }
  };

  getRandomOffset = range => {
    return Math.floor(Math.random() * (range * 2 + 1)) - range;
  };
  /*
    @genText
    Receives a blurb to read, then returns a random koii-themed blurb
    * textToRead receives a blurb of text 
    @return => templated blurb
*/

  genText(textToRead) {
    let snippetSelectors = [
      '#Person',
      '#Possessive #Noun',
      '#Preposition #ProperNoun',
      '#ProperNoun',
      '#FirstName',
      '#Adjective #Noun #Noun',
      '#Adjective #Noun',
      '#Noun #Noun #Noun',
      '#Preposition #ProperNoun',
      '#Verb #Noun',
      '#ProperNoun #Verb',
      '#Verb #ProperNoun',
      '#Adverb #Verb',
    ];
    let result = 0;
    let n = 0;
    do {
      let snippet = this.selectSnippet(snippetSelectors[n], textToRead);
      if (snippet.length > 1) {
        // console.log('found result', snippet, 'with selector ', snippetSelectors[n])
        if (snippet.length < 20) {
          result = snippet;
          // console.log('\r\nfound: "', result ,'" on selector ', n)
          if (n > 7) result = ' you ' + result.substring(2);
        }
      }
      n++;
    } while (result == 0 && n < snippetSelectors.length);

    if (result == 0) {
      // console.log('\r\nFAILED to find text in ', textToRead)
      result = '#REDTober';
    }

    let templates = [
      `We got ${result} before we got Koii mainnet`,
      `I can't believe we got ${result} before Koii launched.`,
      `Wow, ${result} is dope and all, but I want Koii.`,
      `Wen ${result}, Koii launch?`,
    ];
    let output = templates[Math.floor(Math.random() * (templates.length - 1))];
    // output = nlp(output);
    // let output = result;
    console.log('genText returning ', output);
    return output;
  }

  /**
   * Attempts to return a sensible snippet from the provided text
   * @param {*} text
   */
  selectSnippet(snippetSelector, textToRead) {
    let doc = nlp(textToRead);

    let snippet = doc.match(snippetSelector).text();
    snippet = nlp(snippet);
    snippet.nouns().toPlural();
    snippet.people().normalize();
    snippet.toLowerCase();
    snippet.verbs().toGerund();
    snippet = snippet.text();
    if (snippet.length < 1) snippet = 0;
    // console.log( 'selector', snippetSelector, 'found snippet: ', snippet);

    return snippet;
  }

  convertToTimestamp = async dateString => {
    const date = new Date(dateString);
    return Math.floor(date.getTime() / 1000);
  };

  /**
   * search
   * @param {string} query
   * @returns {Promise<string[]>}
   * @description searchs the queue of known links
   */
  search = async query => {
    console.log('valid? ', this.sessionValid);
    if (this.sessionValid == true) {
      this.searchTerm = query.searchTerm;
      this.round = query.round;
      this.comment = query.comment;

      // check if the input is email or not
      const emailRegex = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
      const checkEmail = emailRegex.test(query.username);
      if (checkEmail) {
        // get the username from the home
        await this.page.waitForTimeout(await this.randomDelay(2000));
        await this.page.goto('https://x.com/home');
        await this.page.waitForTimeout(await this.randomDelay(2000));
        const loggedInUsername = await this.page.evaluate(() => {
          const elements = document.querySelectorAll(
            '[data-testid^="UserAvatar-Container-"]',
          );
          const extractUsername = element => {
            const dataTestId = element.getAttribute('data-testid');
            if (dataTestId) {
              const username = dataTestId.split('-').pop();
              return username && username.trim() ? username : null;
            }
            return null;
          };
          let username =
            elements.length > 0 ? extractUsername(elements[0]) : null;
          if (!username && elements.length > 1) {
            username = extractUsername(elements[1]);
          }
          return username ? username : 'No username found';
        });
        await this.page.waitForTimeout(await this.randomDelay(2000));
        if (loggedInUsername && loggedInUsername !== 'No username found') {
          this.username = loggedInUsername;
          await this.fetchList(query.query, query.round, query.searchTerm);
        }
        console.log('Failed to retrieve a valid username.');
      } else {
        this.username = query.username;
        await this.fetchList(query.query, query.round, query.searchTerm);
      }
    } else {
      await this.negotiateSession();
    }
  };

  // get the current timestamp
  getCurrentTimestamp = async () => {
    const currentDate = new Date();
    const millisecondsTimestamp = currentDate.getTime();
    const currentTimeStamp = Math.floor(millisecondsTimestamp / 1000);
    return currentTimeStamp;
  };

  checkCommentTimestamp = async currentTimeStamp => {
    try {
      // Retrieve the last comment timestamp from the database (in seconds)
      const lastCommentTimestamp = await this.commentsDB.getTimestamp(
        'LAST_COMMENT_MADE',
      );
      if (!lastCommentTimestamp) {
        console.log('No previous comment timestamp found in the database.');
        return true; // No timestamp, allow the new comment
      }

      // Convert both timestamps from seconds to milliseconds for comparison
      const lastTimestamp = lastCommentTimestamp * 1000;
      const currentTimestamp = currentTimeStamp * 1000;

      console.log(`Last comment timestamp: ${lastTimestamp}`);
      console.log(`Current timestamp: ${currentTimestamp}`);

      // Check if the timestamps are valid numbers
      if (isNaN(lastTimestamp) || isNaN(currentTimestamp)) {
        console.log('Invalid timestamp detected.');
        return false; // Avoid proceeding if timestamps are invalid
      }

      // Define the random cooldown range: 30 minutes ± 5 minutes (25 to 35 minutes) in milliseconds
      const MIN_COOLDOWN_IN_MS = 25 * 60 * 1000; // 25 minutes in milliseconds
      const MAX_COOLDOWN_IN_MS = 35 * 60 * 1000; // 35 minutes in milliseconds

      // Generate a random cooldown between 25 and 35 minutes
      const randomCooldown =
        Math.floor(
          Math.random() * (MAX_COOLDOWN_IN_MS - MIN_COOLDOWN_IN_MS + 1),
        ) + MIN_COOLDOWN_IN_MS;

      // Calculate the difference between the current time and the last comment time
      const timeDifference = currentTimestamp - lastTimestamp;

      // If the time difference is less than or equal to the random cooldown, skip the comment
      if (timeDifference <= randomCooldown) {
        console.log(
          `Last comment was made within the cooldown period of ${
            randomCooldown / (60 * 1000)
          } minutes, skipping comment action.`,
        );
        return false;
      }
      // If the last comment is older than the allowed range, allow the new comment
      return true;
    } catch (error) {
      console.log(`Error in checkCommentTimestamp: `, error);
      return false; // Fail-safe: don't proceed with the comment action
    }
  };

  /**
   * fetchList
   * @param {string} url
   * @returns {Promise<string[]>}
   * @description Fetches a list of links from a given url
   */
  fetchList = async (url, round, searchTerm) => {
    try {
      if (
        this.username === '' ||
        this.username === null ||
        this.username === undefined
      ) {
        console.log(
          'fetching list stopped: Please replace TWITTER_USERNAME with your Twitter username, not your Email Address.',
        );
        return;
      }

      console.log('Go to search page');
      // Wait for the explore link to be available
      const exploreLinkSelector = 'a[data-testid="AppTabBar_Explore_Link"]';
      await this.page.waitForSelector(exploreLinkSelector, { visible: true });

      await this.page.waitForTimeout(await this.randomDelay(3000));
      const exploreLink = await this.page.$(exploreLinkSelector);

      if (exploreLink) {
        const linkBox = await exploreLink.boundingBox();

        if (linkBox) {
          // Simulate a click on the link using mouse.click with random offsets
          await this.page.mouse.click(
            linkBox.x + linkBox.width / 2 + this.getRandomOffset(5),
            linkBox.y + linkBox.height / 2 + this.getRandomOffset(5),
          );

          console.log('Explore link clicked successfully!');
        } else {
          console.log('Link bounding box not available.');
        }
      } else {
        console.log('Explore link not found.');
      }

      await this.page.waitForTimeout(await this.randomDelay(3000));

      // Define the selector for the search input field
      const searchInputSelector = 'input[data-testid="SearchBox_Search_Input"]';

      // Wait for the input element to be visible
      await this.page.waitForSelector(searchInputSelector, { visible: true });

      const searchInputField = await this.page.$(searchInputSelector);

      if (searchInputField) {
        const inputBox = await searchInputField.boundingBox();

        if (inputBox) {
          // Simulate a click on the input field with random offsets
          await this.page.mouse.click(
            inputBox.x + inputBox.width / 2 + this.getRandomOffset(5),
            inputBox.y + inputBox.height / 2 + this.getRandomOffset(5),
          );

          console.log(
            'Search input field clicked successfully, ready for typing.',
          );
        } else {
          console.log('Search input field bounding box not available.');
        }
      } else {
        console.log('Search input field not found.');
      }

      await this.page.waitForTimeout(await this.randomDelay(3000));

      // Type the search term into the input field
      await this.humanType(this.page, searchInputSelector, searchTerm);
      // hit enter
      await this.page.keyboard.press('Enter');

      await this.page.waitForTimeout(await this.randomDelay(1000));
      console.log('fetching list for ', this.page.url());

      // error message
      const errorMessage = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('div[dir="ltr"]');
        for (let element of elements) {
          console.log(element.textContent);
          if (element.textContent === 'Something went wrong. Try reloading.') {
            return true;
          }
        }
        return false;
      });

      await this.page.waitForTimeout(await this.randomDelay(4500));
      await this.slowFingerSlide(this.page, 150, 500, 250, 200, 10, 5);
      console.log('Waiting for tweets loaded');
      // await this.page.waitForNavigation({ waitUntil: 'networkidle2' });
      await this.page.waitForTimeout(await this.randomDelay(4000));
      await this.slowFingerSlide(this.page, 150, 200, 250, 500, 5, 5);
      await this.page.waitForTimeout(await this.randomDelay(1000));
      // get the articles
      const items = await this.page.evaluate(() => {
        const elements = document.querySelectorAll('article[aria-labelledby]');
        return Array.from(elements).map(element => element.outerHTML);
      });
      console.log('Found items: ', items.length);

      // loop the articles
      for (const item of items) {
        await new Promise(resolve => setTimeout(resolve, 1000)); // @soma Nice delay timer, never thought of doing it this way
        try {
          await this.page.waitForTimeout(await this.randomDelay(2000));
          // add the comment on the post
          let data = await this.parseItem(item, url, this.page, this.browser);

          // check if comment found or not
          if (data.tweets_id) {
            let checkItem = {
              id: data.tweets_id,
            };
            const existingItem = await this.db.getItem(checkItem);
            if (!existingItem) {
              this.cids.create({
                id: data.tweets_id,
                round: round,
                data: data,
              });
            }
          }
        } catch (e) {
          console.log(
            'Something went wrong while fetching the list of items :: ',
            e,
          );
        }
      }

      try {
        let dataLength = (await this.cids.getList({ round: round })).length;
        console.log('Time to break, data length: ', dataLength);
        if (dataLength > 120) {
          console.log('reach maixmum data per round. Closed old browser');
          this.browser.close();
        }
        console.log('No more items found, scrolling down...');
        // Call the function to perform the slow slide
        await this.slowFingerSlide(this.page, 150, 500, 250, 200, 15, 5);

        // Optional: wait for a moment to allow new elements to load
        await this.page.waitForTimeout(await this.randomDelay(2000));

        // Refetch the elements after scrolling
        await this.page.evaluate(() => {
          return document.querySelectorAll('article[aria-labelledby]');
        });
      } catch (e) {
        console.log('round check error', e);
      }

      // If the error message is found, wait for 2 minutes, refresh the page, and continue
      if (errorMessage) {
        console.log('Rate limit reach, waiting for next round...');
        this.browser.close();
      }
      return;
    } catch (e) {
      console.log('Last round fetching list stop', e);
      return;
    }
  };

  slowFingerSlide = async (page, startX, startY, endX, endY, steps, delay) => {
    // Start the touch event at the initial position
    await page.touchscreen.touchStart(startX, startY);

    // Calculate the increments for each step
    const xStep = (endX - startX) / steps;
    const yStep = (endY - startY) / steps;

    // Move the "finger" step by step, with a delay between each step
    for (let i = 0; i <= steps; i++) {
      const currentX = startX + xStep * i;
      const currentY = startY + yStep * i;
      await page.touchscreen.touchMove(currentX, currentY);

      // Wait for a short period to slow down the slide
      await page.waitForTimeout(delay);
    }

    // End the touch event
    await page.touchscreen.touchEnd();

    console.log('Slow finger sliding action performed successfully!');
  };

  compareHash = async (data, saltRounds) => {
    const round = await namespaceWrapper.getRound();
    const dataToCompare = data.data.tweets_content + round; // + data.data.tweets_id;
    console.log(dataToCompare);
    const salt = bcrypt.genSaltSync(saltRounds);
    const hash = bcrypt.hashSync(dataToCompare, salt);
    console.log(hash);
    const hashCompare = bcrypt.compareSync(dataToCompare, hash);
    console.log(hashCompare);
    const hashCompareWrong = bcrypt.compareSync(data.data.tweets_id, hash);
    console.log(hashCompareWrong);
  };

  /**
   * retrieveItem derived from fetchList
   * @param {*} url
   * @param {*} item
   * @returns
   */
  retrieveItem = async (verify_page, comment, selectedPage) => {
    try {
      const items = await verify_page.evaluate(() => {
        const elements = document.querySelectorAll('article[aria-labelledby]');
        return Array.from(elements).map(element => element.outerHTML);
      });

      if (items.length === 0) {
        return { result: {}, bool: true };
      }

      const $ = cheerio.load(items[0]);
      const articles = $('article[data-testid="tweet"]').toArray();
      const el = articles[0];
      const tweetUrl = $('a[href*="/status/"]').attr('href');
      const tweetId = tweetUrl.split('/').pop();
      // get the other info about the article
      const screen_name = $(el).find('a[tabindex="-1"]').text();
      const allText = $(el).find('a[role="link"]').text();
      const user_name = allText.split('@')[0];
      const user_url =
        'https://x.com' + $(el).find('a[role="link"]').attr('href');
      const user_img = $(el).find('img[draggable="true"]').attr('src');
      const tweet_text = $(el)
        .find('div[data-testid="tweetText"]')
        .first()
        .text();
      const timeRaw = $(el).find('time').attr('datetime');
      const time = await this.convertToTimestamp(timeRaw);
      // this is for the hash and salt
      const tweets_content = tweet_text.replace(/\n/g, '<br>');

      var foundItem = {};
      if (selectedPage === 'commentPage') {
        // get the comment details
        let trimCommentText = await this.cleanText(comment);
        const commentDetails = await verify_page.evaluate(
          async cleanTextStr => {
            const cleanText = new Function('return ' + cleanTextStr)();

            const tweetElements = Array.from(
              document.querySelectorAll('article[data-testid="tweet"]'),
            );
            const details = [];
            await Promise.all(
              tweetElements.map(async tweetElement => {
                let commentId = null;
                let username = null;
                let postTime = null;

                const textElement = tweetElement.querySelector('div[lang]');
                let textContent = '';
                if (textElement && textElement.childNodes) {
                  textElement.childNodes.forEach(node => {
                    let content = '';

                    if (node.nodeName === 'IMG') {
                      content = node.alt || '';
                    } else {
                      content = node.innerText || node.textContent;
                    }

                    // Check if content is not null, undefined, or empty
                    if (content) {
                      textContent += content;
                    }
                  });
                }

                const timeElements = Array.from(
                  tweetElement.querySelectorAll('time[datetime]'),
                );
                if (timeElements.length > 0) {
                  timeElements.forEach(async timeElement => {
                    const anchorElement = timeElement.closest('a');
                    if (anchorElement) {
                      const urlMatch = anchorElement.href.match(
                        /^https?:\/\/[^\/]+\/([^\/]+)\/status\/(\d+)$/,
                      );
                      username = urlMatch ? urlMatch[1] : null;
                      commentId = urlMatch ? urlMatch[2] : null;
                      postTime = timeElement.getAttribute('datetime');
                    }
                  });
                }

                await new Promise(resolve => setTimeout(resolve, 10000));

                if (textContent) {
                  try {
                    const getComments = await cleanText(textContent);
                    details.push({
                      commentId,
                      getComments,
                      username,
                      postTime,
                    });
                  } catch (error) {
                    console.error('Error processing comment:', error);
                  }
                }
              }),
            );
            return details;
          },
          this.cleanText.toString(),
          trimCommentText,
        );

        // update the post time
        for (let item of commentDetails) {
          item.postTime = await this.convertToTimestamp(item.postTime);
        }

        // Check if the comment already exists
        foundItem = commentDetails.find(item =>
          item.getComments
            .toLowerCase()
            .includes(trimCommentText.toLowerCase()),
        );

        if (foundItem) {
          const found = !!foundItem;
          if (found) {
            console.log('AUDITS :::: Comment found. ');
            foundItem.getComments = comment;
          }
        } else {
          return { result: {}, bool: true };
        }
      }

      // get the object
      const data = {
        user_name: user_name,
        screen_name: screen_name,
        user_url: user_url,
        user_img: user_img,
        tweets_id: tweetId,
        tweets_content: tweets_content,
        time_post: time,
        commentDetails: foundItem,
      };

      return { result: data, bool: true };
    } catch (e) {
      console.log('Last round fetching list stop', e);
      return { result: {}, bool: false };
    }
  };

  verify = async (inputItem, round) => {
    console.log('----Input Item Below -----');
    console.log(inputItem);
    console.log('----Input Item Above -----');
    try {
      const options = {};
      const userAuditDir = path.join(
        __dirname,
        'puppeteer_cache_AIC_twitter_archive_audit',
      );
      const stats = await PCR(options);
      console.log(
        '*****************************************CALLED PURCHROMIUM VERIFIER*****************************************',
      );
      let auditBrowser = await stats.puppeteer.launch({
        executablePath: stats.executablePath,
        userDataDir: userAuditDir,
        // headless: false,
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        args: [
          '--aggressive-cache-discard',
          '--disable-cache',
          '--disable-application-cache',
          '--disable-offline-load-stale-cache',
          '--disable-gpu-shader-disk-cache',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-gpu',
        ],
      });
      console.log('Step: Open new page');
      const verify_page = await auditBrowser.newPage();
      await verify_page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      );
      await verify_page.waitForTimeout(await this.randomDelay(3000));
      await verify_page.setViewport({ width: 1024, height: 4000 });
      await verify_page.waitForTimeout(await this.randomDelay(3000));
      // go to the comment page
      const url = `https://x.com/${inputItem.commentDetails.username}/status/${inputItem.commentDetails.commentId}`;
      await verify_page.goto(url, { timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      // check if the page gave 404
      let confirmed_no_tweet = false;
      await verify_page.evaluate(() => {
        if (document.querySelector('[data-testid="error-detail"]')) {
          console.log('Error detail found');
          confirmed_no_tweet = true;
        }
      });
      if (confirmed_no_tweet) {
        return false;
      }
      console.log('Retrieve item for', url);
      const commentRes = await this.retrieveItem(
        verify_page,
        inputItem.commentDetails.getComments,
        'commentPage',
      );
      await verify_page.waitForTimeout(await this.randomDelay(4000));
      // go to the tweet where comment is posted
      const url2 = `https://x.com/any/status/${inputItem.tweets_id}`;
      await verify_page.goto(url2, { timeout: 60000 });
      await new Promise(resolve => setTimeout(resolve, 5000));
      // check if the page gave 404
      let confirmed_no_tweet2 = false;
      await verify_page.evaluate(() => {
        if (document.querySelector('[data-testid="error-detail"]')) {
          console.log('Error detail found');
          confirmed_no_tweet2 = true;
        }
      });
      if (confirmed_no_tweet2) {
        return false;
      }
      // which page
      console.log('Retrieve item for', url2);
      const tweetRes = await this.retrieveItem(verify_page, '', '');
      await verify_page.waitForTimeout(await this.randomDelay(4000));

      if (
        Object.keys(commentRes.result.commentDetails).length > 0 &&
        commentRes.bool &&
        Object.keys(tweetRes.result).length > 0 &&
        tweetRes.bool
      ) {
        return true;
      }

      if (
        Object.keys(commentRes.result.commentDetails).length > 0 &&
        commentRes.bool
      ) {
        // check all the comment details in audits
        if (
          commentRes.result.commentDetails.commentId !=
          inputItem.commentDetails.commentId
        ) {
          console.log(
            'Comment Not Found',
            commentRes.result.commentDetails.commentId,
            inputItem.commentDetails.commentId,
          );
          auditBrowser.close();
          return false;
        }
        // check the content of the comment
        const resultGetComments = await this.cleanText(
          commentRes.result.commentDetails.getComments,
        );
        const inputItemGetComments = await this.cleanText(
          inputItem.commentDetails.getComments,
        );
        if (
          resultGetComments.trim().toLowerCase() !==
          inputItemGetComments.trim().toLowerCase()
        ) {
          console.log(
            'Comments are not the same',
            commentRes.result.commentDetails.getComments,
            inputItem.commentDetails.getComments,
          );
          auditBrowser.close();
          return false;
        }
        // check the username
        if (
          commentRes.result.commentDetails.username !=
          inputItem.commentDetails.username
        ) {
          console.log(
            'username is not matched',
            commentRes.result.commentDetails.username,
            inputItem.commentDetails.username,
          );
          auditBrowser.close();
          return false;
        }
        // get the comment postTime time difference
        const timeDifference =
          Math.abs(
            commentRes.result.commentDetails.postTime -
              inputItem.commentDetails.postTime,
          ) * 1000;
        // Check if the difference is more than 15 minutes
        if (timeDifference > 15 * 60 * 1000) {
          console.log(
            'Post times differ by more than 15 minutes.',
            commentRes.result.commentDetails.postTime,
            inputItem.commentDetails.postTime,
          );
          auditBrowser.close();
          return false;
        }

        // check the tweet content
        if (Object.keys(tweetRes.result).length > 0 && tweetRes.bool) {
          // tweet content check
          if (tweetRes.result.tweets_content != inputItem.tweets_content) {
            console.log(
              'Content not match',
              tweetRes.result.tweets_content,
              inputItem.tweets_content,
            );
            auditBrowser.close();
            return false;
          }
          const dataToCompare = tweetRes.result.tweets_content + round;
          const hashCompare = bcrypt.compareSync(dataToCompare, inputItem.hash);
          if (hashCompare == false) {
            console.log(
              'Hash Verification Failed',
              dataToCompare,
              inputItem.hash,
            );
            auditBrowser.close();
            return false;
          }
        }

        auditBrowser.close();
        return true;
      }

      // Result does not exist
      console.log('Result does not exist. ');
      auditBrowser.close();
      return false;
    } catch (e) {
      console.log('Error fetching single item', e);
      return false; // Return false in case of an exception
    }
  };

  scrollPage = async page => {
    await page.evaluate(() => {
      window.scrollBy(0, window.innerHeight);
    });
    await page.waitForTimeout(5000); // Adjust the timeout as necessary
  };

  /**
   * processLinks
   * @param {string[]} links
   * @returns {Promise<void>}
   * @description Processes a list of links
   * @todo Implement this function
   * @todo Implement a way to queue links
   */
  processLinks = async links => {
    links.forEach(link => {});
  };

  randomDelay = async delayTime => {
    const delay =
      Math.floor(Math.random() * (delayTime - 1000 + 1)) + (delayTime - 1000);
    return delay;
  };

  /**
   * stop
   * @returns {Promise<boolean>}
   * @description Stops the searcher
   */
  stop = async () => {
    if (this.browser) {
      await this.browser.close();
      console.log('Old browser closed');
    }
    return (this.break = true);
  };
}

module.exports = Twitter;
