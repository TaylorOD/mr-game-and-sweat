'use strict';

const assert = require('assert');
const {
  normalizeGameName,
  extractCategoryScores,
  overallScore,
  stripOverallScore,
  emptyDays,
} = require('../lib/review_utils');

// Editions of a game we already reviewed count as the same game
assert.strictEqual(normalizeGameName('Sea of Thieves: 2026 Edition'), 'sea of thieves');
assert.strictEqual(normalizeGameName('Sea of Thieves: 2024 Edition'), 'sea of thieves');
assert.strictEqual(normalizeGameName('Tomb Raider Game of the Year'), 'tomb raider');
assert.strictEqual(normalizeGameName('Northgard: Definitive Edition'), 'northgard');
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

console.log('review utils checks passed');
