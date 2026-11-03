# Mr. Game and Sweat

A Jekyll site on GitHub Pages that reviews games you can play on a treadmill or exercise bike. Read `README.md` first, then the doc for what you're touching:

* `docs/reviews.md` for reviews, guides and the generator
* `docs/design.md` for anything people see
* `docs/images.md` for anything with an image
* `docs/testing.md` for tests and CI
* `docs/crawlers.md` for robots, sitemaps and indexing

## Images

Use Steam's art whenever we can and only host images we actually need. Never download, resize or copy game art into the repo.

Every image we host gets multiple WebP sizes from `scripts/resize_images.py`, and goes through `_includes/image.html` so it gets a `srcset`, width and height. Pass `eager=true` for images on the first screen and `priority=true` for the main image on a page. Everything else stays lazy. Delete images nothing uses.

## Pull requests

* One change per branch and per PR, merged on its own.
* Visual changes need a look in a browser on desktop and phone, and screenshots in the PR.
* Dont merge on red. Add or update tests when behavior changes.
* Commit messages are lowercase and a few words, like `update readme`.

## Writing

Short, casual and plain, in site copy, docs, commits and PRs. No hyphens, em dashes or semicolons in prose, and no dash bullets in PR bodies. Code, URLs and file names can keep theirs.

## When reviewing or writing code, flag these

* A backdated post with no `added` note, or that note being removed.
* Invented personal stories or made up facts in reviews or guides.
* Anything added to the site about how reviews get written. Taylor decides that.
* A post URL changing without a `redirect_from`.
* Anything that blocks a bot or adds `noindex`. We want every page indexed.
* Colors or fonts outside the variables in `assets/css/custom.css`, or new styles in `theme.scss`.
* An image that skips `_includes/image.html`, or game art added to the repo.
* Secrets in the repo.
* Score cutoffs changed in only some of the four files listed in `docs/design.md`.
