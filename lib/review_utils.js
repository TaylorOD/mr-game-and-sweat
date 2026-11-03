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

module.exports = {
  normalizeGameName,
  extractCategoryScores,
  overallScore,
  stripOverallScore,
  emptyDays,
};
