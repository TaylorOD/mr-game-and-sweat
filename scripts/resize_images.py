"""Makes the WebP sizes for images we host ourselves. Run from the repo root after adding one.

    pip install pillow
    python scripts/resize_images.py

Game art comes from Steam and never goes through this. See docs/images.md.
"""
import glob
import os

from PIL import Image

WIDTHS = {
    'assets/images/guides/*.jpg': [480, 960, 1536],
    'assets/images/authors/*.jpg': [128, 256],
    'assets/images/logos/logo-on-dark.png': [100, 220],
}
# Originals we keep small since only a tiny copy ever shows
MAX_SOURCE_WIDTH = {'assets/images/authors/*.jpg': 512}

for pattern, widths in WIDTHS.items():
    for path in glob.glob(pattern):
        path = path.replace(os.sep, '/')
        image = Image.open(path)
        limit = MAX_SOURCE_WIDTH.get(pattern)
        if limit and image.width > limit:
            image = image.resize((limit, round(image.height * limit / image.width)), Image.LANCZOS)
            image.save(path, optimize=True)
        base = path.rsplit('.', 1)[0]
        for width in widths:
            height = round(image.height * width / image.width)
            image.resize((width, height), Image.LANCZOS).save(f'{base}-{width}.webp', quality=80, method=6)
            print(f'{base}-{width}.webp')
