const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logSafeError = require('./lib/safe_error_log');
const {
	normalizeGameName,
	extractCategoryScores,
	overallScore,
	stripOverallScore,
	emptyDays,
} = require('./lib/review_utils');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;
const STEAM_API_URL = 'https://steamspy.com/api.php?request=all';
const STEAM_STORE_API_URL = 'https://store.steampowered.com/api/appdetails';
const POSTS_DIR = path.join(__dirname, '_posts');

// The days reviews stopped publishing
const BACKFILL_START = '2025-11-04';
const BACKFILL_END = '2026-11-03';
const BACKFILL_COUNT = Number(process.env.BACKFILL_COUNT) || 0;

async function getAccessToken() {
	try {
		const response = await axios.post(
			'https://id.twitch.tv/oauth2/token',
			null,
			{
				params: {
					client_id: IGDB_CLIENT_ID,
					client_secret: IGDB_CLIENT_SECRET,
					grant_type: 'client_credentials',
				},
			}
		);
		return response.data.access_token;
	} catch (error) {
		logSafeError('Error getting access token', error);
		throw error;
	}
}

async function fetchTopGames() {
	try {
		const response = await axios.get(STEAM_API_URL);
		const games = response.data;
		// Convert the games object to an array and sort by positive reviews
		const sortedGames = Object.values(games).sort(
			(a, b) => b.positive - a.positive
		);
		return sortedGames;
	} catch (error) {
		logSafeError('Error fetching top games', error);
		throw error;
	}
}

function loadReviewedGames() {
	try {
		const files = fs.readdirSync(POSTS_DIR);
		const contents = files.map((file) =>
			fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8')
		);
		const names = new Set();
		for (const content of contents) {
			const title = content.match(/^title:\s*"?(?:.*Reviews:\s*)?(.*?)"?\s*$/m);
			if (title) names.add(normalizeGameName(title[1]));
		}
		return { allContent: contents.join('\n'), names };
	} catch (error) {
		logSafeError('Error checking if game has been reviewed', error);
		throw error;
	}
}

function hasBeenReviewed(gameName, reviewed) {
	return (
		reviewed.allContent.includes(gameName) ||
		reviewed.names.has(normalizeGameName(gameName))
	);
}

function pickUnreviewedGames(sortedGames, count) {
	const reviewed = loadReviewedGames();
	const picked = [];
	for (const game of sortedGames) {
		if (picked.length === count) break;
		if (hasBeenReviewed(game.name, reviewed)) continue;
		// Also stops two editions of one game landing in the same batch
		reviewed.names.add(normalizeGameName(game.name));
		picked.push(game);
	}
	return picked;
}

function missedDays() {
	const taken = new Set(
		fs.readdirSync(POSTS_DIR).map((file) => file.slice(0, 10))
	);
	const yesterday = new Date();
	yesterday.setUTCDate(yesterday.getUTCDate() - 1);
	const lastDay = yesterday.toISOString().split('T')[0];
	return emptyDays(
		BACKFILL_START,
		lastDay < BACKFILL_END ? lastDay : BACKFILL_END,
		taken
	);
}

