'use strict';

const assert = require('assert');
const {
  normalizeGameName,
  extractCategoryScores,
  overallScore,
  stripOverallScore,
  emptyDays,
  pickUnreviewedGames,
  buildReviewPost,
  fixInlineScores,
} = require('../lib/review_utils');

// Editions of a game we already reviewed count as the same game
assert.strictEqual(normalizeGameName('Sea of Thieves: 2026 Edition'), 'sea of thieves');
assert.strictEqual(normalizeGameName('Sea of Thieves: 2024 Edition'), 'sea of thieves');
assert.strictEqual(normalizeGameName('Tomb Raider Game of the Year'), 'tomb raider');
assert.strictEqual(normalizeGameName('Northgard: Definitive Edition'), 'northgard');
assert.strictEqual(normalizeGameName('Grand Theft Auto V Legacy'), 'grand theft auto v');
assert.strictEqual(
  normalizeGameName('The Elder Scrolls V: Skyrim Special Edition'),
  'the elder scrolls v skyrim'
);
assert.strictEqual(
  normalizeGameName('The Witcher 3: Wild Hunt — Remastered'),
  'the witcher 3 wild hunt'
);
assert.strictEqual(
  normalizeGameName('Microsoft Flight Simulator (2020) 40th Anniversary Edition'),
  'microsoft flight simulator 2020'
);

// Different games stay different
assert.strictEqual(normalizeGameName('METRO 2033 Redux'), 'metro 2033');
assert.notStrictEqual(
  normalizeGameName('Tomb Raider'),
  normalizeGameName('Rise of the Tomb Raider')
);
assert.strictEqual(normalizeGameName('Ultimate Custom Night'), 'ultimate custom night');

const review = `Intro

### Category Score: 3 out of 3

### Category Score: **1** out of 3

### Category Score: 2 out of 3

### Overall Score: 2.65 out of 3`;

assert.deepStrictEqual(extractCategoryScores(review), [3, 1, 2]);
assert.strictEqual(overallScore([3, 1, 2]), 2);
assert.strictEqual(overallScore([3, 3, 2]), 2.67);
assert.ok(!stripOverallScore(review).includes('Overall Score'));

assert.deepStrictEqual(
  emptyDays('2025-12-30', '2026-01-02', new Set(['2025-12-31'])),
  ['2025-12-30', '2026-01-01', '2026-01-02']
);

// Picks skip reviewed games and duplicate editions
const reviewed = {
  allContent: 'Mr. Game and Sweat Reviews: Hades - By Taylor Dorsett',
  names: new Set(['sea of thieves']),
};
assert.deepStrictEqual(
  pickUnreviewedGames(
    [
      { name: 'Hades' },
      { name: 'Sea of Thieves: 2026 Edition' },
      { name: 'Portal 2' },
      { name: 'Portal 2 Definitive Edition' },
      { name: 'Brotato' },
      { name: 'Balatro' },
    ],
    reviewed,
    2
  ).map((game) => game.name),
  ['Portal 2', 'Brotato']
);
assert.strictEqual(reviewed.names.size, 1, 'Picking should not change what was passed in');

// Post format
const post = buildReviewPost({
  game: { name: 'A "Quoted" Game: Part 2', appid: 123 },
  steam: { controller: 'full', genres: ['Action'], image: 'https://example.com/header.jpg' },
  workout: { pause_friendly: 'Yes', session_length: 'Short' },
  body: 'Opening.\n\n# Gameplay\n\nText',
  scores: [3, 3, 2],
  reviewDate: new Date('2026-01-02T00:12:00Z'),
  addedDate: '2026-11-03',
});
assert.ok(post.startsWith('---\nlayout: post\n'));
assert.ok(post.includes('title:  "A \\"Quoted\\" Game: Part 2"\n'), 'Titles must be safe YAML');
assert.ok(post.includes('date:   2026-01-02T00:12:00.000Z\n'));
assert.ok(post.includes('image: https://example.com/header.jpg\n'));
assert.ok(post.includes('added: 2026-11-03\nlast_modified_at: 2026-11-03\n'));
assert.ok(post.includes('score_overall: 2.67\n'));
assert.ok(post.includes('genres: ["Action"]\n'));
assert.ok(post.includes('pause_friendly: "Yes"\n'), 'Yes and No must be quoted or YAML reads booleans');
assert.ok(post.includes('### Overall Score: 2.67 out of 3\n'));
assert.ok(post.includes('\n## Gameplay\n') && !post.includes('\n# Gameplay\n'), 'Only the title gets a top level heading');

// Normal runs have no added date, and missing details are left out
const plain = buildReviewPost({
  game: { name: 'Plain' },
  steam: null,
  workout: null,
  body: 'Text',
  scores: [1, 1, 1],
  reviewDate: new Date('2026-01-02T00:12:00Z'),
  addedDate: null,
});
assert.ok(!plain.includes('added:'));
assert.ok(!plain.includes('pause_friendly'));
assert.ok(plain.includes('image: null\n'));

// Scores stuck on the end of a paragraph get their own line
assert.strictEqual(
  fixInlineScores('Some text. ### Category Score: 2 out of 3'),
  'Some text.\n\n### Category Score: 2 out of 3'
);
assert.strictEqual(
  fixInlineScores('Some text.\n\n### Category Score: 2 out of 3'),
  'Some text.\n\n### Category Score: 2 out of 3'
);

console.log('review utils checks passed');
