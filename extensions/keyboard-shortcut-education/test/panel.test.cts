/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const { createRequire } = require('node:module');
const { test } = require('node:test');
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
					id, title, column, options, message, sent, revealCalls: [],
					reveal(...args) { this.revealCalls.push(args); },
					webview: { cspSource: 'test:', asWebviewUri: value => value, postMessage: async value => { sent.push(value); }, onDidReceiveMessage: message.event },
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
	const context = { extensionUri: 'test:/extension', subscriptions: [] }; module.exports.activate(context);
	return { invoked, registry, writes, panels, context, setSelection: index => { selection = index; } };
}
const action = { commandId: 'textPowerTools.insertDecimalNumbers', title: 'Text Power Tools: Insert decimal number sequence', source: 'commandPalette' };
const flush = () => new Promise(resolve => setImmediate(resolve));
test('open subscribes once; left click copies action and right click rotates and copies style', async () => {
	const s = setup(); s.registry.get('keyboardShortcutEducation.open')();
	const panel = s.panels[0];
	assert.equal(panel.column.viewColumn, -2); assert.equal(s.invoked.size, 1);
	s.registry.get('keyboardShortcutEducation.open')(); assert.equal(s.panels.length, 1);
	s.invoked.fire(action); panel.message.fire({ type: 'copy' }); panel.message.fire({ type: 'nextStyleAndCopy' }); await flush();
	assert.equal(s.writes[0], 'Text Power Tools: Insert decimal number sequence\ntextPowerTools.insertDecimalNumbers\nCommand Palette');
	assert.match(s.writes[1], /Keycaps \(keycaps\)\nCentered card/);
	assert.equal(panel.sent.filter(x => x.type === 'render').at(-1).action, action);
	panel.message.fire({ type: 'nextStyle' }); await flush();
	assert.equal(panel.sent.filter(x => x.type === 'render').at(-1).style.id, 'terminal');
	assert.equal(s.writes.length, 2, 'Space changes style without replacing the clipboard');
	s.context.subscriptions.forEach(x => x.dispose()); assert.equal(s.invoked.size, 0);
});
test('style commands select and cycle; close removes observations and clears the latest action', async () => {
	const s = setup(); s.registry.get('keyboardShortcutEducation.open')();
	s.invoked.fire(action); s.setSelection(2); await s.registry.get('keyboardShortcutEducation.setStyle')();
	assert.equal(s.panels[0].sent.filter(x => x.type === 'render').at(-1).style.id, 'terminal');
	s.registry.get('keyboardShortcutEducation.nextStyle')();
	assert.equal(s.panels[0].sent.filter(x => x.type === 'render').at(-1).style.id, 'toast');
	s.panels[0].dispose(); assert.equal(s.invoked.size, 0);
	s.invoked.fire(action); s.registry.get('keyboardShortcutEducation.open')();
	s.panels[1].message.fire({ type: 'ready' });
	assert.equal(s.panels[1].sent.at(-1).action, undefined);
	s.panels[1].message.fire({ type: 'copy' }); await flush(); assert.equal(s.writes.length, 0);
	s.context.subscriptions.forEach(x => x.dispose());
});
