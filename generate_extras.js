const fs = require('fs');
const path = require('path');
const logSafeError = require('./lib/safe_error_log');
const { pickUnreviewedGames } = require('./lib/review_utils');
const {
	generateReviewContent,
	loadReviewedGames,
	slugify,
} = require('./generate_reviews');
const deskGames = require('./_data/desk_games.json');

// Extra posts on top of the normal reviews. See docs/reviews.md.
const DESK_COUNT = Number(process.env.DESK_COUNT) || 0;

async function writeDeskReviews(count) {
	const games = pickUnreviewedGames(deskGames, loadReviewedGames(), count);
	if (games.length < count) {
		console.log(`Only ${games.length} desk games left, add more to _data/desk_games.json`);
	}
	let failures = 0;
	for (const game of games) {
		const date = new Date();
		try {
			const content = await generateReviewContent(game, date, null, { desk: true });
			const file = path.join(
				'_posts',
				`${date.toISOString().split('T')[0]}-review-${slugify(game.name)}.md`
			);
			fs.writeFileSync(file, content);
			console.log(`Wrote ${file}`);
		} catch (error) {
			failures++;
			logSafeError(`Error writing a review of ${game.name}`, error);
		}
	}
	return { wrote: games.length - failures, failures };
}

async function main() {
	const desk = await writeDeskReviews(DESK_COUNT);
	if (desk.failures > 0 && desk.wrote === 0) process.exit(1);
}

main().catch((error) => {
	logSafeError('Unhandled error', error);
	process.exit(1);
});
