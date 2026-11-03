# Crawlers and indexing

We want every page found and indexed, and every bot is welcome. **Never block a bot or add `noindex` without asking Taylor.**

| File | What it's for |
|---|---|
| `robots.txt` | Allows everything and points to the sitemap. A test fails if it blocks anything |
| `sitemap.xml` | Every page. `jekyll-sitemap` builds it. Set `sitemap: false` only on non pages like `reviews.json` |
| `feed.xml` | The newest posts for feed readers. `jekyll-feed` builds it |
| `humans.txt` | Who runs the site and what it's built with |
| `llms.txt` | A plain list of everything on the site for AI tools. It builds from the posts on its own |
| `opensearch.xml` | Lets browsers search the site from the address bar |
| `/all-games/` | Plain links to every review, so bots that dont run JavaScript can reach them |
| IndexNow key file | Proves we own the site to IndexNow. It's public on purpose |

## New posts

After the publish job pushes new reviews, it tells IndexNow about the new URLs. Bing, Yandex and others use that to crawl faster. Google doesnt use IndexNow, so it finds new posts through the sitemap.

That step can't fail the publish job.

## Things to keep true

* Every page has a title, a description, one h1 and a canonical link. The site tests check this.
* Every review stays within a couple clicks of home. `/all-games/` handles that.
* Removed pages get a `redirect_from` on whatever replaces them.
* Keep real content in the HTML. The `/reviews/` grid is drawn with JavaScript, so it doesnt count as links for every bot.

## Accounts only Taylor can set up

Google Search Console and Bing Webmaster Tools both need an account login. They show what's indexed and why anything isn't, and that's where to submit the sitemap.
