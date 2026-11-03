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
	var reviews = [];
	var matches = [];
	var shown = 0;

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
		var query = fields.search.value.trim().toLowerCase();
		var genre = fields.genre.value;
		var pause = fields.pause.value;
		var session = fields.session.value;
		var minimum = Number(fields.score.value);
		var sort = fields.sort.value;
		var controllerOnly = fields.controller.checked;

		matches = reviews.filter(function (review) {
			if (query && review.title.toLowerCase().indexOf(query) === -1) return false;
			if (genre && (review.genres || []).indexOf(genre) === -1) return false;
			if (pause && review.pause !== pause) return false;
			if (session && review.session !== session) return false;
			if (review.score < minimum) return false;
			if (controllerOnly && !review.controller) return false;
			return true;
		});

		matches.sort(function (a, b) {
			if (sort === 'title') return a.title.localeCompare(b.title);
			if (sort === 'date') return b.date.localeCompare(a.date);
			if (sort === 'treadmill') return b.treadmill - a.treadmill || b.score - a.score;
			return b.score - a.score;
		});

		var active = [genre, pause, session, minimum, controllerOnly].filter(Boolean).length;
		toggle.textContent = active ? 'Filters (' + active + ')' : 'Filters';

		grid.textContent = '';
		shown = 0;
		count.textContent = matches.length + (matches.length === 1 ? ' review' : ' reviews');
		showMore();
	}

	function init(data) {
		reviews = data;
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
