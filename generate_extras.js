const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logSafeError = require('./lib/safe_error_log');
const {
	pickUnreviewedGames,
	nextGuideTopics,
	buildGuidePost,
} = require('./lib/review_utils');
const {
	generateReviewContent,
	loadReviewedGames,
	slugify,
} = require('./generate_reviews');
const deskGames = require('./_data/desk_games.json');
const guideTopics = require('./_data/guide_topics.json');

// Extra posts on top of the normal reviews. See docs/reviews.md.
const DESK_COUNT = Number(process.env.DESK_COUNT) || 0;
const GUIDE_COUNT = Number(process.env.GUIDE_COUNT) || 0;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_HEADERS = {
	Authorization: `Bearer ${OPENAI_API_KEY}`,
	'Content-Type': 'application/json',
};
const IMAGE_STYLE =
	'Flat editorial illustration in a clean modern vector style. Soft blue (#88c0d5), charcoal and off white palette with a small yellow accent. Simple shapes, friendly and calm, plain background, wide composition. It must look like an illustration, not a photo. Absolutely no text, letters, numbers, logos or brand names anywhere. ';
const GUIDE_SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['excerpt', 'body'],
	properties: {
		excerpt: { type: 'string' },
		body: { type: 'string' },
	},
};

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

async function writeGuideText(topic, existingGuides) {
	const links = existingGuides.map((guide) => `${guide.title}: ${guide.url}`).join('\n');
	const response = await axios.post(
		'https://api.openai.com/v1/chat/completions',
		{
			model: 'gpt-6-luna',
			messages: [
				{
					role: 'system',
					content:
						'You write guides for Mr. Game and Sweat, a site about playing video games while running on a treadmill or riding an exercise bike.\n\nWrite like a gamer telling a friend what works. Short, casual and plain. Short sentences. Talk to the reader as "you". Be practical and specific.\n\nNever use em dashes or semicolons, and dont use hyphens unless they are part of a name. Reword instead. No marketing words like immersive, captivating or stunning. No "whether you\'re" and no "its not just X, its Y".\n\nNever make up personal stories, studies, statistics, prices, product specs or medical claims. Leave out any number you arent sure about. Safety comes first: mention the safety clip and the machine manual where they matter, and tell people to stop if something feels wrong.',
				},
				{
					role: 'user',
					content: `Write a guide called "${topic.title}".

What it should cover: ${topic.brief}

Return an excerpt of one or two sentences and the body in Markdown. The body starts right away with one or two sentences answering the question, with no title and no greeting. Use 3 to 5 sections with ## headings. Keep it under 500 words.

If it really helps, link to these with Markdown links, using these exact paths and no others:
${links}
All reviews: /reviews/
Best games to play: /best-of/`,
				},
			],
			response_format: {
				type: 'json_schema',
				json_schema: { name: 'guide', strict: true, schema: GUIDE_SCHEMA },
			},
			max_completion_tokens: 16000,
		},
		{ headers: OPENAI_HEADERS }
	);
	const choice = response.data.choices[0];
	if (choice.finish_reason !== 'stop') throw new Error('Guide did not finish');
	return JSON.parse(choice.message.content);
}

async function writeGuideImage(topic, file) {
	const response = await axios.post(
		'https://api.openai.com/v1/images/generations',
		{
			model: 'gpt-image-2',
			prompt: IMAGE_STYLE + topic.scene,
			size: '1536x1024',
			quality: 'medium',
			output_format: 'jpeg',
			output_compression: 72,
			n: 1,
		},
		{ headers: OPENAI_HEADERS, timeout: 240000 }
	);
	fs.writeFileSync(file, Buffer.from(response.data.data[0].b64_json, 'base64'));
}

function loadGuides() {
	return fs
		.readdirSync('_posts')
		.map((file) => {
			const text = fs.readFileSync(path.join('_posts', file), 'utf-8');
			const title = text.match(/^title:\s*"?(.*?)"?\s*$/m);
			if (!/^categories:.*\bguide\b/m.test(text) || !title) return null;
			return { title: title[1], url: `/${file.slice(11, -3)}/` };
		})
		.filter(Boolean);
}

async function writeGuides(count) {
	const guides = loadGuides();
	const topics = nextGuideTopics(guideTopics, guides, count);
	if (topics.length < count) {
		console.log(`Only ${topics.length} guide topics left, add more to _data/guide_topics.json`);
	}
	let failures = 0;
	for (const topic of topics) {
		const date = new Date();
		const slug = slugify(topic.title);
		const image = `assets/images/guides/${slug}.jpg`;
		try {
			const { excerpt, body } = await writeGuideText(topic, guides);
			await writeGuideImage(topic, image);
			const file = path.join('_posts', `${date.toISOString().split('T')[0]}-${slug}.md`);
			fs.writeFileSync(file, buildGuidePost({ title: topic.title, excerpt, body, image, date }));
			console.log(`Wrote ${file}`);
		} catch (error) {
			failures++;
			logSafeError(`Error writing the guide ${topic.title}`, error);
		}
	}
	return { wrote: topics.length - failures, failures };
}

async function main() {
	const desk = await writeDeskReviews(DESK_COUNT);
	const guides = await writeGuides(GUIDE_COUNT);
	if (desk.failures + guides.failures > 0 && desk.wrote + guides.wrote === 0) process.exit(1);
}

main().catch((error) => {
	logSafeError('Unhandled error', error);
	process.exit(1);
});
