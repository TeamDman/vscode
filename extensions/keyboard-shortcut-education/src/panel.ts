/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare function acquireVsCodeApi(): { postMessage(message: { type: string }): void };

(() => {
	interface RenderMessage {
		type: 'render';
		action?: { title: string; commandId: string; shortcut?: string; source: 'keyboard' | 'commandPalette' };
		style: { id: string; name: string };
		labels: { waiting: string; hint: string; keyboard: string; palette: string; copy: string };
	}
	const vscode = acquireVsCodeApi();
	const element = (id: string) => document.getElementById(id)!;
	let feedbackTimer: ReturnType<typeof setTimeout> | undefined;
	const updateFocus = () => document.body.classList.toggle('panel-focused', document.hasFocus());
	window.addEventListener('focus', updateFocus);
	window.addEventListener('blur', updateFocus);
	updateFocus();
	window.addEventListener('message', (event: MessageEvent<RenderMessage | { type: 'feedback'; text: string }>) => {
		const message = event.data;
		if (message.type === 'render') {
			const { action, style, labels } = message;
			document.body.dataset.style = style.id;
			element('title').textContent = action?.title ?? labels.waiting;
			element('command').textContent = action?.commandId ?? '';
			element('shortcut').textContent = action?.shortcut ?? '';
			element('shortcut').hidden = !action?.shortcut;
			element('source').textContent = action ? (action.source === 'commandPalette' ? labels.palette : labels.keyboard) : '';
			element('style').textContent = style.name;
			element('hint').textContent = labels.hint;
			element('card').setAttribute('aria-label', labels.copy);
			element('card').setAttribute('aria-disabled', String(!action));
		} else if (message.type === 'feedback') {
			clearTimeout(feedbackTimer);
			element('feedback').textContent = message.text;
			feedbackTimer = setTimeout(() => { element('feedback').textContent = ''; }, 1500);
		}
	});
	element('card').addEventListener('click', () => vscode.postMessage({ type: 'copy' }));
	document.addEventListener('contextmenu', event => { event.preventDefault(); vscode.postMessage({ type: 'nextStyleAndCopy' }); });
	element('card').addEventListener('keydown', event => {
		if (event.key === 'Enter') { event.preventDefault(); vscode.postMessage({ type: 'copy' }); }
	});
	document.addEventListener('keydown', event => {
		if (event.key === ' ' && !event.ctrlKey && !event.altKey && !event.metaKey) {
			event.preventDefault();
			if (!event.repeat) { vscode.postMessage({ type: 'nextStyle' }); }
		}
	});
	vscode.postMessage({ type: 'ready' });
})();
