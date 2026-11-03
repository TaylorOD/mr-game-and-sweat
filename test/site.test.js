'use strict';

// Checks the built site. Run with: node test/site.test.js _site
const assert = require('assert');
const fs = require('fs');
const path = require('path');

const siteDir = path.resolve(process.argv[2] || '_site');
const SITE_URL = 'https://mrgameandsweat.com';
const problems = [];
const report = (page, message) => problems.push(`/${page}: ${message}`);

assert.ok(fs.existsSync(siteDir), `No built site at ${siteDir}`);

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

const relative = (file) => path.relative(siteDir, file).split(path.sep).join('/');
const htmlFiles = walk(siteDir).filter((file) => file.endsWith('.html'));
const isRedirect = (html) => /http-equiv="refresh"/i.test(html);

function resolves(url, fromPage) {
  let target = url.split('#')[0].split('?')[0];
  if (!target) return true;
  if (target.startsWith(SITE_URL)) target = target.slice(SITE_URL.length) || '/';
  else if (/^(https?:)?\/\//.test(target) || /^(mailto|tel|data|javascript):/.test(target)) return true;
  const full = target.startsWith('/')
    ? path.join(siteDir, decodeURI(target))
    : path.join(siteDir, path.dirname(fromPage), decodeURI(target));
  return (
    (fs.existsSync(full) && fs.statSync(full).isFile()) ||
    fs.existsSync(path.join(full, 'index.html')) ||
    fs.existsSync(`${full}.html`)
  );
}

const count = (html, pattern) => (html.match(pattern) || []).length;
let pagesChecked = 0;

for (const file of htmlFiles) {
  const page = relative(file);
  const html = fs.readFileSync(file, 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  if (isRedirect(html)) continue;
  // Files like the license that arent real pages
  if (!/<html/i.test(html)) continue;
  pagesChecked++;

  if (count(html, /<title[ >]/g) !== 1) report(page, 'should have exactly one title tag');
  if (!/<title>[^<]*\S[^<]*<\/title>/.test(html)) report(page, 'title is empty');
  if (count(html, /<h1[ >]/g) !== 1) report(page, `has ${count(html, /<h1[ >]/g)} h1 tags`);
  if (!/<meta name="description" content="[^"]+"/.test(html)) report(page, 'has no meta description');
  if (!/<meta property="og:image" content="https:\/\/[^"]+"/.test(html)) report(page, 'has no social image');
  if (page !== '404.html') {
    const canonical = html.match(/<link rel="canonical" href="([^"]+)"/);
    if (!canonical) report(page, 'has no canonical link');
    else if (!canonical[1].startsWith(`${SITE_URL}/`)) report(page, `bad canonical ${canonical[1]}`);
  }
  if (/\{\{|\{%/.test(html.replace(/<script[\s\S]*?<\/script>/g, ''))) {
    report(page, 'has unprocessed template code');
  }
  if (html.includes('UA-113961478')) report(page, 'still has the old analytics tag');
  if (html.includes('<img') && /<img(?![^>]*\balt=)[^>]*>/.test(html)) {
    report(page, 'has an image with no alt text');
  }

  for (const [, script] of html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)) {
    try {
      JSON.parse(script);
    } catch (error) {
      report(page, 'has invalid structured data');
    }
  }

  for (const [, url] of html.matchAll(/<(?:a|link)\b[^>]*\bhref="([^"]+)"/g)) {
    if (url.includes('{{')) continue;
    if (!resolves(url, page)) report(page, `broken link ${url}`);
  }
  for (const [, url] of html.matchAll(/<(?:img|script)\b[^>]*\bsrc="([^"]+)"/g)) {
    if (!resolves(url, page)) report(page, `broken file ${url}`);
  }
  // Images we host need their sizes, Steam art doesnt
  for (const [tag] of html.matchAll(/<img\b[^>]*>/g)) {
    const srcset = tag.match(/\bsrcset="([^"]+)"/);
    if (/src="[^"]*assets\/images\/(guides|authors|reviews)\//.test(tag) && !srcset) report(page, 'own image has no srcset');
    for (const entry of srcset ? srcset[1].split(',') : []) {
      const url = entry.trim().split(' ')[0];
      if (!resolves(url, page)) report(page, `broken file ${url}`);
    }
  }
}
assert.ok(pagesChecked > 400, `Only checked ${pagesChecked} pages`);

// Pages that need to exist
for (const page of ['index.html', 'reviews/index.html', 'best-of/index.html', 'guides/index.html',
  'about/index.html', 'contact/index.html', 'sitemap.xml', 'robots.txt', 'feed.xml']) {
  if (!fs.existsSync(path.join(siteDir, page))) report(page, 'is missing');
}

