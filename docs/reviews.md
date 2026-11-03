# Reviews and guides

Everything is a Markdown file in `_posts/`.

## How reviews get made

`.github/workflows/publish-reviews.yml` runs `generate_reviews.js`, checks the new posts and pushes them to main.

| When | What |
|---|---|
| Every 3 days at 00:07 UTC | 3 new reviews dated today |
| Every day at 12:17 UTC | Backfill: 15 reviews for missed days between 2025-11-04 and 2026-11-03, until none are left |
| By hand | Run the workflow with `backfill_count` |

Each run:

1. Picks games we havent reviewed, starting with anything in the top 100 of any Steam genre by positive reviews. Once those are done it moves on to the most owned games overall. It skips a game if we have its Steam app or its name, and `normalizeGameName` treats editions like Legacy or Special as the same game.
2. Gets facts from the Steam store API.
3. Asks OpenAI for the review and workout details. It needs the `OPENAI_API_KEY` secret.
4. Builds the post with `buildReviewPost` in `lib/review_utils.js`.
5. Runs `test/posts.test.js`, and only commits if that passes.

If it fails, it opens an issue. `check-schedule.yml` runs daily at 18:23 UTC and opens an issue if no scheduled run has happened in 4 days.

## Review format

Front matter:

| Field | What it is |
|---|---|
| `title` | Game name as Steam has it |
| `date` | The date shown on the site |
| `added` | The real date a backdated post was added |
| `last_modified_at` | Same as `added` on backdated posts |
| `categories` | `[ review, game ]` |
| `score_gameplay`, `score_treadmill`, `score_computer` | 0 to 3 |
| `score_overall` | Average of the three |
| `steam_appid`, `genres`, `controller` | From Steam |
| `pause_friendly` | `"Yes"`, `"Sometimes"` or `"No"`, in quotes |
| `session_length` | `Short`, `Medium` or `Long` |
| `image` | Steam art URL, see [images.md](images.md) |

The body needs these `##` sections, with a `### Category Score: N out of 3` line after each of the first three:

* Gameplay
* Treadmill and Bike Compatibility
* Computer Requirements
* Conclusion and Score, ending in `### Overall Score: N out of 3`

The scores in the text have to match the front matter. Only the page title is a top level heading.

## Scoring

* Plenty of games should get a 2 or higher. A 3 means we enjoyed it and would tell you to play it, not that its perfect.
* A perfect 3 in every category should be somewhat rare. A 1 means there is a real problem worth warning a friend about.
* A game with no controller support scores 1 on treadmill and bike.
* We dont change old scores just to rescale them.

## Rules that matter

* **Backdated posts always keep the small `added` note.** Never remove it or backdate without it.
* **No invented personal stories.** Dont make up things that happened to Taylor or anyone else.
* **No duplicates.** To remove one, delete the post and add `redirect_from: ["/old-url/"]` to the one we keep.
* Dont change a review's URL without a redirect.

## Great Games, Bad Workouts

Reviews of great games you shouldnt play while exercising, like RTS games and point and click adventures. They live at `/great-games-bad-workouts/` and have `desk` in their categories.

* `generate_extras.js` writes them from the list in `_data/desk_games.json`, so add more there. A game not on Steam needs `store_url`, `store_name`, `image`, `genres` and `facts`.
* They use the normal format and scoring. Treadmill and bike has to be 0 or 1, and the score box says Great game, bad workout.
* The **Publish Extra Posts** workflow runs it.

## Extra posts schedule

`publish-extras.yml` runs at 15:41 UTC on the 1st and 15th of each month. Each run writes 1 Great Games, Bad Workouts review and 1 guide, so we get 2 of each a month on top of normal reviews. When a list runs out, the run logs it and writes nothing for that list.

## Steam curator page

Reviews stay on the site and get cross posted to [our curator page](https://store.steampowered.com/curator/45035411/). Steam has no official way to post these, so it happens by hand from a logged in browser. Never store a Steam login anywhere in this repo.

`python scripts/curator_queue.py curator_queue.csv` lists what to post, with the text in our usual format, under 200 characters.

* 2 and up is Recommended, under 2 is Not Recommended, and Great Games, Bad Workouts are Informational.
* Steam only shows the script the newest 50 reviews, so older ones may be on the list already. Steam will show that when you go to post one.
* Games not on Steam, like StarCraft II, cant be cross posted.

## Guides

Guides are posts with `categories: [ guide ]`, an `excerpt` and art in `assets/images/guides/`. They use the same layout with no score box, and they follow the same no invented stories rule. Facts like calorie numbers need a real source.

Scheduled guides come from the topics in `_data/guide_topics.json`, so add more there. `generate_extras.js` writes the text and the art, and the job makes the image sizes. The prompt tells it to leave out numbers, studies and product specs, since nobody checks a guide before it goes live.

If you add art by hand, run the resize script. See [images.md](images.md).

## Rewriting old reviews

The `Rewrite Old Reviews` workflow rewrites old generated reviews in our current voice and pushes them to the `rewrite-old-reviews` branch for a look. Scores, headings, dates and URLs stay the same, and it sets `last_modified_at` so it wont redo a review. It skips posts whose file name doesnt start with `review-`, since those are older and have people's own words in them.
