"""Lists reviews that arent on our Steam curator page yet, ready to paste. Run from the repo root.

    python scripts/curator_queue.py curator_queue.csv

Steam has no official way to post these, so someone posts them by hand. See docs/reviews.md.
"""
import csv
import glob
import json
import re
import sys
import time
import urllib.request

CURATOR = 'https://store.steampowered.com/curator/45035411/ajaxgetfilteredrecommendations/render/'
LIMIT = 200


def posted_appids():
    appids = set()
    start = 0
    while True:
        request = urllib.request.Request(
            f'{CURATOR}?query=&start={start}&count=50&sort=recent',
            headers={'User-Agent': 'Mozilla/5.0'},
        )
        page = json.load(urllib.request.urlopen(request, timeout=60))
        found = re.findall(r'data-ds-appid="(\d+)"', page.get('results_html', ''))
        if not found:
            return appids
        appids.update(int(appid) for appid in found)
        start += len(found)
        time.sleep(1)


def field(text, name):
    match = re.search(rf'^{name}:\s*"?(.*?)"?\s*$', text, re.M)
    return match.group(1) if match else None


def blurb(name, gameplay, treadmill, computer, overall):
    template = (
        'Mr. Game and Sweat Review - {}:\n---\n'
        f'Gameplay: {gameplay}\nTreadmill and Bike Compatibility: {treadmill}\n'
        f'Computer Requirements: {computer}\n---\nOverall score: {overall} out of 3'
    )
    room = LIMIT - len(template.format(''))
    return template.format(name if len(name) <= room else name[: room - 3] + '...')


def main(out):
    posted = posted_appids()
    rows = []
    for path in sorted(glob.glob('_posts/*.md'), reverse=True):
        text = open(path, encoding='utf8').read()
        appid = field(text, 'steam_appid')
        if not appid or int(appid) in posted:
            continue
        overall = float(field(text, 'score_overall'))
        title = field(text, 'title')
        slug = re.sub(r'^.*?\d{4}-\d{2}-\d{2}-', '', path.replace('\\', '/'))[:-3]
        if re.search(r'^categories:.*\bdesk\b', text, re.M):
            verdict = 'Informational'
        else:
            verdict = 'Recommended' if overall >= 2 else 'Not Recommended'
        rows.append({
            'appid': appid,
            'game': title,
            'verdict': verdict,
            'text': blurb(title, field(text, 'score_gameplay'), field(text, 'score_treadmill'), field(text, 'score_computer'), f'{overall:g}'),
            'link': f'https://mrgameandsweat.com/{slug}/',
        })
    with open(out, 'w', encoding='utf-8-sig', newline='') as file:
        writer = csv.DictWriter(file, fieldnames=['appid', 'game', 'verdict', 'text', 'link'])
        writer.writeheader()
        writer.writerows(rows)
    print(f'{len(posted)} on the curator page seen, {len(rows)} to post')
    return rows


if __name__ == '__main__':
    main(sys.argv[1])
