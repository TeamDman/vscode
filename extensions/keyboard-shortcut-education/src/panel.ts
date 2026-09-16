/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare function acquireVsCodeApi(): { postMessage(message: { type: string; id?: number }): void };

(() => {
	interface Entry {
		id: number;
		title: string;
		commandId: string;
		shortcut?: string;
		source: 'keyboard' | 'commandPalette';
	}
	interface RenderMessage {
		type: 'render';
		entries: Entry[];
		style: { id: string; name: string };
		labels: { waiting: string; hint: string; keyboard: string; palette: string; copy: string; history: string; clear: string; clearHistory: string };
	}
	const vscode = acquireVsCodeApi();
	const element = (id: string) => document.getElementById(id)!;
	const cards = new Map<number, HTMLLIElement>();
	let labels: RenderMessage['labels'] | undefined;
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	const updateFocus = () => document.body.classList.toggle('panel-focused', document.hasFocus());
	window.addEventListener('focus', updateFocus);
	window.addEventListener('blur', updateFocus);
	updateFocus();

	const prepend = (entry: Entry) => {
		if (!labels || cards.has(entry.id)) { return; }
		const item = document.createElement('li');
		const card = document.createElement('div');
		card.className = 'card';
		card.tabIndex = 0;
		card.dataset.id = String(entry.id);
		card.setAttribute('role', 'button');
		card.setAttribute('aria-label', `${labels.copy}: ${entry.title}`);
		const source = document.createElement('div');
		source.className = 'source';
		source.textContent = entry.source === 'commandPalette' ? labels.palette : labels.keyboard;
		const shortcut = document.createElement('div');
		shortcut.className = 'shortcut';
		shortcut.textContent = entry.shortcut ?? '';
		shortcut.hidden = !entry.shortcut;
		const title = document.createElement('h2');
		title.textContent = entry.title;
		const command = document.createElement('div');
		command.className = 'command';
		command.textContent = entry.commandId;
		card.append(source, shortcut, title, command);
		item.append(card);
		cards.set(entry.id, item);
		element('actions').prepend(item);
		element('waiting').hidden = true;
	};
	window.addEventListener('message', (event: MessageEvent<RenderMessage | { type: 'append'; entry: Entry } | { type: 'feedback'; text: string }>) => {
		const message = event.data;
		if (message.type === 'render') {
			labels = message.labels;
			document.body.dataset.style = message.style.id;
			element('waiting').textContent = labels.waiting;
			element('history').setAttribute('aria-label', labels.history);
			element('style').textContent = message.style.name;
			element('hint').textContent = labels.hint;
			element('clear').textContent = labels.clear;
			element('clear').setAttribute('aria-label', labels.clearHistory);
			const retained = new Set(message.entries.map(entry => entry.id));
			for (const [id, item] of cards) {
				if (!retained.has(id)) { item.remove(); cards.delete(id); }
			}
			// Reuse existing cards so new actions and style changes preserve keyboard focus.
			for (const entry of message.entries.toReversed()) { prepend(entry); }
			element('waiting').hidden = cards.size > 0;
			if (!cards.size) {
				clearTimeout(feedbackTimer);
				element('feedback').textContent = '';
			}
		} else if (message.type === 'append') {
			prepend(message.entry);
		} else if (message.type === 'feedback') {
			clearTimeout(feedbackTimer);
			element('feedback').textContent = message.text;
			feedbackTimer = setTimeout(() => { element('feedback').textContent = ''; }, 1500);
		}
	});
	const copyCard = (target: EventTarget | null) => {
		const card = target instanceof Element ? target.closest<HTMLElement>('.card') : null;
		if (card) { vscode.postMessage({ type: 'copy', id: Number(card.dataset.id) }); }
	};
	element('actions').addEventListener('click', event => copyCard(event.target));
	element('clear').addEventListener('click', () => vscode.postMessage({ type: 'clear' }));
	document.addEventListener('contextmenu', event => { event.preventDefault(); vscode.postMessage({ type: 'nextStyleAndCopy' }); });
	element('actions').addEventListener('keydown', event => {
		if (event.key === 'Enter') { event.preventDefault(); copyCard(event.target); }
	});
	document.addEventListener('keydown', event => {
		if (event.key === ' ' && !event.ctrlKey && !event.altKey && !event.metaKey) {
			event.preventDefault();
			if (!event.repeat) { vscode.postMessage({ type: 'nextStyle' }); }
		}
	});
	vscode.postMessage({ type: 'ready' });
})();
