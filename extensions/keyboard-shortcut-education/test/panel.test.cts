/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { setup } = require('./harness.cts');
const action = { commandId: 'textPowerTools.insertDecimalNumbers', title: 'Text Power Tools: Insert decimal number sequence', source: 'commandPalette' };
const accept = { commandId: 'quickInput.accept', title: 'quickInput.accept', source: 'keyboard', shortcut: 'Enter' };
const flush = () => new Promise(resolve => setImmediate(resolve));
const snapshot = panel => {
	panel.message.fire({ type: 'ready' });
	return JSON.parse(JSON.stringify(panel.sent.at(-1)));
};
test('palette action survives prompt acceptance; older and repeated actions copy independently', async () => {
	const s = setup(); s.registry.get('keyboardShortcutEducation.open')();
	const panel = s.panels[0];
	s.invoked.fire(action); s.invoked.fire(accept); s.invoked.fire(accept);
	assert.deepEqual(snapshot(panel).entries, [{ id: 2, ...accept }, { id: 1, ...accept }, { id: 0, ...action }]);
	panel.message.fire({ type: 'copy', id: 0 }); panel.message.fire({ type: 'copy', id: 2 }); await flush();
	assert.deepEqual(s.writes, [
		'Text Power Tools: Insert decimal number sequence\ntextPowerTools.insertDecimalNumbers\nCommand Palette',
		'quickInput.accept\nquickInput.accept\nKeyboard: Enter'
	]);
	s.context.subscriptions.forEach(x => x.dispose());
});
test('clear button and command empty history; stale or invalid copy requests cannot copy another action', async () => {
	const s = setup(); s.registry.get('keyboardShortcutEducation.open')();
	const panel = s.panels[0];
	s.invoked.fire(action); panel.message.fire({ type: 'clear' });
	assert.deepEqual(snapshot(panel).entries, []);
	s.invoked.fire(accept);
	for (const id of [0, -1, '1', undefined]) { panel.message.fire({ type: 'copy', id }); }
	await flush(); assert.deepEqual(s.writes, []);
	s.invoked.fire({ ...action, commandId: 'keyboardShortcutEducation.clearHistory' });
	s.registry.get('keyboardShortcutEducation.clearHistory')();
	assert.deepEqual(snapshot(panel).entries, []);
	s.invoked.fire(action); assert.deepEqual(snapshot(panel).entries, [{ id: 2, ...action }]);
	s.context.subscriptions.forEach(x => x.dispose());
});
test('style controls preserve history and Space does not write to the clipboard', async () => {
	const s = setup(); s.registry.get('keyboardShortcutEducation.open')();
	const panel = s.panels[0];
	assert.equal(panel.column.viewColumn, -2); assert.equal(s.invoked.size, 1);
	s.registry.get('keyboardShortcutEducation.open')();
	assert.deepEqual(panel.revealCalls, [[2, true]]);
	s.invoked.fire(action); panel.message.fire({ type: 'nextStyleAndCopy' }); await flush();
	assert.match(s.writes[0], /Keycaps \(keycaps\)\nCentered card/);
	panel.message.fire({ type: 'nextStyle' }); await flush();
	const rendered = snapshot(panel);
	assert.deepEqual({ entries: rendered.entries, style: rendered.style.id, writes: s.writes.length, panels: s.panels.length }, { entries: [{ id: 0, ...action }], style: 'terminal', writes: 1, panels: 1 });
	s.setSelection(0); await s.registry.get('keyboardShortcutEducation.setStyle')();
	assert.equal(snapshot(panel).style.id, 'toast');
	s.registry.get('keyboardShortcutEducation.nextStyle')();
	assert.equal(snapshot(panel).style.id, 'keycaps');
	s.context.subscriptions.forEach(x => x.dispose());
});
test('hidden panel retains history; close unsubscribes and reopening starts empty', async () => {
	const s = setup(); s.registry.get('keyboardShortcutEducation.open')();
	const panel = s.panels[0];
	s.invoked.fire(action); panel.view.fire({ visible: false }); s.invoked.fire(accept);
	assert.deepEqual(snapshot(panel).entries.map(entry => entry.commandId), [accept.commandId, action.commandId]);
	panel.dispose(); assert.equal(s.invoked.size, 0);
	s.invoked.fire(action); s.registry.get('keyboardShortcutEducation.open')();
	assert.deepEqual(snapshot(s.panels[1]).entries, []);
	s.panels[1].message.fire({ type: 'copy', id: 0 }); await flush(); assert.deepEqual(s.writes, []);
	s.context.subscriptions.forEach(x => x.dispose());
});
