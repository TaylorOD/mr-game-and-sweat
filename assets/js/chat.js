// The "Ask about a game" chat bubble. It talks to the API in the ask_game_and_sweat repo.
(function () {
	const API_URL = document.currentScript.dataset.api.replace(/\/$/, '');
	const STORAGE_KEY = 'mgs-chat';
	const MAX_HISTORY = 10;
	const SITE_ORIGINS = ['https://mrgameandsweat.com', 'https://www.mrgameandsweat.com', location.origin];
	const GENERAL_QUESTIONS = [
		"What's the best game to play on a treadmill?",
		'Recommend something chill for a long walk',
		'What runs well on an old computer?',
	];

	let history = [];
	let busy = false;

	function load() {
		try {
			return JSON.parse(sessionStorage.getItem(STORAGE_KEY)) || {};
		} catch {
			return {};
		}
	}

	function save(open) {
		try {
			sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ history, open }));
		} catch {
			// Private windows can block storage. The chat still works, it just won't follow you between pages
		}
	}

	function element(tag, className, text) {
		const node = document.createElement(tag);
		if (className) node.className = className;
		if (text) node.textContent = text;
		return node;
	}

	function reviewLink(url, text) {
		let parsed;
		try {
			parsed = new URL(url);
		} catch {
			return document.createTextNode(text);
		}
		if (!SITE_ORIGINS.includes(parsed.origin)) return document.createTextNode(text);
		const link = element('a', '', text);
		link.href = location.origin + parsed.pathname; // a bare //host path would leave the site
		return link;
	}

	// Answers only ever go into the page as text nodes and links back to this site, never as HTML
	const INLINE = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+[^\s).,!?])|\*\*(.+?)\*\*/g;

	function addInline(parent, text) {
		let last = 0;
		for (const match of text.matchAll(INLINE)) {
			parent.append(text.slice(last, match.index));
			if (match[1]) parent.append(reviewLink(match[2], match[1]));
			else if (match[3]) parent.append(reviewLink(match[3], 'Read the review'));
			else parent.append(element('strong', '', match[4]));
			last = match.index + match[0].length;
		}
		parent.append(text.slice(last));
	}

	function renderAnswer(container, text) {
		container.replaceChildren();
		let list = null;
		for (const line of text.trim().split('\n')) {
			if (!line.trim()) continue;
			const bullet = line.match(/^\s*[-*]\s+(.*)/);
			if (bullet) {
				if (!list) list = container.appendChild(element('ul'));
				addInline(list.appendChild(element('li')), bullet[1]);
			} else {
				list = null;
				addInline(container.appendChild(element('p')), line);
			}
		}
	}

	// On a review page, offer that game first
	function currentGame() {
		const match = document.title.match(/Reviews:\s*(.+?)\s*\|/);
		return match ? match[1] : null;
	}

	function suggestions() {
		const game = currentGame();
		return game ? [`Is ${game} good on a treadmill?`, GENERAL_QUESTIONS[0], GENERAL_QUESTIONS[1]] : GENERAL_QUESTIONS;
	}

	const bubble = element('button', 'mgs-chat-bubble');
	bubble.type = 'button';
	bubble.setAttribute('aria-expanded', 'false');
	bubble.setAttribute('aria-controls', 'mgs-chat-panel');
	bubble.innerHTML =
		'<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path fill="currentColor" d="M4 3h16a2 2 0 0 1 2 2v11a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z"/></svg>';
	bubble.append(element('span', '', 'Ask about a game'));

	const panel = element('section', 'mgs-chat-panel');
	panel.id = 'mgs-chat-panel';
	panel.hidden = true;
	panel.setAttribute('aria-label', 'Ask Mr. Game and Sweat');

	const header = element('header', 'mgs-chat-header');
	header.append(element('h2', '', 'Ask Mr. Game and Sweat'));
	const close = element('button', 'mgs-chat-close', '×');
	close.type = 'button';
	close.setAttribute('aria-label', 'Close chat');
	header.append(close);

	const thread = element('div', 'mgs-chat-thread');
	thread.setAttribute('aria-live', 'polite');

	const form = element('form', 'mgs-chat-form');
	const input = element('textarea');
	input.rows = 1;
	input.maxLength = 500;
	input.placeholder = 'What are you looking to play?';
	input.setAttribute('aria-label', 'Your question');
	const send = element('button', 'mgs-chat-send', 'Ask');
	send.type = 'submit';
	form.append(input, send);

	const finePrint = element('p', 'mgs-chat-fine-print', 'Answers come from our reviews, but AI can make mistakes.');

	panel.append(header, thread, form, finePrint);
	document.body.append(bubble, panel);

	function scrollDown() {
		thread.scrollTop = thread.scrollHeight;
	}

	function showWelcome() {
		const welcome = element('div', 'mgs-chat-welcome');
		welcome.append(element('p', '', "Hey! I've read all of our reviews. Ask me what to play on your next workout."));
		for (const question of suggestions()) {
			const chip = element('button', 'mgs-chat-chip', question);
			chip.type = 'button';
			chip.addEventListener('click', () => ask(question));
			welcome.append(chip);
		}
		thread.append(welcome);
	}

	function addMessage(role, text) {
		const message = element('div', `mgs-chat-message mgs-chat-${role}`);
		if (role === 'user') {
			message.textContent = text;
		} else if (text) {
			renderAnswer(message.appendChild(element('div', 'mgs-chat-answer')), text);
		}
		thread.append(message);
		return message;
	}

	async function readEvents(response, onEvent) {
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = '';
		while (true) {
			const { value, done } = await reader.read();
			if (done) break;
			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split('\n');
			buffer = lines.pop();
			lines.filter(Boolean).forEach((line) => onEvent(JSON.parse(line)));
		}
	}

	async function ask(question) {
		question = question.trim();
		if (busy || !question) return;
		busy = true;
		send.disabled = true;
		thread.querySelector('.mgs-chat-welcome')?.remove();

		addMessage('user', question);
		history.push({ role: 'user', content: question });
		const message = addMessage('assistant');
		const body = message.appendChild(element('div', 'mgs-chat-answer mgs-chat-thinking', 'Checking the reviews'));
		scrollDown();

		let answer = '';
		let error = null;
		try {
			const response = await fetch(`${API_URL}/api/chat`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ messages: history.slice(-MAX_HISTORY) }),
			});
			if (!response.ok) {
				const { detail } = await response.json();
				error = typeof detail === 'string' ? detail : "I couldn't send that one. Try asking another way.";
			} else {
				await readEvents(response, (event) => {
					if (event.type === 'delta') {
						answer += event.text;
						body.classList.remove('mgs-chat-thinking');
						renderAnswer(body, answer);
						scrollDown();
					} else if (event.type === 'error') {
						error = event.message;
					}
				});
			}
		} catch {
			error = "I couldn't reach the server. Check your connection and try again.";
		}

		if (answer && !error) {
			history.push({ role: 'assistant', content: answer.trim() });
		} else {
			history.pop(); // so a retry doesn't send the question twice
			body.classList.remove('mgs-chat-thinking');
			body.classList.add('mgs-chat-error');
			body.textContent = error || 'No answer came back. Please try again.';
		}
		save(!panel.hidden);
		scrollDown();
		busy = false;
		send.disabled = false;
		input.focus();
	}

	function setOpen(open) {
		panel.hidden = !open;
		bubble.hidden = open;
		bubble.setAttribute('aria-expanded', String(open));
		save(open);
		if (open) {
			scrollDown();
			input.focus();
		} else {
			bubble.focus();
		}
	}

	bubble.addEventListener('click', () => setOpen(true));
	close.addEventListener('click', () => setOpen(false));
	panel.addEventListener('keydown', (event) => {
		if (event.key === 'Escape') setOpen(false);
	});

	form.addEventListener('submit', (event) => {
		event.preventDefault();
		if (busy) return; // keep the draft until the answer finishes
		const question = input.value;
		input.value = '';
		ask(question);
	});
	input.addEventListener('keydown', (event) => {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			form.requestSubmit();
		}
	});

	// The conversation follows you when you click through to a review
	const saved = load();
	history = Array.isArray(saved.history) ? saved.history : [];
	for (const turn of history) addMessage(turn.role, turn.content);
	if (!history.length) showWelcome();
	if (saved.open) {
		panel.hidden = false;
		bubble.hidden = true;
		bubble.setAttribute('aria-expanded', 'true');
		scrollDown();
	}
})();
