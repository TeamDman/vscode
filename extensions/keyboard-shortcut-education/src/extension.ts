/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { describeAction, describeStyle, styles } from './presentation';

export function activate(context: vscode.ExtensionContext): void {
	let panel: vscode.WebviewPanel | undefined;
	const history = new Map<number, vscode.UserCommandInvocation>();
	let nextId = 0;
	let styleIndex = 0;
	let copyQueue = Promise.resolve();

	const render = () => panel?.webview.postMessage({
		type: 'render', entries: Array.from(history, ([id, action]) => ({ id, ...action })).reverse(), style: styles[styleIndex], labels: {
			waiting: vscode.l10n.t('Use a shortcut or choose a command'),
			hint: vscode.l10n.t('Click an action to copy \u00b7 Space to change style \u00b7 Right-click to change style and copy its description'),
			palette: vscode.l10n.t('Command Palette'), keyboard: vscode.l10n.t('Keyboard'),
			copy: vscode.l10n.t('Copy Action'), history: vscode.l10n.t('Action History'),
			clear: vscode.l10n.t('Clear'), clearHistory: vscode.l10n.t('Clear History'),
		}
	});
	const nextStyle = () => { styleIndex = (styleIndex + 1) % styles.length; render(); };
	const clear = () => { history.clear(); render(); };
	const copy = (value: string) => {
		// Preserve gesture order if clipboard writes complete asynchronously.
		copyQueue = copyQueue.then(async () => {
			try {
				await vscode.env.clipboard.writeText(value);
				panel?.webview.postMessage({ type: 'feedback', text: vscode.l10n.t('Copied') });
			} catch {
				panel?.webview.postMessage({ type: 'feedback', text: vscode.l10n.t('Could not copy') });
			}
		});
	};
	const open = () => {
		if (panel) { panel.reveal(panel.viewColumn, true); return; }
		const media = vscode.Uri.joinPath(context.extensionUri, 'media');
		const scripts = vscode.Uri.joinPath(context.extensionUri, 'out');
		const current = vscode.window.createWebviewPanel('keyboardShortcutEducation', vscode.l10n.t('Keyboard Shortcut Education'), { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: true, localResourceRoots: [media, scripts] });
		panel = current;
		const nonce = randomBytes(16).toString('hex');
		const css = current.webview.asWebviewUri(vscode.Uri.joinPath(media, 'panel.css'));
		const script = current.webview.asWebviewUri(vscode.Uri.joinPath(scripts, 'panel.js'));
		current.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${current.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${css}"></head><body><header id="controls"><div id="toolbar"><span id="style"></span><span id="feedback" role="status" aria-live="polite"></span><button id="clear" type="button"></button></div><p id="hint"></p></header><main id="history"><h1 id="waiting"></h1><ol id="actions"></ol></main><script nonce="${nonce}" src="${script}"></script></body></html>`;
		const subscriptions = [
			vscode.commands.onDidInvokeUserCommand(event => {
				// Panel controls must not add entries or repopulate a cleared history.
				if (event.commandId.startsWith('keyboardShortcutEducation.')) { return; }
				const id = nextId++;
				history.set(id, event);
				current.webview.postMessage({ type: 'append', entry: { id, ...event } });
			}),
			current.webview.onDidReceiveMessage((message: { type?: string; id?: number }) => {
				switch (message?.type) {
					case 'ready': render(); break;
					case 'copy': {
						const action = typeof message.id === 'number' ? history.get(message.id) : undefined;
						if (action) { copy(describeAction(action)); }
						break;
					}
					case 'clear': clear(); break;
					case 'nextStyle': nextStyle(); break;
					case 'nextStyleAndCopy': nextStyle(); copy(describeStyle(styles[styleIndex])); break;
				}
			}),
			current.onDidChangeViewState(() => render())
		];
		const closed = current.onDidDispose(() => {
			for (const subscription of subscriptions) { subscription.dispose(); }
			closed.dispose();
			panel = undefined;
			history.clear();
		});
	};
	context.subscriptions.push(
		vscode.commands.registerCommand('keyboardShortcutEducation.open', open),
		vscode.commands.registerCommand('keyboardShortcutEducation.clearHistory', clear),
		vscode.commands.registerCommand('keyboardShortcutEducation.nextStyle', () => { nextStyle(); open(); }),
		vscode.commands.registerCommand('keyboardShortcutEducation.setStyle', async () => {
			const choice = await vscode.window.showQuickPick(styles.map((style, index) => ({ label: vscode.l10n.t(style.name), description: style.id, detail: vscode.l10n.t(style.description), index })), { title: vscode.l10n.t('Education Panel Style') });
			if (choice) { styleIndex = choice.index; open(); render(); }
		}),
		{ dispose: () => panel?.dispose() }
	);
}
