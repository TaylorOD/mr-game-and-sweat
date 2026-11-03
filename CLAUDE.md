# Mr. Game and Sweat

A Jekyll site on GitHub Pages that reviews games you can play on a treadmill or exercise bike. Read [README.md](README.md) first, then the doc for what you're touching:

* [docs/reviews.md](docs/reviews.md) for reviews, guides and the generator
* [docs/design.md](docs/design.md) for anything people see
* [docs/images.md](docs/images.md) for anything with an image
* [docs/testing.md](docs/testing.md) for tests and CI
* [docs/crawlers.md](docs/crawlers.md) for robots, sitemaps and indexing

## Images

Use Steam's art whenever we can and only host images we actually need. Never download, resize or copy game art into the repo.

Every image we host gets multiple WebP sizes from `scripts/resize_images.py`, and goes through `_includes/image.html` so it gets a `srcset`, width and height. Pass `eager=true` for images on the first screen and `priority=true` for the main image on a page. Everything else stays lazy. Delete images nothing uses.

## Pull requests

* One change per branch and per PR, merged on its own, even when asked for a lot at once.
* Look at visual changes in a browser, at the part that changed, on desktop and phone. Measurements dont count.
* Put screenshots in the PR.
* Dont merge on red. Add or update tests when behavior changes.
* Commit messages are lowercase and a few words, like `update readme`.
* No Claude attribution lines in commits or PRs.

## Writing

Short, casual and plain, in site copy, docs, commits and PRs. No hyphens, em dashes or semicolons in prose, and no dash bullets in PR bodies. Code, URLs and file names can keep theirs.

## Dont

* Remove the small `added` note from a backdated post, or backdate without it.
* Invent personal stories or made up facts in reviews or guides.
* Add anything to the site about how reviews get written without asking Taylor.
* Change a post's URL without a `redirect_from`.
* Block a bot or add `noindex`. We want every page indexed.
* Add colors or fonts outside the variables in `assets/css/custom.css`, or restyle things in `theme.scss`.
* Commit `.env` or put secrets anywhere in the repo.

## Good to know

* The site is built by GitHub Pages, and the `site-preview` artifact on a PR is the easiest way to see a change.
* The publish bot pushes straight to main, so pull before you branch.
* Score color cutoffs live in four files. See [docs/design.md](docs/design.md).
