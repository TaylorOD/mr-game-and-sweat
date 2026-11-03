# Design

Dark, like a game library. The game art is the star and everything else stays out of its way.

## Colors and fonts

All colors and fonts are variables at the top of `assets/css/custom.css`. Use those, dont add new ones.

| Variable | Used for |
|---|---|
| `--bg`, `--surface`, `--surface-2` | Page, panels, and things inside panels |
| `--line` | Borders |
| `--text`, `--text-soft`, `--muted` | Main text, long reading text, and small details |
| `--accent` | Yellow. Main buttons, links and top 3 ranks. It's the only accent |
| `--font-heading` | Barlow Semi Condensed |
| `--font-body` | Inter |

Put new styles in `custom.css`. `theme.scss` is the old template and `custom.css` loads after it.

## Scores

Scores are out of 3 and color coded the same everywhere.

| Score | Class | Color | Score box word |
|---|---|---|---|
| 2.5 and up | `score-great` | Green | Great workout game |
| 2 and up | `score-good` | Lime | Good workout game |
| 1.5 and up | `score-okay` | Orange | Okay workout game |
| Under 1.5 | `score-low` | Red | Tough workout game |

These cutoffs live in four places, so change them all together: `score_badge.html`, `score_row.html`, `score_box.html` and `assets/js/reviews.js`.

Badges round to one decimal, so 2.33 shows as 2.3. Best of ranks use a small # so they dont read like scores.

## Pieces to reuse

| Piece | File |
|---|---|
| Game and guide cards | `_includes/postbox.html`, and the matching `card()` in `reviews.js` |
| Score badge | `_includes/score_badge.html` |
| Score box | `_includes/score_box.html` |
| Ranked lists | `_includes/best_list.html` |
| Any image | `_includes/image.html`, see [images.md](images.md) |
| Primary and outline buttons | `btn btn-accent` and `btn btn-ghost` |
| Pill links | `browse-chips` |

Add a page to the header or footer in `_data/menus.yml`. Add a best of list in `_data/best_lists.yml`.

## Phones

* Check every visual change at phone width, and make sure nothing scrolls sideways.
* The breakpoint is 767px and side margins are 16px.
* A game should show on the first screen wherever we can manage it. Tuck things like filters away.

## Words

Short, casual and plain. Sound like a person who plays games on a treadmill, not a marketing page.

Keep the small "added Nov 2026" note on cards and review pages. See [reviews.md](reviews.md).

Dont add anything to the site about how reviews get written without asking Taylor first.
