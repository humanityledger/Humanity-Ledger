const puppeteer = require('puppeteer');

(async () => {
  const url = 'https://www.linkedin.com/posts/aroncotrau_hiring-java-spring-share-7518976344844623872-aoe5/?highlightedUpdateUrn=urn%3Ali%3Aactivity%3A7518976345771601921';
  const browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  
  try {
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    const content = await page.evaluate(() => {
      const title = document.title;
      const metaDesc = document.querySelector('meta[property="og:description"]')?.content || document.querySelector('meta[name="description"]')?.content;
      const postText = document.querySelector('.attributed-text-segment-list__container')?.innerText 
                    || document.querySelector('.feed-shared-update-v2__description')?.innerText 
                    || document.querySelector('article')?.innerText
                    || document.body.innerText;
      return { title, metaDesc, postText: postText.slice(0, 3000) };
    });
    console.log('RESULT:', JSON.stringify(content, null, 2));
  } catch (err) {
    console.error('Fetch error:', err.message);
  } finally {
    await browser.close();
  }
})();
