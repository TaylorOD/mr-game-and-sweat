const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const STEAM_API_URL = 'https://api.steampowered.com/ISteamApps/GetAppList/v2/';

async function fetchTopGames() {
	const response = await axios.get(STEAM_API_URL);
	const games = response.data.applist.apps;
	const topGames = games.slice(0, 3); // Simplified for example
	return topGames;
}

function hasBeenReviewed(gameName) {
	const postsDir = path.join(__dirname, '_posts');
	const files = fs.readdirSync(postsDir);
	return files.some((file) => {
		const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
		return content.includes(gameName);
	});
}

async function generateReviewContent(game) {
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
---

${response.data.choices[0].text}

Mr. Game and Sweat Reviews: ${game.name} - By Taylor Dorsett
`;
}

async function main() {
	const topGames = await fetchTopGames();
	for (let i = 0; i < topGames.length; i++) {
		const game = topGames[i];
		if (!hasBeenReviewed(game.name)) {
			const reviewContent = await generateReviewContent(game);
			const reviewDate = new Date();
			reviewDate.setDate(reviewDate.getDate() + i);
			const filename = `_posts/${
				reviewDate.toISOString().split('T')[0]
			}-review-${game.appid}.md`;
			fs.writeFileSync(filename, reviewContent);
		}
	}
}

main().catch(console.error);
