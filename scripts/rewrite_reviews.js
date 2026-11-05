const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logSafeError = require('../lib/safe_error_log');
const { splitReview, joinReview, needsRewrite, rewriteProblem } = require('../lib/review_utils');

// Rewrites old reviews in our current voice. Scores, headings and dates stay the same. See docs/reviews.md.
const LIMIT = Number(process.env.LIMIT) || Infinity;
const WORKERS = 4;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
// The voice doc lives in a private repo. The workflow checks it out to .voice
const VOICE_DIR = process.env.VOICE_DIR || path.join(__dirname, '..', '.voice');
const VOICE = fs.readFileSync(path.join(VOICE_DIR, 'voice.md'), 'utf8');
const REVIEW_RULES = fs.readFileSync(path.join(__dirname, '..', 'lib', 'review_voice.md'), 'utf8');
const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['excerpt', 'sections'],
	properties: {
		excerpt: { type: 'string' },
		sections: { type: 'array', items: { type: 'string' } },
	},
};

function field(text, name) {
	const match = text.match(new RegExp(`^${name}:\\s*"?(.*?)"?\\s*$`, 'm'));
	return match ? match[1] : '';
}

async function rewriteOnce(front, sections) {
	const response = await axios.post(
		'https://api.openai.com/v1/chat/completions',
		{
			model: 'gpt-6-luna',
			messages: [
				{ role: 'system', content: `${VOICE}\n\n${REVIEW_RULES}` },
				{
					role: 'user',
					content: `Rewrite this review of "${field(front, 'title')}" in the voice above.

Keep the same opinions and the facts already in the review. You can add your own opinions and what you'd expect to happen, and anything about the game you know for sure, but no numbers or stories. Cut anything that sounds like marketing or makes no sense for someone holding a controller while running or riding. Never make a review shorter than it was. The whole review should be about 750 to 900 words, with several paragraphs in Gameplay and in Treadmill and Bike Compatibility, and a short Computer Requirements and Conclusion. Keep any Markdown links exactly as they are.

Our scores out of 3, which your words must agree with: gameplay ${field(front, 'score_gameplay')}, treadmill and bike ${field(front, 'score_treadmill')}, computer requirements ${field(front, 'score_computer')}, overall ${field(front, 'score_overall')}.

Paragraphs should look different from each other, some long, some two sentences and once or twice one short line. Hedge like a person and don't use the same hedge twice in a row. Every paragraph should have an actual opinion a person could disagree with. Never say a score in your own sentences. Write it as your own review, and never mention an original review or that this is a rewrite.

Return an excerpt of one or two sentences with the first thing you would say to a friend about doing a workout with this game, plus exactly ${sections.length} rewritten sections in the same order. Dont include headings, scores or a title.

${JSON.stringify(sections.map(({ heading, text }) => ({ heading, text })))}`,
				},
			],
			response_format: {
				type: 'json_schema',
				json_schema: { name: 'rewrite', strict: true, schema: SCHEMA },
			},
			max_completion_tokens: 16000,
		},
		{
			headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, 'Content-Type': 'application/json' },
			timeout: 240000,
		}
	);
	const choice = response.data.choices[0];
	if (choice.finish_reason !== 'stop') throw new Error('Rewrite did not finish');
	return JSON.parse(choice.message.content);
}

async function rewriteFile(file, today) {
	const full = path.join('_posts', file);
	const parts = splitReview(fs.readFileSync(full, 'utf8'));
	const sections = parts.body.filter((piece) => piece.text !== undefined);
	let lastProblem;
	for (let attempt = 0; attempt < 3; attempt++) {
		const result = await rewriteOnce(parts.front, sections);
		lastProblem = rewriteProblem(result, sections, VOICE);
		if (lastProblem) {
			console.log(`${file} try ${attempt + 1}: ${lastProblem}`);
			continue;
		}
		sections.forEach((section, index) => {
			section.text = result.sections[index].trim();
		});
		parts.front = parts.front.replace(/^excerpt:.*$/m, () => `excerpt: ${JSON.stringify(result.excerpt.trim())}`);
		parts.front = `${parts.front.trimEnd()}\nlast_modified_at: ${today}\n`;
		fs.writeFileSync(full, joinReview(parts));
		return;
	}
	throw new Error(lastProblem);
}

async function main() {
	const today = new Date().toISOString().split('T')[0];
	const files = fs
		.readdirSync('_posts')
		.filter((file) => needsRewrite(file, fs.readFileSync(path.join('_posts', file), 'utf8')))
		.slice(0, LIMIT);
	console.log(`Rewriting ${files.length} reviews`);
	let wrote = 0;
	let failed = 0;
	const worker = async () => {
		while (files.length) {
			const file = files.shift();
			try {
				await rewriteFile(file, today);
				wrote++;
			} catch (error) {
				failed++;
				logSafeError(`Error rewriting ${file}`, error);
			}
		}
	};
	await Promise.all(Array.from({ length: WORKERS }, worker));
	console.log(`Rewrote ${wrote}, ${failed} failed`);
	if (failed > 0 && wrote === 0) process.exit(1);
}

main().catch((error) => {
	logSafeError('Unhandled error', error);
	process.exit(1);
});