// Page links should go straight to the page, not through a redirect
const homePage = fs.readFileSync(path.join(siteDir, 'index.html'), 'utf8');
if (!homePage.includes(`rel="next" href="${SITE_URL}/page2/"`)) report('index.html', 'next link should end in a slash');

// Bots are welcome everywhere and can find the sitemap
const robots = fs.readFileSync(path.join(siteDir, 'robots.txt'), 'utf8');
if (/^Disallow:\s*\S/m.test(robots)) report('robots.txt', 'should not block anything');
if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) report('robots.txt', 'should point to the sitemap');
for (const file of ['humans.txt', 'llms.txt', 'opensearch.xml', '21c8004707a78a9a3024cfb310828a10.txt']) {
  if (!fs.existsSync(path.join(siteDir, file))) report(file, 'is missing');
}

// Removed duplicates should send people to the review we kept
for (const [gone, kept] of [
  ['review-sea-of-thieves-2024-edition', 'review-sea-of-thieves-2025-edition'],
  ['review-grand-theft-auto-iv-complete-edition', 'review-grand-theft-auto-iv-the-complete-edition'],
  ['review-grand-theft-auto-v-legacy', 'review-grand-theft-auto-v'],
  ['review-the-elder-scrolls-v-skyrim', 'review-the-elder-scrolls-v-skyrim-special-edition'],
]) {
  const file = path.join(siteDir, gone, 'index.html');
  if (!fs.existsSync(file) || !fs.readFileSync(file, 'utf8').includes(kept)) {
    report(gone, `should redirect to ${kept}`);
  }
}

// Search data
const reviews = JSON.parse(fs.readFileSync(path.join(siteDir, 'reviews.json'), 'utf8'));
assert.ok(reviews.length > 380, `Only ${reviews.length} reviews in the search data`);
for (const review of reviews) {
  if (!review.title || !review.url || typeof review.score !== 'number') {
    report('reviews.json', `bad entry ${JSON.stringify(review).slice(0, 80)}`);
  }
  if (!resolves(review.url, 'reviews.json')) report('reviews.json', `broken link ${review.url}`);
}

const searchIndex = JSON.parse(fs.readFileSync(path.join(siteDir, 'search.json'), 'utf8'));
assert.ok(searchIndex.length > reviews.length, 'Search data is missing the guides');
assert.ok(searchIndex.some((entry) => entry.guide && entry.title), 'Search data has no guides');
for (const entry of searchIndex) {
  if (!entry.text || !resolves(entry.url, 'search.json')) report('search.json', `bad entry ${entry.url}`);
}

// Every review should be one click from a page linked in the footer
const allGames = fs.readFileSync(path.join(siteDir, 'all-games', 'index.html'), 'utf8');
for (const review of reviews) {
  if (!allGames.includes(`href="${review.url}"`)) report('all-games', `is missing ${review.title}`);
}

// Comparison pages should find both of their games
for (const file of fs.readdirSync(path.join(__dirname, '..', 'pages', 'comparisons'))) {
  const page = `${file.slice(0, -3)}/index.html`;
  const html = fs.readFileSync(path.join(siteDir, page), 'utf8');
  if (count(html, /<th scope="col">/g) !== 2 || !/<img/.test(html.split('</thead>')[0])) report(page, 'is missing a game');
  if (count(html, /\/3<\/td>/g) !== 6) report(page, 'is missing scores');
}

// Best of lists shouldnt ever be empty
for (const file of htmlFiles) {
  const html = fs.readFileSync(file, 'utf8');
  if (html.includes('class="best-list"') && count(html, /class="best-list-image"/g) === 0) {
    report(relative(file), 'has an empty list');
  }
}

// A review page has what it should
const sample = fs.readFileSync(path.join(siteDir, 'review-far-cry-4', 'index.html'), 'utf8');
if (!sample.includes('class="score-box"')) report('review-far-cry-4', 'has no score box');
if (!sample.includes('store.steampowered.com/app/298110')) report('review-far-cry-4', 'has no Steam link');
if (!sample.includes('"@type": "Review"')) report('review-far-cry-4', 'has no review markup');

// The sitemap should use the real address
const sitemap = fs.readFileSync(path.join(siteDir, 'sitemap.xml'), 'utf8');
if (!sitemap.includes(`<loc>${SITE_URL}/`)) report('sitemap.xml', 'uses the wrong site address');

if (problems.length) {
  console.error(problems.slice(0, 200).join('\n'));
  console.error(`\n${problems.length} problems found`);
  process.exit(1);
}
console.log(`site checks passed for ${pagesChecked} pages`);
