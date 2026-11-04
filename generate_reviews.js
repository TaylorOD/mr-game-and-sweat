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
	pickUnreviewedGames,
	topGamesByGenre,
	buildReviewPost,
	copiesVoiceLine,
} = require('./lib/review_utils');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// The voice doc lives in a private repo. The workflows check it out to .voice
const VOICE_DIR = process.env.VOICE_DIR || path.join(__dirname, '.voice');
const STEAMSPY_API_URL = 'https://steamspy.com/api.php';
// We review anything in the top of any Steam genre
const GENRES = [
	'Action',
	'Adventure',
	'Casual',
	'Early Access',
	'Free to Play',
	'Indie',
	'Massively Multiplayer',
	'Racing',
	'RPG',
	'Simulation',
	'Sports',
	'Strategy',
];
const TOP_PER_GENRE = 100;
const STEAM_STORE_API_URL = 'https://store.steampowered.com/api/appdetails';
const POSTS_DIR = path.join(__dirname, '_posts');

// The days reviews stopped publishing
const BACKFILL_START = '2025-11-04';
const BACKFILL_END = '2026-11-03';
const BACKFILL_COUNT = Number(process.env.BACKFILL_COUNT) || 0;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function fetchGameList(params) {
	const response = await axios.get(STEAMSPY_API_URL, { params });
	return Object.values(response.data);
}

async function fetchTopGames() {
	const genreLists = [];
	for (const genre of GENRES) {
		try {
			genreLists.push(await fetchGameList({ request: 'genre', genre }));
		} catch (error) {
			// One genre being down shouldnt stop the run
			logSafeError(`Error fetching the ${genre} list`, error);
		}
		await wait(2000);
	}
	const topOfGenres = topGamesByGenre(genreLists, TOP_PER_GENRE);
	console.log(`${topOfGenres.length} games in the top ${TOP_PER_GENRE} of a genre`);

	// Once those are all reviewed we keep going with the most owned games overall
	let others = [];
	try {
		others = (await fetchGameList({ request: 'all' })).sort(
			(a, b) => b.positive - a.positive
		);
	} catch (error) {
		logSafeError('Error fetching the full game list', error);
	}
	const games = [...topOfGenres, ...others];
	if (games.length === 0) throw new Error('Could not get any game lists');
	return games;
}

function loadReviewedGames() {
	try {
		const files = fs.readdirSync(POSTS_DIR);
		const contents = files.map((file) =>
			fs.readFileSync(path.join(POSTS_DIR, file), 'utf-8')
		);
		const names = new Set();
		const appids = new Set();
		for (const content of contents) {
			const title = content.match(/^title:\s*"?(?:.*Reviews:\s*)?(.*?)"?\s*$/m);
			if (title) names.add(normalizeGameName(title[1]));
			const appid = content.match(/^steam_appid:\s*(\d+)/m);
			if (appid) appids.add(Number(appid[1]));
		}
		return { names, appids };
	} catch (error) {
		logSafeError('Error checking if game has been reviewed', error);
		throw error;
	}
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
	// Games that arent on Steam bring their own facts
	if (!game.appid) {
		return {
			text: game.facts,
			genres: game.genres || [],
			image: game.image,
		};
	}
	try {
		const response = await axios.get(STEAM_STORE_API_URL, {
			params: { appids: game.appid, l: 'english' },
		});
		const details = response.data[game.appid];
		if (!details || !details.success) return null;
		const { data } = details;
		const text = [
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
		return {
			text,
			controller: data.controller_support,
			genres: (data.genres || []).map((genre) => genre.description),
			image: data.header_image ? data.header_image.split('?')[0] : null,
		};
	} catch (error) {
		logSafeError('Error fetching Steam details', error);
		return null;
	}
}

const WORKOUT_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['pause_friendly', 'session_length'],
	properties: {
		pause_friendly: { type: 'string', enum: ['Yes', 'Sometimes', 'No'] },
		session_length: { type: 'string', enum: ['Short', 'Medium', 'Long'] },
	},
};

// Extra details for the score box. Reviews still work without them.
async function fetchWorkoutDetails(game, review) {
	try {
		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-6-luna',
				messages: [
					{
						role: 'user',
						content: `Answer about the video game "${game.name}" for people who play while exercising.
pause_friendly: can you pause or stop any time mid workout? Yes for single player games you can pause anywhere. Sometimes if some parts cant be paused. No for online multiplayer you cant pause.
session_length: how long a typical sitting or match lasts. Short is under 30 minutes, Medium is 30 to 60 minutes, Long is over 60 minutes.

Review:
${review}`,
					},
				],
				response_format: {
					type: 'json_schema',
					json_schema: { name: 'workout', strict: true, schema: WORKOUT_SCHEMA },
				},
				max_completion_tokens: 3000,
			},
			{
				headers: {
					Authorization: `Bearer ${OPENAI_API_KEY}`,
					'Content-Type': 'application/json',
				},
			}
		);
		return JSON.parse(response.data.choices[0].message.content);
	} catch (error) {
		logSafeError('Error fetching workout details', error);
		return null;
	}
}

