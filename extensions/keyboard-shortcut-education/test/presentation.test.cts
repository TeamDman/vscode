/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const { describeAction, describeStyle, styles } = require('../out/presentation.js');

test('palette copy includes title and identity, without inventing a shortcut', () => {
	assert.equal(describeAction({ commandId: 'textPowerTools.insertDecimalNumbers', title: 'Text Power Tools: Insert decimal number sequence', source: 'commandPalette' }), 'Text Power Tools: Insert decimal number sequence\ntextPowerTools.insertDecimalNumbers\nCommand Palette');
});
test('Discord copy preserves actual chord and escapes mentions and formatting', () => {
	assert.equal(describeAction({ commandId: 'test.command', title: '@everyone *Example*', source: 'keyboard', shortcut: 'Ctrl+K Ctrl+I' }), '@\u200beveryone \\*Example\\*\ntest.command\nKeyboard: Ctrl+K Ctrl+I');
});
test('every style has a distinct reproducible description', () => {
	assert.equal(new Set(styles.map(style => style.id)).size, 3);
	for (const style of styles) {
		assert.equal(describeStyle(style), `Keyboard Shortcut Education Panel — ${style.name} (${style.id})\n${style.description}`);
	}
});
