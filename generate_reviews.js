const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const UNSPLASH_ACCESS_KEY = process.env.UNSPLASH_ACCESS_KEY;
const STEAM_API_URL = 'https://steamspy.com/api.php?request=all';

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
		const response = await axios.get('https://api.unsplash.com/search/photos', {
			params: { query: gameName, per_page: 1 },
			headers: {
				Authorization: `Client-ID ${UNSPLASH_ACCESS_KEY}`,
			},
		});
		return response.data.results[0].urls.small;
	} catch (error) {
		console.error('Error fetching image:', error);
		throw error;
	}
}

async function generateReviewContent(game, imageUrl) {
	const prompt = `Write a game review for the game "${game.name}". This review is for a site that focuses on helping users exercise, by running on a treadmill or biking, while playing video games. 
  
  Always include these sections in your review:

  Welcome back to Mr. Game and Sweat! Today, we’re tackling "${game.name},". Let's break it down according to our key criteria: gameplay engagement, treadmill and bike compatibility, and computer requirements.

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
			'https://api.openai.com/v1/completions',
			{
				prompt: prompt,
				max_tokens: 500,
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
date:   ${new Date().toISOString()}
categories: [ review, game ]
image: ${imageUrl}
---

Welcome back to Mr. Game and Sweat! Today, we’re tackling "${
			game.name
		},". Let's break it down according to our key criteria: gameplay engagement, treadmill and bike compatibility, and computer requirements.

# Gameplay

${response.data.choices[0].text}

# Treadmill and Bike Compatibility

Playing "${
			game.name
		}" while on a treadmill or bike presents some challenges. The game's need for constant attention and quick reflexes can make it hard to balance with physical activity. The intense action sequences require a high level of focus, which can be difficult to maintain while exercising. Despite this, the game's structure allows for short, intense sessions, which can be beneficial for high-intensity interval training. 

### Category Score: 2 out of 3

# Computer Requirements

"${
			game.name
		}" is highly accessible in terms of system requirements. Its graphics are not demanding on hardware, allowing it to run smoothly on a variety of systems, from low-end laptops to high-end gaming PCs. This makes it an excellent option for gamers who don’t have top-tier equipment but still want to enjoy a quality gaming experience.

### Category Score: 3 out of 3

# Conclusion and Score

"${
			game.name
		}" offers a captivating and challenging gaming experience. Its unique blend of action and roguelike mechanics, coupled with its accessible system requirements, make it a great choice for a wide range of players. While it may be tough to manage during physical activity, it remains a solid game for those looking to integrate gaming into their fitness routine.

Overall, we give "${
			game.name
		}" a score of 2.65 out of 3. It excels in gameplay and accessibility, though it poses some challenges for exercise-focused play.

### Overall Score: 2.65 out of 3

---

Mr. Game and Sweat Reviews: ${game.name} - By Taylor Dorsett
`;
	} catch (error) {
		console.error('Error generating review content:', error);
		throw error;
	}
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
			const reviewContent = await generateReviewContent(game, imageUrl);
			const reviewDate = new Date();
			reviewDate.setDate(reviewDate.getDate() + i);
			const filename = `_posts/${
				reviewDate.toISOString().split('T')[0]
			}-review-${game.appid}.md`;
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
main().catch((error) => {
	console.error('Unhandled error:', error);
	process.exit(1); // Exit with a non-zero status code to indicate failure
});
