# Mr. Game and Sweat

[mrgameandsweat.com](https://mrgameandsweat.com) reviews video games you can play while running on a treadmill or riding an exercise bike. Every game gets scored out of 3 on gameplay, treadmill and bike fit, and computer requirements.

It's a Jekyll site hosted on GitHub Pages. A scheduled GitHub Action publishes new reviews. There's no server and no database.

## What I used to build this

Here's everything this runs on and what each piece does. Most of it is free, and I'd pick free and boring over clever for a site like this.

### The site

| What | What it does |
|---|---|
| [Jekyll](https://jekyllrb.com) | Turns Markdown posts into the site, with plugins for the feed, sitemap, pagination, SEO tags, archives and redirects |
| [GitHub Pages](https://pages.github.com) | Free hosting |
| [name.com](https://www.name.com) | The domain and DNS |
| [Bootstrap](https://getbootstrap.com) and [jQuery](https://jquery.com) | Came with the old template and still run the layout and menus |
| [Google Fonts](https://fonts.google.com) | The fonts |

### Writing and publishing reviews

| What | What it does |
|---|---|
| [GitHub Actions](https://github.com/features/actions) | Publishes reviews on a schedule, and runs the checks and previews on every PR |
| [Node.js](https://nodejs.org) with axios and dotenv | Runs the review generator |
| [OpenAI](https://openai.com) | `gpt-6-luna` writes the reviews and guides, and `gpt-image-2` makes guide images |
| My podcast | Transcripts from [The Professional Technical Interviewee](https://www.youtube.com/results?search_query=The+Professional+Technical+Interviewee) got distilled into a voice doc in a private repo, so reviews try to sound like me |
| [Steam](https://store.steampowered.com) store API | Controller support, genres, requirements and the game art |
| [SteamSpy](https://steamspy.com) | Which games to review next |
| [IndexNow](https://www.indexnow.org) | Tells search engines when there's a new review |
| Python with [Pillow](https://python-pillow.org) | Makes the WebP image sizes and the list of reviews to post on our [Steam curator page](https://store.steampowered.com/curator/45035411/) |

### Everything else

| What | What it does |
|---|---|
| [Playwright](https://playwright.dev) | Clicks through the built site in a real browser on every PR |
| [Google Analytics](https://analytics.google.com) and [Search Console](https://search.google.com/search-console) | Who shows up and what they searched for |
| [Formspree](https://formspree.io) | The contact form, since there's no server to send it to |
| [Mailchimp](https://mailchimp.com) | The email signup, which is off until I finish setting it up |

The chat bubble is [its own project](https://github.com/TaylorOD/ask_game_and_sweat) with its own list.

## Docs

| Doc | Read it when you're working on |
|---|---|
| [docs/reviews.md](docs/reviews.md) | Reviews, guides, the generator and the publish schedule |
| [docs/design.md](docs/design.md) | Anything people see |
| [docs/images.md](docs/images.md) | Anything with an image |
| [docs/testing.md](docs/testing.md) | Tests and CI |
| [docs/crawlers.md](docs/crawlers.md) | Robots, sitemaps and anything to do with getting indexed |

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
