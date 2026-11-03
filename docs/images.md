# Images

The rule: **use Steam's art whenever we can. Only host images we actually need.**

## Game art

Reviews link straight to Steam's image in the `image` field of the post. We dont download it, resize it or keep a copy.

* The generator gets the URL from the Steam store API.
* Steam serves it fast and it's about 34 KB. It's 460 wide, so it can look a little soft on sharp screens. We accept that.
* We get whatever the store is showing, including things like New DLC Out Now.
* Publishers can change the URL when they update their art.

## Images we host

This is everything that isn't from Steam: guide art, author photos and logos. Every one follows these rules.

| Rule | How |
|---|---|
| Several sizes | `scripts/resize_images.py` makes them next to the original, like `name-480.webp` |
| Browser picks the size | `_includes/image.html` adds the `srcset` and `sizes` |
| WebP | The sizes are WebP. The original stays as the fallback and for social sharing |
| First screen loads first | Pass `eager=true`, or `priority=true` for the main image on a page. Everything else is lazy |
| No page jumping | `image.html` sets width and height |

Current sizes:

| Images | Widths |
|---|---|
| `assets/images/guides/*.jpg` | 480, 960, 1536 |
| `assets/images/authors/*.jpg` | 128, 256 |
| `assets/images/logos/logo-on-dark.png` | 100, 220 |

`assets/images/logos/mr-game-and-sweat.png` is the original logo. It's the social sharing image and the fallback for a review with no Steam art, so it doesnt get sizes.

Caching is the one thing we cant control. GitHub Pages sets every file to 10 minutes and that can't be changed. We'd need a CDN in front of the site for longer.

## Adding an image we host

1. Check that we really need it, and that Steam doesnt already have it.
2. Add the file to the right folder. For a new kind of image, add it to `WIDTHS` in the script and to `image.html`.
3. Run this from the repo root and commit the new files.

```bash
pip install pillow
python scripts/resize_images.py
```

4. Use `{% include image.html src=... alt=... sizes="..." %}`. Set `sizes` to how wide the image shows on the page.

The site tests fail if a guide or author image has no `srcset`, or if any file in a `srcset` is missing.

Delete images when nothing uses them anymore.
