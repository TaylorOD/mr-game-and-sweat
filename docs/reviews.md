# Reviews and guides

Everything is a Markdown file in `_posts/`.

## How reviews get made

`.github/workflows/publish-reviews.yml` runs `generate_reviews.js`, checks the new posts and pushes them to main.

| When | What |
|---|---|
| Every 3 days at 00:00 UTC | 3 new reviews dated today |
| Every day at 12:00 UTC | Backfill: 15 reviews for missed days between 2025-11-04 and 2026-11-03, until none are left |
| By hand | Run the workflow with `backfill_count` |

Each run:

1. Picks games we havent reviewed, starting with anything in the top 100 of any Steam genre by positive reviews. Once those are done it moves on to the most owned games overall. It skips a game if we have its Steam app or its name, and `normalizeGameName` treats editions like Legacy or Special as the same game.
2. Gets facts from the Steam store API.
3. Asks OpenAI for the review and workout details. It needs the `OPENAI_API_KEY` secret.
4. Builds the post with `buildReviewPost` in `lib/review_utils.js`.
5. Runs `test/posts.test.js`, and only commits if that passes.

If it fails, it opens an issue. `check-schedule.yml` runs daily at 18:00 UTC and opens an issue if no scheduled run has happened in 4 days.

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

* Be tough and use the whole scale. Most games land on 1 or 2, and a 3 is rare.
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

## Guides

Guides are hand written posts with `categories: [ guide ]`, an `excerpt` and art in `assets/images/guides/`. They use the same layout with no score box, and they follow the same no invented stories rule. Facts like calorie numbers need a real source.

Guide art is hosted by us, so run the resize script. See [images.md](images.md).
