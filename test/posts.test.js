'use strict';

// Checks every post's data. Run with: node test/posts.test.js
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const { normalizeGameName } = require('../lib/review_utils');

const root = path.join(__dirname, '..');
const postsDir = path.join(root, '_posts');
const SECTIONS = [
  'Gameplay',
  'Treadmill and Bike Compatibility',
  'Computer Requirements',
  'Conclusion and Score',
];
const problems = [];
const report = (file, message) => problems.push(`${file}: ${message}`);

function parse(file) {
  const text = fs.readFileSync(path.join(postsDir, file), 'utf8').replace(/\r\n/g, '\n');
  const parts = text.split(/^---$/m);
  assert.ok(parts.length >= 3, `${file}: missing front matter`);
  const front = {};
  for (const line of parts[1].split('\n')) {
    const match = line.match(/^([a-z_]+):\s*(.*)$/);
    if (match) front[match[1]] = match[2].trim();
  }
  return { file, front, body: parts.slice(2).join('---') };
}

const posts = fs.readdirSync(postsDir).filter((file) => file.endsWith('.md')).map(parse);
assert.ok(posts.length > 400, 'Expected over 400 posts');

const seenTitles = new Map();
const seenAppIds = new Map();
const seenNames = new Map();

function checkUnique(seen, key, file, label) {
  if (seen.has(key)) report(file, `duplicate ${label} ${key}, also in ${seen.get(key)}`);
  seen.set(key, file);
}

function checkImage(post) {
  const { image } = post.front;
  if (!image || image === 'null') return report(post.file, 'has no image');
  if (image.includes('://')) {
    if (!image.startsWith('https://')) report(post.file, 'image must use https');
  } else if (!fs.existsSync(path.join(root, image))) {
    report(post.file, `image file is missing: ${image}`);
  }
}

for (const post of posts) {
  const { file, front, body } = post;
  const title = front.title ? front.title.replace(/^"|"$/g, '') : '';

  if (!/^\d{4}-\d{2}-\d{2}-[\w-]+\.md$/.test(file)) report(file, 'bad file name');
  if (!title) report(file, 'has no title');
  if (title.includes('Reviews:')) report(file, 'title still has the old prefix');
  if (!front.layout) report(file, 'has no layout');
  if (!body.trim()) report(file, 'has no body');
  if (front.added && !/^\d{4}-\d{2}-\d{2}$/.test(front.added)) report(file, 'bad added date');
  if (front.added && front.last_modified_at !== front.added) {
    report(file, 'added and last_modified_at should match');
  }
  if (/^# /m.test(body)) report(file, 'only the title should be a top level heading');
  if (/^Welcome (back )?to Mr\. Game and Sweat/m.test(body)) report(file, 'has the old intro');
  checkImage(post);
  checkUnique(seenTitles, title, file, 'title');

  if ((front.categories || '').includes('guide')) {
    if (!front.excerpt) report(file, 'guide has no excerpt');
    continue;
  }

  // Reviews
  checkUnique(seenNames, normalizeGameName(title), file, 'game');
  if (front.steam_appid) checkUnique(seenAppIds, front.steam_appid, file, 'Steam app');
  else report(file, 'review has no Steam app');

  const headings = [...body.matchAll(/^## (.+)$/gm)].map((match) => match[1]);
  for (const section of SECTIONS) {
    if (!headings.includes(section)) report(file, `missing section ${section}`);
  }

  const categories = [...body.matchAll(/^### Category Score: ([\d.]+) out of 3/gm)].map((m) => m[1]);
  const overall = body.match(/^### Overall Score:.*?([\d.]+) (?:out|our) of 3/m);
  if (categories.length !== 3) report(file, `has ${categories.length} category score lines`);
  if (!overall) report(file, 'has no overall score line');
  if (categories.length === 3) {
    const scoreFields = [front.score_gameplay, front.score_treadmill, front.score_computer];
    if (scoreFields.join() !== categories.join()) report(file, 'score fields dont match the text');
  }
  if (overall && front.score_overall !== overall[1]) report(file, 'overall score doesnt match the text');
  for (const score of [front.score_gameplay, front.score_treadmill, front.score_computer, front.score_overall]) {
    const value = Number(score);
    if (!(value >= 0 && value <= 3)) report(file, `score out of range: ${score}`);
  }

  if (!['"Yes"', '"Sometimes"', '"No"'].includes(front.pause_friendly)) {
    report(file, `pause_friendly must be a quoted Yes, Sometimes or No, got ${front.pause_friendly}`);
  }
  if (!['Short', 'Medium', 'Long'].includes(front.session_length)) {
    report(file, `bad session_length ${front.session_length}`);
  }
}

if (problems.length) {
  console.error(problems.join('\n'));
  console.error(`\n${problems.length} problems found`);
  process.exit(1);
}
console.log(`post data checks passed for ${posts.length} posts`);