async function generateReviewContent(game, reviewDate, addedDate, options = {}) {
	const voice = fs.readFileSync(path.join(VOICE_DIR, 'voice.md'), 'utf8');
	const reviewRules = fs.readFileSync(path.join(__dirname, 'lib', 'review_voice.md'), 'utf8');
	const steam = await fetchSteamFacts(game);
	const steamFacts = steam && steam.text;
	const prompt = `Write a game review for the game "${game.name}". This review is for a site that focuses on helping users exercise, by running on a treadmill or biking, while playing video games. 
  
  ${steamFacts ? `\n  Facts from the store page. Use them, and dont contradict them:\n${steamFacts}\n\n  Steam leaves controller support blank for plenty of games that work fine with a controller. If it isnt listed above, dont say Steam lists no controller support. Only say a game has no controller support if you know that for sure.\n` : ''}
  ${options.desk ? `This review is for our Great Games, Bad Workouts series. This is a great game that you should not play while exercising, because of things like needing a mouse and keyboard, careful thinking or a lot of reading. Be honest about what makes it great, then be clear about why that works against a workout. The Treadmill and Bike Compatibility score must be 0 or 1. Scores are about workouts, not how good the game is, so low scores are fine. End the conclusion by telling people to play it at their desk.\n\n  ` : ''}Start with one or two sentences with the first thing you would say to a friend about doing a workout with this game. Say something specific to this game. The first word cannot be the name of the game. Do not add a title or a greeting.

  Scores are whole numbers. Plenty of games should get a 2 or higher. A 3 means I enjoyed it and would tell you to play it, not that its perfect, and a perfect 3 in every category should be somewhat rare. A 1 means there is a real problem you would warn a friend about. Pick the score the rubric below gives you.

  Gameplay: 3 means a great game that keeps you busy most of the time, and the slow parts are short or easy to skip. A great action or racing game with little story usually gets this. 2 means a good game with some slow parts, a lot of menus, a lot to learn or stretches where you need to stop and think. 1 means long cut scenes, a lot of reading or a lot of waiting get in the way. 0 means mostly menus, story or sitting still.

  Treadmill and Bike Compatibility: 3 means full controller support and it stays fun with loose, imprecise inputs. Games you can play with simple controls, or that wait for you, should get this, and we want to see it. 2 means it works with a controller but some sections need focus, timing, fast reactions or aiming. 1 means no controller support, or the game punishes you hard for any mistake you make while moving, like competitive multiplayer you cant pause. 0 means you basically cant play it while moving.

  Computer Requirements: use the minimum requirements. 3 means it runs on integrated graphics or a very old graphics card. 2 means a normal mid range graphics card from the last several years is enough. 1 means it needs a recent, strong graphics card. 0 means only a high end gaming PC will do.

  Always include these sections in your review, using these exact headings:

  ## Gameplay

  {Say what you think of this game and why. Assume the reader can look up what it is, so only bring up a mechanic to say how you feel about it. Does it distract you from running? Great. Are there a lot of slow sections or long cut scenes? That is bad.}

  ### Category Score: {insert a 0-3 score here} out of 3

  ## Treadmill and Bike Compatibility

  {Say what would actually happen if you played this on a treadmill or bike, what you'd change and what you'd skip. Does it have controller compatibility? That is good. Does it require a lot of quick movements or twitch gameplay? That is bad.}

  ### Category Score: {insert a 0-3 score here} out of 3

  ## Computer Requirements

  {Say in two or three sentences if a normal computer can run it and the one thing to check. Do not list the specs.}

  ### Category Score: {insert a 0-3 score here} out of 3

  ## Conclusion and Score

  {Insert conclusion here. Do not write an overall score, we add that ourselves. Do not start it with "I", "If" or the name of the game. Start with your honest bottom line, in words you haven't already used. Do not start it with "People who", "Honestly", "I'd tell you" or "I'd recommend".}

  Before you finish, check these. Never say a score in your own sentences, the score lines handle that. Paragraphs should look different from each other. Some are long, some are two sentences, and once or twice a paragraph is one short line. A long sentence followed by a short flat one is a move to use two or three times in the whole review, not at the end of every paragraph. Hedge like a person, with "I think", "I feel like", "probably" or "I don't know" spread through the review, and don't use the same one twice in a row. Aim for a small joke in about every other paragraph, and let the rest just be you talking. Say "I don't know" at least twice as part of a real thought, and "I like that" at most once. Work in, naturally, something you're not great at and something you just flat out like. Don't announce either one. Every paragraph should have an actual opinion a person could disagree with.

  Keep the exact heading lines. Every one of the three score lines must be written exactly like "### Category Score: 2 out of 3" and on its own line. Don't start more than two sentences in a row with "I".
  `;

	try {
		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-6-luna',
				messages: [
					{
						role: 'system',
						content: `${voice}\n\n${reviewRules}`,
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
		if (copiesVoiceLine(body, voice)) {
			throw new Error(`${game.name} copied a line from the voice doc`);
		}
		const scores = extractCategoryScores(body);
		if (scores.length !== 3) {
			throw new Error('Review did not have three category scores');
		}
		if (options.desk && scores[1] > 1) {
			throw new Error(`${game.name} scored too high to be a bad workout`);
		}

		const workout = await fetchWorkoutDetails(game, body);
		return buildReviewPost({
			game,
			steam,
			workout,
			body,
			scores,
			reviewDate,
			addedDate,
			desk: options.desk,
		});
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
			loadReviewedGames(),
			BACKFILL_COUNT ? days.length : 3
		); // Filter and get top unreviewed games

		let failures = 0;
		for (let i = 0; i < topGames.length; i++) {
			const game = topGames[i];
			const reviewDate = BACKFILL_COUNT
				? new Date(`${days[i]}T00:12:00Z`)
				: new Date();
			try {
				const reviewContent = await generateReviewContent(
					game,
					reviewDate,
					BACKFILL_COUNT ? today : null
				);
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

if (require.main === module) {
	main().catch((error) => {
		logSafeError('Unhandled error', error);
		process.exit(1); // Exit with a non-zero status code to indicate failure
	});
}

module.exports = { generateReviewContent, loadReviewedGames, slugify };
