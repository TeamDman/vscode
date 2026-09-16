/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as vscode from 'vscode';
import { randomBytes } from 'crypto';
import { describeAction, describeStyle, styles } from './presentation';

export function activate(context: vscode.ExtensionContext): void {
	let panel: vscode.WebviewPanel | undefined;
	let latest: vscode.UserCommandInvocation | undefined;
	let styleIndex = 0;
	let copyQueue = Promise.resolve();

	const render = () => panel?.webview.postMessage({
		type: 'render', action: latest, style: styles[styleIndex], labels: {
			waiting: vscode.l10n.t('Use a shortcut or choose a command'),
			hint: vscode.l10n.t('Click to copy \u00b7 Space to change style \u00b7 Right-click to change style and copy its description'),
			palette: vscode.l10n.t('Command Palette'), keyboard: vscode.l10n.t('Keyboard'),
			copy: vscode.l10n.t('Copy Action'),
		}
	});
	const nextStyle = () => { styleIndex = (styleIndex + 1) % styles.length; render(); };
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
		if (panel) { panel.reveal(vscode.ViewColumn.Beside, true); return; }
		const media = vscode.Uri.joinPath(context.extensionUri, 'media');
		const scripts = vscode.Uri.joinPath(context.extensionUri, 'out');
		const current = vscode.window.createWebviewPanel('keyboardShortcutEducation', vscode.l10n.t('Keyboard Shortcut Education'), { viewColumn: vscode.ViewColumn.Beside, preserveFocus: true }, { enableScripts: true, localResourceRoots: [media, scripts] });
		panel = current;
		const nonce = randomBytes(16).toString('hex');
		const css = current.webview.asWebviewUri(vscode.Uri.joinPath(media, 'panel.css'));
		const script = current.webview.asWebviewUri(vscode.Uri.joinPath(scripts, 'panel.js'));
		current.webview.html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${current.webview.cspSource}; script-src 'nonce-${nonce}';"><link rel="stylesheet" href="${css}"></head><body><main id="card" role="button" tabindex="0"><div id="source"></div><div id="shortcut"></div><h1 id="title"></h1><div id="command"></div></main><footer><span id="style"></span><span id="feedback" role="status" aria-live="polite"></span><p id="hint"></p></footer><script nonce="${nonce}" src="${script}"></script></body></html>`;
		const subscriptions = [
			vscode.commands.onDidInvokeUserCommand(event => {
				// Panel controls should keep the action being styled or copied visible.
				if (event.commandId.startsWith('keyboardShortcutEducation.')) { return; }
				latest = event;
				render();
			}),
			current.webview.onDidReceiveMessage((message: { type?: string }) => {
				switch (message?.type) {
					case 'ready': render(); break;
					case 'copy': if (latest) { copy(describeAction(latest)); } break;
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
			latest = undefined;
		});
	};
	context.subscriptions.push(
		vscode.commands.registerCommand('keyboardShortcutEducation.open', open),
		vscode.commands.registerCommand('keyboardShortcutEducation.nextStyle', () => { nextStyle(); open(); }),
		vscode.commands.registerCommand('keyboardShortcutEducation.setStyle', async () => {
			const choice = await vscode.window.showQuickPick(styles.map((style, index) => ({ label: vscode.l10n.t(style.name), description: style.id, detail: vscode.l10n.t(style.description), index })), { title: vscode.l10n.t('Education Panel Style') });
			if (choice) { styleIndex = choice.index; open(); render(); }
		}),
		{ dispose: () => panel?.dispose() }
	);
}
