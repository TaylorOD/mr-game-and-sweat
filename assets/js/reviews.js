(function () {
	var PAGE_SIZE = 30;
	var script = document.currentScript;
	var grid = document.getElementById('review-grid');
	var count = document.getElementById('review-count');
	var more = document.getElementById('review-more');
	var toggle = document.getElementById('filters-toggle');
	var filtersMore = document.getElementById('filters-more');
	var fields = {
		search: document.getElementById('filter-search'),
		genre: document.getElementById('filter-genre'),
		pause: document.getElementById('filter-pause'),
		session: document.getElementById('filter-session'),
		score: document.getElementById('filter-score'),
		sort: document.getElementById('filter-sort'),
		controller: document.getElementById('filter-controller'),
	};
	var guideResults = document.getElementById('guide-results');
	var guideList = document.getElementById('guide-list');
	var reviews = [];
	var guides = [];
	var matches = [];
	var shown = 0;
	var searchRequested = false;

	// Lowercase with no accents, hyphens or apostrophes, so rogue-like finds roguelike
	function clean(text) {
		return (
			' ' +
			String(text || '')
				.normalize('NFD')
				.replace(/[̀-ͯ'’-]/g, '')
				.toLowerCase()
				.replace(/[^a-z0-9]+/g, ' ')
				.trim() +
			' '
		);
	}

	function hasWord(text, term) {
		return text.indexOf(' ' + term) !== -1;
	}

	// 0 is the name, 1 is the genre or summary, 2 is the full text, -1 is no match
	function rank(item, terms) {
		var worst = 0;
		for (var i = 0; i < terms.length; i++) {
			if (item.cleanTitle.indexOf(terms[i]) !== -1) continue;
			if (hasWord(item.cleanSummary, terms[i])) worst = Math.max(worst, 1);
			else if (hasWord(item.cleanText || '', terms[i])) worst = 2;
			else return -1;
		}
		return worst;
	}

	function prepare(item) {
		item.cleanTitle = clean(item.title);
		item.cleanSummary = clean((item.genres || []).join(' ') + ' ' + item.excerpt);
	}

	// The full text is big, so it only loads once someone actually searches
	function loadSearch() {
		if (searchRequested) return;
		searchRequested = true;
		fetch(script.getAttribute('data-search'))
			.then(function (response) {
				return response.json();
			})
			.then(function (data) {
				var byUrl = {};
				reviews.forEach(function (review) {
					byUrl[review.url] = review;
				});
				data.forEach(function (entry) {
					if (entry.guide) {
						prepare(entry);
						guides.push(entry);
					}
					var item = entry.guide ? entry : byUrl[entry.url];
					if (item) item.cleanText = clean(entry.text);
				});
				apply();
			})
			.catch(function () {
				// Names, genres and summaries still work without it
			});
	}

	function showGuides(terms, active) {
		guideList.textContent = '';
		var found = [];
		if (terms.length && !active) {
			found = guides
				.map(function (guide) {
					return { guide: guide, rank: rank(guide, terms) };
				})
				.filter(function (result) {
					return result.rank !== -1;
				})
				.sort(function (a, b) {
					return a.rank - b.rank;
				})
				.slice(0, 3);
		}
		found.forEach(function (result) {
			var item = document.createElement('li');
			var link = document.createElement('a');
			link.href = result.guide.url;
			link.textContent = result.guide.title;
			var excerpt = document.createElement('p');
			excerpt.className = 'small text-muted d-none d-md-block';
			excerpt.textContent = result.guide.excerpt;
			item.appendChild(link);
			item.appendChild(excerpt);
			guideList.appendChild(item);
		});
		guideResults.hidden = found.length === 0;
	}

	function tier(score) {
		if (score >= 2.5) return 'great';
		if (score >= 2) return 'good';
		if (score >= 1.5) return 'okay';
		return 'low';
	}

	function card(review, eager) {
		var col = document.createElement('div');
		col.className = 'col-md-4 mb-5';
		var box = document.createElement('div');
		box.className = 'card';
		col.appendChild(box);

		var imageLink = document.createElement('a');
		imageLink.className = 'card-image-link';
		imageLink.href = review.url;
		if (review.image) {
			var image = document.createElement('img');
			image.loading = eager ? 'eager' : 'lazy';
			image.width = 460;
			image.height = 215;
			image.src = review.image;
			image.alt = review.title;
			imageLink.appendChild(image);
		}
		var badge = document.createElement('span');
		badge.className = 'score-badge score-' + tier(review.score);
		badge.textContent = Math.round(review.score * 10) / 10;
		var outOf = document.createElement('small');
		outOf.textContent = '/3';
		badge.appendChild(outOf);
		imageLink.appendChild(badge);
		box.appendChild(imageLink);

		var heading = document.createElement('h2');
		heading.className = 'card-title h4';
		var link = document.createElement('a');
		link.href = review.url;
		link.textContent = review.title;
		heading.appendChild(link);

		var excerpt = document.createElement('p');
		excerpt.className = 'card-text text-muted';
		excerpt.textContent = review.excerpt;
		var block = document.createElement('div');
		block.className = 'card-block';
		block.appendChild(heading);
		block.appendChild(excerpt);
		box.appendChild(block);
		return col;
	}

	function showMore() {
		matches.slice(shown, shown + PAGE_SIZE).forEach(function (review, index) {
			grid.appendChild(card(review, shown === 0 && index < 3));
		});
		shown = Math.min(shown + PAGE_SIZE, matches.length);
		more.hidden = shown >= matches.length;
	}

	function apply() {
		var terms = clean(fields.search.value).split(' ').filter(Boolean);
		if (terms.length) loadSearch();
		var genre = fields.genre.value;
		var pause = fields.pause.value;
		var session = fields.session.value;
		var minimum = Number(fields.score.value);
		var sort = fields.sort.value;
		var controllerOnly = fields.controller.checked;

		matches = reviews.filter(function (review) {
			if (terms.length) {
				review.rank = rank(review, terms);
				if (review.rank === -1) return false;
			} else {
				review.rank = 0;
			}
			if (genre && (review.genres || []).indexOf(genre) === -1) return false;
			if (pause && review.pause !== pause) return false;
			if (session && review.session !== session) return false;
			if (review.score < minimum) return false;
			if (controllerOnly && !review.controller) return false;
			return true;
		});

		matches.sort(function (a, b) {
			if (a.rank !== b.rank) return a.rank - b.rank;
			if (sort === 'title') return a.title.localeCompare(b.title);
			if (sort === 'date') return b.date.localeCompare(a.date);
			if (sort === 'treadmill') return b.treadmill - a.treadmill || b.score - a.score;
			return b.score - a.score;
		});

		var active = [genre, pause, session, minimum, controllerOnly].filter(Boolean).length;
		toggle.textContent = active ? 'Filters (' + active + ')' : 'Filters';
		showGuides(terms, active);

		grid.textContent = '';
		shown = 0;
		count.textContent = matches.length + (matches.length === 1 ? ' review' : ' reviews');
		showMore();
	}

	function init(data) {
		reviews = data;
		reviews.forEach(prepare);
		var genres = {};
		reviews.forEach(function (review) {
			(review.genres || []).forEach(function (genre) {
				genres[genre] = true;
			});
		});
		Object.keys(genres)
			.sort()
			.forEach(function (genre) {
				var option = document.createElement('option');
				option.value = genre;
				option.textContent = genre;
				fields.genre.appendChild(option);
			});
		Object.keys(fields).forEach(function (name) {
			fields[name].addEventListener(name === 'search' ? 'input' : 'change', apply);
		});
		more.addEventListener('click', showMore);
		toggle.addEventListener('click', function () {
			var open = filtersMore.classList.toggle('open');
			toggle.setAttribute('aria-expanded', String(open));
		});
		fields.search.value = new URLSearchParams(window.location.search).get('q') || '';
		apply();
	}

	fetch(script.getAttribute('data-index'))
		.then(function (response) {
			return response.json();
		})
		.then(init)
		.catch(function () {
			count.textContent = 'Could not load the reviews. Try refreshing the page.';
		});
})();
