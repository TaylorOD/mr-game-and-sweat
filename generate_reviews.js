const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const IGDB_CLIENT_ID = process.env.IGDB_CLIENT_ID;
const IGDB_CLIENT_SECRET = process.env.IGDB_CLIENT_SECRET;
const STEAM_API_URL = 'https://steamspy.com/api.php?request=all';

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
		console.error('Error getting access token:', error);
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
		console.error('Error fetching top games:', error);
		throw error;
	}
}

function hasBeenReviewed(gameName) {
	try {
		const postsDir = path.join(__dirname, '_posts');
		const files = fs.readdirSync(postsDir);
		return files.some((file) => {
			const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
			return content.includes(gameName);
		});
	} catch (error) {
		console.error('Error checking if game has been reviewed:', error);
		throw error;
	}
}

async function fetchImage(gameName) {
	try {
		const accessToken = await getAccessToken();
		const response = await axios.post(
			'https://api.igdb.com/v4/games',
			`fields cover.url; search "${gameName}";`,
			{
				headers: {
					'Client-ID': IGDB_CLIENT_ID,
					Authorization: `Bearer ${accessToken}`,
					Accept: 'application/json',
				},
			}
		);

		if (response.data.length > 0 && response.data[0].cover) {
			let imageUrl = response.data[0].cover.url.replace(
				't_thumb',
				't_cover_big'
			); // Use a larger image size
			if (imageUrl.startsWith('//')) {
				imageUrl = 'https:' + imageUrl;
			}
			return imageUrl;
		} else {
			console.warn(`No image found for game: ${gameName}`);
			return null; // No image found
		}
	} catch (error) {
		console.error('Error fetching image:', error);
		return null; // Return null if an error occurs
	}
}

async function generateReviewContent(game, imageUrl, reviewDate) {
	const prompt = `Write a game review for the game "${game.name}". This review is for a site that focuses on helping users exercise, by running on a treadmill or biking, while playing video games. 
  
  Always include these sections in your review:

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

  {Insert conclusion here}

  ### Overall Score: {insert average of three scores here} out of 3
  `;

	try {
		const response = await axios.post(
			'https://api.openai.com/v1/chat/completions',
			{
				model: 'gpt-4o-mini',
				messages: [
					{
						role: 'system',
						content:
							'You are a great writer who has played many many video games and loves exercising',
					},
					{ role: 'user', content: prompt },
				],
				max_tokens: 1250,
			},
			{
				headers: {
					Authorization: `Bearer ${OPENAI_API_KEY}`,
					'Content-Type': 'application/json',
				},
			}
		);

		return `---
layout: post
title:  "Mr. Game and Sweat Reviews: ${game.name}"
author: taylor
comments: false
disqus: false
date:   ${reviewDate.toISOString()}
categories: [ review, game ]
image: ${imageUrl || 'default-image-url'}
---

Welcome back to Mr. Game and Sweat! Today, we’re tackling "${
			game.name
		},". Let's break it down according to our key criteria: gameplay engagement, treadmill and bike compatibility, and computer requirements.

# Gameplay

${response.data.choices[0].message.content}

---

Mr. Game and Sweat Reviews: ${game.name} - By Taylor Dorsett
`;
	} catch (error) {
		console.error('Error generating review content:', error);
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
		const sortedGames = await fetchTopGames();
		const topGames = sortedGames
			.filter((game) => !hasBeenReviewed(game.name))
			.slice(0, 3); // Filter and get top 3 unreviewed games

		for (let i = 0; i < topGames.length; i++) {
			const game = topGames[i];
			const imageUrl = await fetchImage(game.name);
			const reviewDate = new Date();
			reviewDate.setDate(reviewDate.getDate() + i);
			const reviewContent = await generateReviewContent(
				game,
				imageUrl,
				reviewDate
			); // Pass imageUrl and reviewDate
			const filename = `_posts/${
				reviewDate.toISOString().split('T')[0]
			}-review-${slugify(game.name)}.md`;
			fs.writeFileSync(filename, reviewContent);
			console.log(`Review for ${game.name} generated and saved as ${filename}`);
		}
	} catch (error) {
		console.error('Error in main function:', error);
		process.exit(1); // Exit with a non-zero status code to indicate failure
	}
}

main().catch((error) => {
	console.error('Unhandled error:', error);
	process.exit(1); // Exit with a non-zero status code to indicate failure
});
