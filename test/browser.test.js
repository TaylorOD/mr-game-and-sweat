'use strict';

// Clicks through the built site in a real browser.
// Run with: node test/browser.test.js _site
const assert = require('assert');
const fs = require('fs');
const http = require('http');
const path = require('path');
const { chromium } = require('playwright');

const siteDir = path.resolve(process.argv[2] || '_site');
const TYPES = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.json': 'application/json', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.xml': 'application/xml' };

const server = http.createServer((request, response) => {
  let file = path.join(siteDir, decodeURIComponent(request.url.split('?')[0]));
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  if (!fs.existsSync(file)) {
    response.writeHead(404, { 'Content-Type': 'text/html' });
    return response.end(fs.readFileSync(path.join(siteDir, '404.html')));
  }
  response.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
  return response.end(fs.readFileSync(file));
});

async function reviewCount(page) {
  const text = await page.textContent('#review-count');
  return Number(text.split(' ')[0]);
}

async function run(base) {
  const browser = await chromium.launch();
  const failures = [];

  async function test(name, fn, options = {}) {
    const context = await browser.newContext(options);
    const page = await context.newPage();
    // Only the site's own code, outside services arent what we're testing
    const errors = [];
    await page.route('**/*', (route) => {
      const url = route.request().url();
      if (url.startsWith(base)) return route.continue();
      if (route.request().resourceType() === 'image') return route.abort();
      return route.abort();
    });
    page.on('pageerror', (error) => errors.push(error.message));
    try {
      await fn(page);
      assert.deepStrictEqual(errors, [], 'The page threw errors');
      console.log(`ok - ${name}`);
    } catch (error) {
      failures.push(name);
      console.error(`FAILED - ${name}\n${error.message}`);
    }
    await context.close();
  }

  await test('home page lists reviews and links to one', async (page) => {
    await page.goto(base);
    assert.ok((await page.locator('.card').count()) >= 10, 'Not enough cards');
    assert.ok((await page.locator('.card .score-badge').count()) >= 1, 'No score badges');
    assert.ok((await page.locator('.card .score-great').count()) >= 1, 'Score badges should be color coded');
    assert.ok((await page.title()).includes('Treadmill'), 'Home title should say what the site is');
    const first = page.locator('.card .card-title a').first();
    const title = (await first.textContent()).trim();
    const href = new URL(await first.getAttribute('href')).pathname;
    await page.goto(base + href);
    assert.strictEqual((await page.textContent('h1')).trim(), title);
  });

  await test('review page has a score box and related reviews', async (page) => {
    await page.goto(`${base}/review-far-cry-4/`);
    assert.ok(await page.isVisible('.score-box'));
    assert.ok((await page.textContent('.score-box')).includes('Pause friendly'));
    assert.ok(await page.isVisible('.score-box a[href*="store.steampowered.com/app/"]'));
    assert.ok((await page.locator('.related-reviews li').count()) >= 1);
  });

  await test('search finds games', async (page) => {
    await page.goto(`${base}/reviews/`);
    await page.waitForSelector('#review-grid .card');
    const all = await reviewCount(page);
    assert.ok(all > 380, `Only ${all} reviews`);
    await page.fill('#filter-search', 'hades');
    assert.strictEqual(await reviewCount(page), 2);
    const titles = await page.locator('#review-grid .card-title').allTextContents();
    assert.ok(titles.every((title) => /hades/i.test(title)), titles.join());
    await page.fill('#filter-search', 'zzzznotagame');
    assert.strictEqual(await reviewCount(page), 0);
    await page.fill('#filter-search', '');
    assert.strictEqual(await reviewCount(page), all);
  });

  await test('search works from the address bar', async (page) => {
    await page.goto(`${base}/reviews/?q=hades`);
    await page.waitForSelector('#review-grid .card');
    assert.strictEqual(await reviewCount(page), 2);
  });

  await test('header search goes to the results', async (page) => {
    await page.goto(base);
    await page.fill('.header-search input', 'hades');
    await page.press('.header-search input', 'Enter');
    await page.waitForSelector('#review-grid .card');
    assert.ok(page.url().includes('/reviews/?q=hades'), page.url());
    assert.strictEqual(await reviewCount(page), 2);
    assert.strictEqual(await page.inputValue('#filter-search'), 'hades');
    assert.strictEqual(await page.locator('.header-search').count(), 0);
  });

  await test('filters narrow the list', async (page) => {
    await page.goto(`${base}/reviews/`);
    await page.waitForSelector('#review-grid .card');
    const all = await reviewCount(page);
    for (const [id, value] of [
      ['#filter-genre', 'RPG'],
      ['#filter-pause', 'Yes'],
      ['#filter-session', 'Short'],
      ['#filter-score', '2.5'],
    ]) {
      await page.selectOption(id, value);
      const narrowed = await reviewCount(page);
      assert.ok(narrowed > 0 && narrowed < all, `${id} gave ${narrowed}`);
      await page.selectOption(id, { index: 0 });
    }
    await page.check('#filter-controller');
    const withController = await reviewCount(page);
    assert.ok(withController > 0 && withController < all);
  });

  await test('sorting and show more work', async (page) => {
    await page.goto(`${base}/reviews/`);
    await page.waitForSelector('#review-grid .card');
    assert.strictEqual(await page.locator('#review-grid .card').count(), 30);
    await page.click('#review-more');
    assert.strictEqual(await page.locator('#review-grid .card').count(), 60);
    await page.selectOption('#filter-sort', 'title');
    const titles = await page.locator('#review-grid .card-title').allTextContents();
    const sorted = [...titles].sort((a, b) => a.localeCompare(b));
    assert.deepStrictEqual(titles, sorted);
  });

  await test('best of page is ranked and links to other lists', async (page) => {
    await page.goto(`${base}/best-of/`);
    assert.strictEqual(await page.locator('.best-list li').count(), 25);
    const lists = page.locator('a[href*="/best-rpgs-for-exercise/"]');
    assert.ok((await lists.count()) >= 1);
    await page.goto(`${base}/best-rpgs-for-exercise/`);
    assert.ok((await page.locator('.best-list li').count()) >= 1);
  });

  await test('guides page lists guides with images', async (page) => {
    await page.goto(`${base}/guides/`);
    const guides = await page.locator('.card').count();
    assert.ok(guides >= 10, `Only ${guides} guides`);
    assert.strictEqual(await page.locator('.card img').count(), guides);
  });

  await test('our own images load as webp and game art comes from Steam', async (page) => {
    await page.goto(`${base}/how-to-set-up-your-treadmill-for-gaming/`);
    const own = await page.$eval('.post-banner img', (image) => image.currentSrc);
    assert.ok(own.endsWith('.webp'), own);
    await page.goto(`${base}/review-far-cry-4/`);
    const art = await page.getAttribute('.post-banner img', 'src');
    assert.ok(art.includes('steamstatic.com'), art);
  });

  await test('great games bad workouts page lists games', async (page) => {
    await page.goto(`${base}/great-games-bad-workouts/`);
    assert.ok((await page.textContent('h1')).includes('Bad Workouts'));
  });

  await test('removed reviews redirect', async (page) => {
    const response = await page.request.get(`${base}/review-sea-of-thieves-2024-edition/`);
    const html = await response.text();
    assert.ok(/http-equiv="refresh"/.test(html));
    assert.ok(html.includes('review-sea-of-thieves-2025-edition'));
  });

  await test('missing pages show the 404 page', async (page) => {
    const response = await page.goto(`${base}/this-page-does-not-exist/`);
    assert.strictEqual(response.status(), 404);
    assert.ok((await page.title()).includes('404'));
  });

  const phone = { viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true };
  await test('phone pages dont scroll sideways', async (page) => {
    for (const url of ['/', '/reviews/', '/best-of/', '/review-far-cry-4/', '/guides/', '/about/']) {
      await page.goto(base + url);
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
      assert.ok(overflow <= 1, `${url} is ${overflow}px too wide`);
    }
  }, phone);

  await test('phone filters stay out of the way until opened', async (page) => {
    await page.goto(`${base}/reviews/`);
    await page.waitForSelector('#review-grid .card');
    assert.ok(!(await page.isVisible('#filter-genre')));
    const first = await page.locator('#review-grid .card').first().boundingBox();
    assert.ok(first.y < 812, 'The first game should show on the first screen');
    await page.tap('#filters-toggle');
    await page.selectOption('#filter-genre', 'RPG');
    assert.strictEqual((await page.textContent('#filters-toggle')).trim(), 'Filters (1)');
  }, phone);

  await test('header search shows on phones without opening the menu', async (page) => {
    await page.goto(base);
    assert.ok(await page.isVisible('.header-search input'));
  }, phone);

  await test('phone menu opens', async (page) => {
    await page.goto(base);
    assert.ok(!(await page.isVisible('#navbarResponsive a[href$="/reviews/"]')));
    await page.tap('.navbar-toggler');
    await page.waitForSelector('#navbarResponsive a[href$="/reviews/"]', { state: 'visible', timeout: 3000 });
  }, phone);

  await browser.close();
  return failures;
}

server.listen(0, '127.0.0.1', async () => {
  const failures = await run(`http://127.0.0.1:${server.address().port}`);
  server.close();
  if (failures.length) {
    console.error(`\n${failures.length} browser tests failed`);
    process.exit(1);
  }
  console.log('browser checks passed');
});
