const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: "new" });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('BROWSER_CONSOLE:', msg.text()));
  page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
  page.on('requestfailed', request => console.log('BROWSER_REQUEST_FAILED:', request.url(), request.failure().errorText));

  await page.goto('http://localhost:3005', { waitUntil: 'networkidle0' });
  
  // Wait a bit
  await new Promise(r => setTimeout(r, 2000));
  
  // Click settings button if it exists
  try {
    const settingsBtn = await page.$('button[aria-label="Settings"]'); // Replace with correct selector
    if (settingsBtn) {
       await settingsBtn.click();
       await new Promise(r => setTimeout(r, 1000));
    }
  } catch (e) {}

  await browser.close();
})();