function stripHtml(text) {
	return text
		.replace(/<[^>]*>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

// Real store facts so the review isnt guessing. Reviews still work without it.
async function fetchSteamFacts(game) {
	try {
		const response = await axios.get(STEAM_STORE_API_URL, {
			params: { appids: game.appid, l: 'english' },
		});
		const details = response.data[game.appid];
		if (!details || !details.success) return null;
		const { data } = details;
		return [
			data.controller_support &&
				`Controller support: ${data.controller_support}`,
			data.genres &&
				`Genres: ${data.genres.map((genre) => genre.description).join(', ')}`,
			data.short_description &&
				`Description: ${stripHtml(data.short_description)}`,
			data.pc_requirements &&
				data.pc_requirements.minimum &&
				`Minimum PC requirements: ${stripHtml(data.pc_requirements.minimum)}`,
		]
			.filter(Boolean)
			.join('\n');
	} catch (error) {
		logSafeError('Error fetching Steam details', error);
		return null;
	}
}

async function fetchImage(gameName) {
	return null; // Disable fetching images for now
	// try {
	// 	const accessToken = await getAccessToken();
	// 	const response = await axios.post(
	// 		'https://api.igdb.com/v4/games',
	// 		`fields cover.url; search "${gameName}";`,
	// 		{
	// 			headers: {
	// 				'Client-ID': IGDB_CLIENT_ID,
	// 				Authorization: `Bearer ${accessToken}`,
	// 				Accept: 'application/json',
	// 			},
	// 		}
	// 	);

	// 	if (response.data.length > 0 && response.data[0].cover) {
	// 		let imageUrl = response.data[0].cover.url.replace(
	// 			't_thumb',
	// 			't_cover_big'
	// 		); // Use a larger image size
	// 		if (imageUrl.startsWith('//')) {
	// 			imageUrl = 'https:' + imageUrl;
	// 		}
	// 		return imageUrl;
	// 	} else {
	// 		console.warn(`No image found for game: ${gameName}`);
	// 		return null; // No image found
	// 	}
	// } catch (error) {
	// 	console.error('Error fetching image:', error);
	// 	return null; // Return null if an error occurs
	// }
}

async function generateReviewContent(game, imageUrl, reviewDate, addedDate) {
	const steamFacts = await fetchSteamFacts(game);
	const prompt = `Write a game review for the game "${game.name}". This review is for a site that focuses on helping users exercise, by running on a treadmill or biking, while playing video games. 
  
  ${steamFacts ? `\n  Facts from the Steam store page. Use them, and dont contradict them:\n${steamFacts}\n\n  Steam leaves controller support blank for plenty of games that work fine with a controller. If it isnt listed above, dont say Steam lists no controller support. Only say a game has no controller support if you know that for sure.\n` : ''}
  Start with one or two sentences about what makes this game good or bad for a workout. Say something specific to this game. Do not add a title or a greeting.

  Scores are whole numbers. Be a tough critic and use the whole scale. Most games should score 1 or 2 in a category. A 3 is rare. Do not give 2 by default, pick the score the rubric below gives you.

  Gameplay: 3 means constant action with almost no cut scenes or waiting. 2 means engaging with some slow parts. 1 means long cut scenes, a lot of reading or a lot of waiting. 0 means mostly menus, story or sitting still.

  Treadmill and Bike Compatibility: 3 means full controller support and it stays fun with loose, imprecise inputs. 2 means full controller support but some sections need focus or timing. 1 means no controller support, fast reactions, precise aiming, stealth, horror chases, or competitive multiplayer you cant pause. 0 means you basically cant play it while moving.

  Computer Requirements: use the minimum requirements. 3 means it runs on integrated graphics. 2 means an old or basic dedicated graphics card is enough. 1 means a mid range graphics card or better. 0 means a high end gaming PC.

  Always include these sections in your review, using these exact headings:

  # Gameplay

  {Insert details about the gameplay. Is it engaging? Does it distract you from running? Great. Are there a lot of slow sections or long cut scenes? That is bad.}

  ### Category Score: {insert a 0-3 score here} out of 3

  # Treadmill and Bike Compatibility

  {Insert details about how well the game works with a treadmill or bike. Does it have controller compatibility? That is good. Does it require a lot of quick movements or twitch gameplay? That is bad.}

  ### Category Score: {insert a 0-3 score here} out of 3

  # Computer Requirements

  {Insert details about how demanding the game is on a computer}

  ### Category Score: {insert a 0-3 score here} out of 3

  # Conclusion and Score

  {Insert conclusion here. Do not write an overall score, we add that ourselves.}
  `;

	try {
		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-6-luna',
				messages: [
					{
						role: 'system',
						content:
							'You write game reviews for Mr. Game and Sweat, a site about playing video games while running on a treadmill or riding a bike. Our tagline is "Get fit while gaming! Take that mom and dad!"\n\nWrite like a gamer telling a friend what they think. Short, casual and plain. Short sentences. Give a real opinion and say it straight. A little dry humor is good when it fits, but dont force jokes. Talk to the reader as "you".\n\nNever use em dashes or semicolons, and dont use hyphens unless they are part of a game name. Reword instead. No marketing words like immersive, captivating, thrilling, stunning or stands out. No "whether you\'re" and no "its not just X, its Y".\n\nDont make up personal stories or claim you played it on a certain day or ran a certain distance. Keep each section to 2 to 4 sentences.',
					},
					{ role: 'user', content: prompt },
				],
				max_completion_tokens: 16000, // Reasoning counts toward this too
			},
			{
				headers: {
					Authorization: `Bearer ${OPENAI_API_KEY}`,
					'Content-Type': 'application/json',
				},
			}
		);

		const choice = response.data.choices[0];
		if (choice.finish_reason !== 'stop') {
			throw new Error('Review did not finish');
		}

		const body = stripOverallScore(choice.message.content);
		const scores = extractCategoryScores(body);
		if (scores.length !== 3) {
			throw new Error('Review did not have three category scores');
		}

		return `---
layout: post
title:  ${JSON.stringify(`Mr. Game and Sweat Reviews: ${game.name}`)}
author: taylor
comments: false
disqus: false
date:   ${reviewDate.toISOString()}
categories: [ review, game ]
image: ${imageUrl}
${addedDate ? `added: ${addedDate}\nlast_modified_at: ${addedDate}\n` : ''}---

${body}

### Overall Score: ${overallScore(scores)} out of 3

---

Mr. Game and Sweat Reviews: ${game.name} - By Taylor Dorsett
`;
	} catch (error) {
		logSafeError('Error generating review content', error);
		throw error;
	}
}

