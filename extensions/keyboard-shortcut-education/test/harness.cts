/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const entry = path.join(root, 'out/extension.js');
function signal() {
	const listeners = new Set();
	return { event: callback => { listeners.add(callback); return { dispose: () => listeners.delete(callback) }; }, fire: value => { for (const callback of [...listeners]) { callback(value); } }, get size() { return listeners.size; } };
}
function setup() {
	const invoked = signal(), registry = new Map(), writes = [], panels = [];
	let selection;
	const vscode = {
		ViewColumn: { Beside: -2 }, Uri: { joinPath: (uri, ...parts) => [uri, ...parts].join('/') },
		l10n: { t: value => value },
		commands: { onDidInvokeUserCommand: invoked.event, registerCommand: (id, fn) => { registry.set(id, fn); return { dispose: () => registry.delete(id) }; } },
		env: { clipboard: { writeText: async value => { writes.push(value); }, readText: () => { throw Error('Clipboard read forbidden'); } } },
		window: {
			showQuickPick: async items => items[selection],
			createWebviewPanel: (id, title, column, options) => {
				const message = signal(), disposed = signal(), view = signal(), sent = [];
				const panel = {
					id, title, column, options, message, sent, view, viewColumn: 2, revealCalls: [],
					reveal(...args) { this.revealCalls.push(args); },
					webview: { cspSource: 'https://education.test', asWebviewUri: value => value, postMessage: async value => { sent.push(value); }, onDidReceiveMessage: message.event },
					onDidDispose: disposed.event, onDidChangeViewState: view.event,
					dispose: () => disposed.fire(),
				};
				panels.push(panel); return panel;
			}
		}
	};
	Object.defineProperty(vscode, 'workspace', { get: () => { throw Error('Workspace content access forbidden'); } });
	const module = { exports: {} }, realRequire = createRequire(entry);
	vm.runInNewContext(fs.readFileSync(entry, 'utf8'), { exports: module.exports, module, require: name => name === 'vscode' ? vscode : realRequire(name) }, { filename: entry });
	const context = { extensionUri: 'https://education.test/extension', subscriptions: [] }; module.exports.activate(context);
	return { invoked, registry, writes, panels, context, setSelection: index => { selection = index; } };
}
module.exports = { setup };
