# Testing

Tests run on every PR. Add or update a test when you change how something works.

| Test | What it checks | Runs in |
|---|---|---|
| `test/review_utils.test.js` | Generator helpers | `security` job |
| `test/safe_error_log.test.js` | Errors dont leak secrets into logs | `security` job |
| `test/posts.test.js` | All post data: scores match the text, images exist, no duplicates, sections are right | `security` job, and before the bot publishes |
| `test/site.test.js` | The built site: titles, one h1, descriptions, canonicals, structured data, internal links, redirects, image sizes | `build` job |
| `test/browser.test.js` | A real browser: search, filters, sorting, score box, phone menu, phone filters, no sideways scrolling | `build` job |

The `security` job is in `security-checks.yml` and the `build` job is in `site-preview.yml`.

## Running them

You need Node 24. These two need nothing else:

```bash
node test/review_utils.test.js
node test/posts.test.js
```

The site and browser tests need a built site. Download the `site-preview` artifact from a PR, or build with Jekyll, then point the tests at the folder.

```bash
node test/site.test.js _site
npm install --no-save playwright@1.64.1
npx playwright install chromium
node test/browser.test.js _site
```

## What they dont cover

* Outside links and Steam images
* The live site, since they run on the build
* Whether what a review says about a game is true
* How something looks, so look at visual changes in a browser yourself

Failing tests show red on a PR but dont block merging yet. Dont merge on red.
