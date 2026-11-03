const axios = require('axios');
const fs = require('fs');
const path = require('path');
const logSafeError = require('../lib/safe_error_log');
const { splitReview, joinReview, needsRewrite } = require('../lib/review_utils');

// Rewrites old reviews in our current voice. Scores, headings and dates stay the same. See docs/reviews.md.
const LIMIT = Number(process.env.LIMIT) || Infinity;
const WORKERS = 4;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const SCHEMA = {
	type: 'object',
	additionalProperties: false,
	required: ['excerpt', 'sections'],
	properties: {
		excerpt: { type: 'string' },
		sections: { type: 'array', items: { type: 'string' } },
	},
};
const VOICE =
	'You edit game reviews for Mr. Game and Sweat, a site about playing video games while running on a treadmill or riding a bike.\n\nWrite like a gamer telling a friend what they think. Short, casual and plain. Short sentences. Give a real opinion and say it straight. A little dry humor is good when it fits, but dont force jokes. Talk to the reader as "you".\n\nNever use em dashes or semicolons, and dont use hyphens unless they are part of a game name. Reword instead. No marketing words like immersive, captivating, thrilling, stunning or stands out. No "whether you\'re" and no "its not just X, its Y".\n\nDont make up personal stories or claim you played it on a certain day or ran a certain distance.';

function field(text, name) {
	const match = text.match(new RegExp(`^${name}:\\s*"?(.*?)"?\\s*$`, 'm'));
	return match ? match[1] : '';
}

function problemWith(result, sections) {
	if (result.sections.length !== sections.length) return 'wrong number of sections';
	const all = [result.excerpt, ...result.sections];
	if (all.some((text) => !text.trim())) return 'empty text';
	if (all.some((text) => /[—–;]/.test(text))) return 'banned punctuation';
	if (all.some((text) => /^#/m.test(text))) return 'added a heading';
	const links = (text) => (text.match(/\]\(/g) || []).length;
	if (result.sections.some((text, index) => links(text) !== links(sections[index].text))) return 'changed a link';
	return null;
}

async function rewriteOnce(front, sections) {
	const response = await axios.post(
		'https://api.openai.com/v1/chat/completions',
		{
			model: 'gpt-6-luna',
			messages: [
				{ role: 'system', content: VOICE },
				{
					role: 'user',
					content: `Rewrite this review of "${field(front, 'title')}" in the voice above.

Keep the same opinions and only use facts already in the review. Dont add new facts, numbers or stories. Cut anything that sounds like marketing or makes no sense for someone holding a controller while running or riding. Each section should be 2 to 4 sentences. Keep any Markdown links exactly as they are.

Our scores out of 3, which your words must agree with: gameplay ${field(front, 'score_gameplay')}, treadmill and bike ${field(front, 'score_treadmill')}, computer requirements ${field(front, 'score_computer')}, overall ${field(front, 'score_overall')}.

Return an excerpt of one or two sentences about what makes this game good or bad for a workout, plus exactly ${sections.length} rewritten sections in the same order. Dont include headings, scores or a title.

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
		lastProblem = problemWith(result, sections);
		if (lastProblem) continue;
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
