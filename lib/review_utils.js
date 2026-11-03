'use strict';

const EDITION_SUFFIX =
  /\s*(?:\d{4}\s+edition|(?:\d+(?:st|nd|rd|th)\s+anniversary|definitive|enhanced|remastered|redux|complete|ultimate|deluxe|gold|classic|game of the year|goty|directors cut)(?:\s+edition)?|edition)$/;

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

function hasBeenReviewed(gameName, reviewed) {
  return (
    reviewed.allContent.includes(gameName) ||
    reviewed.names.has(normalizeGameName(gameName))
  );
}

function pickUnreviewedGames(sortedGames, reviewed, count) {
  const names = new Set(reviewed.names);
  const picked = [];
  for (const game of sortedGames) {
    if (picked.length === count) break;
    if (hasBeenReviewed(game.name, { allContent: reviewed.allContent, names })) continue;
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

function buildReviewPost({ game, steam, workout, body, scores, reviewDate, addedDate }) {
  const overall = overallScore(scores);
  const details = [
    `score_gameplay: ${scores[0]}`,
    `score_treadmill: ${scores[1]}`,
    `score_computer: ${scores[2]}`,
    `score_overall: ${overall}`,
    game.appid && `steam_appid: ${game.appid}`,
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
categories: [ review, game ]
image: ${(steam && steam.image) || null}
${addedDate ? `added: ${addedDate}\nlast_modified_at: ${addedDate}\n` : ''}${details}
---

${fixInlineScores(fixHeadingLevels(body))}

### Overall Score: ${overall} out of 3

---

Mr. Game and Sweat Reviews: ${game.name} - By Taylor Owen Dorsett
`;
}

module.exports = {
  fixInlineScores,
  pickUnreviewedGames,
  buildReviewPost,
  normalizeGameName,
  extractCategoryScores,
  overallScore,
  stripOverallScore,
  emptyDays,
};
