const PCR = require('puppeteer-chromium-resolver');
async function askCopilot(question) {
    const options = {};
    const stats = await PCR(options);
    const browser = await stats.puppeteer.launch({
        executablePath: stats.executablePath,
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
    // Go to ChatGPT
    const page = await browser.newPage();
    await page.goto('https://copilot.microsoft.com/');
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Find the Get started button and click it
    const getStartedButton = await page.waitForSelector('button[title="Get started"]');
    await getStartedButton.click();
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Input First Name
    const nameInput = await page.waitForSelector('textarea#userInput');
    await nameInput.type('Ben');
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Click Submit
    const submitButton = await page.waitForSelector('button[title="Submit message"]');
    await submitButton.click();
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Skip Voice Choose
    const nextButton = await page.waitForSelector('button[title="Next"]');
    await nextButton.click();
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Input Question in Text Area
    const questionInput = await page.waitForSelector('textarea#userInput');
    await questionInput.type(question);
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Click Submit Button
    const submitButton2 = await page.waitForSelector('button[title="Submit message"]');
    await submitButton2.click();
    // Wait 5 seconds
    await new Promise(resolve => setTimeout(resolve, 5000));
    // Retrieve Answer
    const textContent = await page.evaluate(() => {
        const element = document.querySelector('div[data-content="ai-message"] p');
        return element ? element.innerText : null;
    });


    await browser.close();
    return textContent;
}

module.exports = { askCopilot };