function slugify(text) {
	return text
		.toString()
		.toLowerCase()
		.replace(/\s+/g, '-') // Replace spaces with -
		.replace(/[^\w\-]+/g, '') // Remove all non-word chars
		.replace(/\-\-+/g, '-') // Replace multiple - with single -
		.replace(/^-+/, '') // Trim - from start of text
		.replace(/-+$/, ''); // Trim - from end of text
}

async function main() {
	try {
		const today = new Date().toISOString().split('T')[0];
		const days = BACKFILL_COUNT ? missedDays().slice(0, BACKFILL_COUNT) : [];
		if (BACKFILL_COUNT && days.length === 0) {
			console.log('Backfill is finished');
			return;
		}

		const sortedGames = await fetchTopGames();
		const topGames = pickUnreviewedGames(
			sortedGames,
			BACKFILL_COUNT ? days.length : 3
		); // Filter and get top unreviewed games

		let failures = 0;
		for (let i = 0; i < topGames.length; i++) {
			const game = topGames[i];
			// const imageUrl = await fetchImage(game.name);
			let reviewDate = new Date();
			reviewDate.setDate(reviewDate.getDate() + i);
			if (BACKFILL_COUNT) reviewDate = new Date(`${days[i]}T00:12:00Z`);
			try {
				const reviewContent = await generateReviewContent(
					game,
					null, // disable image fetching for now,
					reviewDate,
					BACKFILL_COUNT ? today : null
				); // Pass imageUrl and reviewDate
				const filename = `_posts/${
					reviewDate.toISOString().split('T')[0]
				}-review-${slugify(game.name)}.md`;
				fs.writeFileSync(filename, reviewContent);
				console.log(`Review for ${game.name} generated and saved as ${filename}`);
			} catch (error) {
				// One bad review shouldnt throw away the rest of the batch
				failures++;
				logSafeError('Error writing a review', error);
			}
		}
		if (failures === topGames.length) process.exit(1);
	} catch (error) {
		logSafeError('Error in main function', error);
		process.exit(1); // Exit with a non-zero status code to indicate failure
	}
}

main().catch((error) => {
	logSafeError('Unhandled error', error);
	process.exit(1); // Exit with a non-zero status code to indicate failure
});
