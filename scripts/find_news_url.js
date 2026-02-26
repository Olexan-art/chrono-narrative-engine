import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
await page.goto('https://bravennow.com/news/ua');
await page.waitForSelector('article a[href^="/news/ua/"]', { timeout: 10000 });
const firstLink = await page.locator('article a[href^="/news/ua/"]').first().getAttribute('href');
const fullUrl = 'https://bravennow.com' + firstLink;
console.log('First news article:', fullUrl);
console.log('Path only:', firstLink);
await browser.close();