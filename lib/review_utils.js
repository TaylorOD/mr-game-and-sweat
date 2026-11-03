'use strict';

const EDITION_SUFFIX =
  /\s*(?:\d{4}\s+edition|(?:the\s+)?(?:\d+(?:st|nd|rd|th)\s+anniversary|definitive|enhanced|special|legacy|remastered|redux|complete|ultimate|deluxe|gold|classic|game of the year|goty|directors cut)(?:\s+edition)?|edition)$/;

// Same game, different store listing: "Sea of Thieves: 2026 Edition" and
// "Sea of Thieves: 2024 Edition" both become "sea of thieves".
function normalizeGameName(name) {
  let normalized = name
    .toString()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  let previous;
  do {
    previous = normalized;
    const stripped = normalized.replace(EDITION_SUFFIX, '').trim();
    // A name that is only a year or edition word is still the game's name
    if (stripped) normalized = stripped;
  } while (normalized !== previous);

  return normalized;
}

function extractCategoryScores(text) {
  return [...text.matchAll(/Category Score:\s*\**\s*([0-3])\b/g)].map((match) =>
    Number(match[1])
  );
}

function overallScore(scores) {
  const total = scores.reduce((sum, score) => sum + score, 0);
  return Math.round((total / scores.length) * 100) / 100;
}

function stripOverallScore(text) {
  return text.replace(/^.*Overall Score:.*$/gm, '').trim();
}

// Days in the range, oldest first, that dont have a post yet
function emptyDays(startDate, endDate, takenDays) {
  const days = [];
  const day = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  while (day <= end) {
    const key = day.toISOString().split('T')[0];
    if (!takenDays.has(key)) days.push(key);
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return days;
}

function hasBeenReviewed(game, reviewed) {
  return (
    reviewed.appids.has(Number(game.appid)) ||
    reviewed.names.has(normalizeGameName(game.name))
  );
}

// The top games of each genre by positive reviews, best first, with no repeats
function topGamesByGenre(genreLists, perGenre) {
  const games = new Map();
  for (const list of genreLists) {
    const top = [...list].sort((a, b) => b.positive - a.positive).slice(0, perGenre);
    for (const game of top) games.set(game.appid, game);
  }
  return [...games.values()].sort((a, b) => b.positive - a.positive);
}

function pickUnreviewedGames(sortedGames, reviewed, count) {
  const names = new Set(reviewed.names);
  const picked = [];
  for (const game of sortedGames) {
    if (picked.length === count) break;
    if (hasBeenReviewed(game, { appids: reviewed.appids, names })) continue;
    // Also stops two editions of one game landing in the same batch
    names.add(normalizeGameName(game.name));
    picked.push(game);
  }
  return picked;
}

// Reviews only get one top level heading, the title
function fixHeadingLevels(text) {
  return text.replace(/^# /gm, '## ');
}

// The model sometimes leaves a score at the end of a paragraph
function fixInlineScores(text) {
  return text.replace(/^([^#\n].*?)[ \t]*#{1,6}[ \t]*Category Score:/gm, '$1\n\n### Category Score:');
}

function buildReviewPost({ game, steam, workout, body, scores, reviewDate, addedDate, desk }) {
  const overall = overallScore(scores);
  const details = [
    `score_gameplay: ${scores[0]}`,
    `score_treadmill: ${scores[1]}`,
    `score_computer: ${scores[2]}`,
    `score_overall: ${overall}`,
    game.appid && `steam_appid: ${game.appid}`,
    game.store_url && `store_url: ${game.store_url}`,
    game.store_name && `store_name: ${game.store_name}`,
    steam && steam.controller && `controller: ${steam.controller}`,
    steam && steam.genres.length > 0 && `genres: ${JSON.stringify(steam.genres)}`,
    workout && `pause_friendly: ${JSON.stringify(workout.pause_friendly)}`,
    workout && `session_length: ${workout.session_length}`,
  ]
    .filter(Boolean)
    .join('\n');

  return `---
layout: post
title:  ${JSON.stringify(game.name)}
author: taylor
comments: false
disqus: false
date:   ${reviewDate.toISOString()}
categories: [ review, game${desk ? ', desk' : ''} ]
image: ${(steam && steam.image) || 'assets/images/logos/mr-game-and-sweat.png'}
${addedDate ? `added: ${addedDate}\nlast_modified_at: ${addedDate}\n` : ''}${details}
---

${fixInlineScores(fixHeadingLevels(body))}

### Overall Score: ${overall} out of 3
`;
}

// The next topics we dont already have a guide for
function nextGuideTopics(topics, guides, count) {
  const titles = new Set(guides.map((guide) => normalizeGameName(guide.title)));
  return topics.filter((topic) => !titles.has(normalizeGameName(topic.title))).slice(0, count);
}

function buildGuidePost({ title, excerpt, body, image, date }) {
  return `---
layout: post
title:  ${JSON.stringify(title)}
author: taylor
comments: false
disqus: false
date:   ${date.toISOString()}
categories: [ guide ]
image: ${image}
excerpt: ${JSON.stringify(excerpt)}
---

${fixHeadingLevels(body).trim()}
`;
}

// Splits a post into its front matter and a list of headings and text, so text can change and headings cant
function splitReview(text) {
  const clean = text.replace(/
/g, '
');
  const match = clean.match(/^---
([\s\S]*?
)---
([\s\S]*)$/);
  if (!match) throw new Error('Post has no front matter');
  const body = [];
  let current = null;
  const flush = () => {
    if (current && current.lines.join('').trim()) {
      body.push({ heading: current.heading, text: current.lines.join('
').trim() });
    }
  };
  for (const line of match[2].split('
')) {
    if (/^#{2,3} /.test(line)) {
      flush();
      body.push({ line });
      current = { heading: line.replace(/^#+ /, ''), lines: [] };
    } else {
      if (!current) current = { heading: 'Intro', lines: [] };
      current.lines.push(line);
    }
  }
  flush();
  return { front: match[1], body };
}

function joinReview({ front, body }) {
  return `---
${front}---

${body.map((piece) => piece.line || piece.text).join('

')}
`;
}

// Only generated reviews from before the current prompt. Older posts have people's own words in them.
function needsRewrite(file, text) {
  if (!/^\d{4}-\d{2}-\d{2}-review-/.test(file) || file.slice(0, 10) >= '2026-02-01') return false;
  if (!/^score_overall:/m.test(text)) return false;
  return !/^(added|last_modified_at):/m.test(text) && !/^categories:.*desk/m.test(text);
}

module.exports = {
  splitReview,
  joinReview,
  needsRewrite,
  nextGuideTopics,
  buildGuidePost,
  fixInlineScores,
  pickUnreviewedGames,
  topGamesByGenre,
  buildReviewPost,
  normalizeGameName,
  extractCategoryScores,
  overallScore,
  stripOverallScore,
  emptyDays,
};
