const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://lnkd.in/dgKqpVtx';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto(url, { waitUntil: 'networkidle2', timeout: 20000 });
    console.log('Final URL:', page.url());
    const content = await page.evaluate(() => {
      return document.body.innerText.slice(0, 5000);
    });
    console.log('JOB DESCRIPTION:\n', content);
  } catch (err) {
    console.error('Fetch error:', err.message);
  } finally {
    await browser.close();
  }
})();
