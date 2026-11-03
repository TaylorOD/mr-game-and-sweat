# Mr. Game and Sweat

[mrgameandsweat.com](https://mrgameandsweat.com) reviews video games you can play while running on a treadmill or riding an exercise bike. Every game gets scored out of 3 on gameplay, treadmill and bike fit, and computer requirements.

It's a Jekyll site hosted on GitHub Pages. A scheduled GitHub Action publishes new reviews. There's no server and no database.

## Docs

| Doc | Read it when you're working on |
|---|---|
| [docs/reviews.md](docs/reviews.md) | Reviews, guides, the generator and the publish schedule |
| [docs/design.md](docs/design.md) | Anything people see |
| [docs/images.md](docs/images.md) | Anything with an image |
| [docs/testing.md](docs/testing.md) | Tests and CI |

## Where things live

| Path | What it is |
|---|---|
| `_posts/` | Every review and guide |
| `_layouts/`, `_includes/` | Page templates and pieces |
| `pages/` | Reviews, best of lists, guides, about and contact |
| `index.html` | Home page |
| `_data/` | Menus, best of lists and search title patterns |
| `assets/css/custom.css` | Our styles. `theme.scss` is the old template, leave it alone when you can |
| `assets/js/reviews.js` | Search and filters on the all reviews page |
| `generate_reviews.js`, `lib/` | Writes reviews |
| `scripts/resize_images.py` | Makes sizes for images we host |
| `test/` | Tests |
| `.github/workflows/` | Publishing, checks and previews |

## How we work

* Every change gets its own branch and its own PR, merged on its own. No big mixed branches.
* Look at visual changes in a browser and put screenshots in the PR. Measurements dont count as looking.
* Tests run on every PR. See [docs/testing.md](docs/testing.md).
* Use short, lowercase commit messages like `update readme`.
* Write like a person: short, casual and plain. That goes for site copy, PRs and docs.

## Images in one line

Game art comes from Steam and we dont host it. Images we do host get multiple WebP sizes. See [docs/images.md](docs/images.md).

## Running it

GitHub Pages builds the site, so you dont need anything installed to ship a change. Every PR runs the **Site preview** action, and its `site-preview` artifact is the built site. Download it and serve the folder to look at your change.

With Ruby and Bundler installed you can also run it locally:

```bash
bundle install
bundle exec jekyll serve --watch
```

The chat bubble in `_includes/chat.html` stays hidden until `chat_api_url` is set in `_config.yml`. The chatbot behind it is a separate project.
