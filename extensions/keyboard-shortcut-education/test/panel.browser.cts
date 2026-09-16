/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, expect } = require('@playwright/test');
const { setup } = require('./harness.cts');
const root = path.resolve(__dirname, '..');
const paletteAction = { commandId: 'textPowerTools.insertDecimalNumbers', title: 'Text Power Tools: Insert decimal number sequence', source: 'commandPalette' };
const accept = { commandId: 'quickInput.accept', title: 'quickInput.accept', source: 'keyboard', shortcut: 'Enter' };

/** Drive the compiled extension and its actual HTML, script and stylesheet without desktop input. */
async function openPanel(browser, width = 640) {
	const s = setup();
	const panel = s.panels[0];
	const context = await browser.newContext({ viewport: { width: width + 220, height: 820 } });
	const page = await context.newPage();
	await page.exposeFunction('educationMessage', message => panel.message.fire(message));
	await context.addInitScript(() => {
		window.acquireVsCodeApi = () => ({ postMessage: message => window.educationMessage(message) });
	});
	await context.route('https://education.test/**', async route => {
		const url = new URL(route.request().url());
		if (url.pathname === '/host') {
			await route.fulfill({ contentType: 'text/html', body: `<button id="outside">Editor</button><iframe title="Education" src="/panel" style="position:absolute;left:200px;top:0;width:${width}px;height:800px;border:0"></iframe>` });
		} else if (url.pathname === '/panel') {
			await route.fulfill({ contentType: 'text/html', body: panel.webview.html });
		} else if (url.pathname === '/extension/media/panel.css') {
			await route.fulfill({ contentType: 'text/css', body: fs.readFileSync(path.join(root, 'media/panel.css'), 'utf8') });
		} else if (url.pathname === '/extension/out/panel.js') {
			await route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(root, 'out/panel.js'), 'utf8') });
		} else { await route.abort(); }
	});
	await page.goto('https://education.test/host');
	const frame = page.frame({ url: 'https://education.test/panel' });
	panel.webview.postMessage = async message => {
		await frame.evaluate(data => window.dispatchEvent(new MessageEvent('message', { data })), message);
	};
	panel.message.fire({ type: 'ready' });
	await expect(frame.locator('#waiting')).toHaveText('Use a shortcut or choose a command');
	return { s, page, frame, close: async () => { s.context.subscriptions.forEach(x => x.dispose()); await context.close(); } };
}

test('history, per-card copying, focus, reveal controls and clear work together', async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		const { s, page, frame, close } = await openPanel(browser);
		try {
			const clear = frame.getByRole('button', { name: 'Clear History' });
			await page.locator('#outside').click();
			await expect(frame.locator('#clear')).toBeHidden();
			await expect(frame.locator('#hint')).toBeHidden();
			await page.mouse.move(400, 700);
			await expect(clear).toBeVisible();
			await page.mouse.move(100, 100);
			await expect(frame.locator('#clear')).toBeHidden();
			s.invoked.fire(paletteAction); s.invoked.fire(accept);
			await expect(frame.locator('.command')).toHaveText([accept.commandId, paletteAction.commandId]);
			const older = frame.locator('.card[data-id="0"]');
			await older.focus();
			await page.mouse.move(100, 100);
			await expect(clear).toBeVisible();
			s.invoked.fire(accept);
			await expect(frame.locator('.card')).toHaveCount(3);
			await expect(older).toBeFocused();
			await older.press('Space');
			await expect(frame.locator('body')).toHaveAttribute('data-style', 'keycaps');
			await expect(older).toBeFocused();
			assert.deepEqual(s.writes, []);
			await older.press('Enter');
			await expect.poll(() => s.writes).toEqual(['Text Power Tools: Insert decimal number sequence\ntextPowerTools.insertDecimalNumbers\nCommand Palette']);
			await frame.locator('.card').first().click();
			await expect.poll(() => s.writes.at(-1)).toEqual('quickInput.accept\nquickInput.accept\nKeyboard: Enter');
			await older.click({ button: 'right' });
			await expect(frame.locator('body')).toHaveAttribute('data-style', 'terminal');
			await expect.poll(() => s.writes.at(-1)).toContain('Terminal (terminal)');
			await clear.click();
			await expect(frame.locator('.card')).toHaveCount(0);
			await expect(frame.locator('#waiting')).toBeVisible();
			await expect(clear).toBeFocused();
			await clear.press('Space');
			await expect(frame.locator('body')).toHaveAttribute('data-style', 'toast');
			s.invoked.fire(paletteAction);
			await expect(frame.locator('.card')).toHaveCount(1);
			await clear.press('Enter');
			await expect(frame.locator('.card')).toHaveCount(0);
			s.invoked.fire({ ...paletteAction, title: '<img src=x onerror=alert(1)> @everyone' });
			await expect(frame.locator('h2')).toHaveText('<img src=x onerror=alert(1)> @everyone');
			await expect(frame.locator('.card img')).toHaveCount(0);
			await page.locator('#outside').click();
			await expect(frame.locator('#clear')).toBeHidden();
		} finally { await close(); }
	} finally { await browser.close(); }
});

test('history wraps and scrolls in all styles, narrow/wide panes and light/dark/high-contrast themes', async () => {
	const browser = await chromium.launch({ headless: true });
	try {
		for (const width of [320, 640]) {
			const { s, page, frame, close } = await openPanel(browser, width);
			try {
				s.invoked.fire(paletteAction);
				for (let i = 0; i < 30; i++) { s.invoked.fire({ ...accept, shortcut: 'Ctrl+K Ctrl+I' }); }
				await expect(frame.locator('.card')).toHaveCount(31);
				for (const [theme, background, foreground, accent] of [['dark', '#1f1f1f', '#cccccc', '#0078d4'], ['light', '#ffffff', '#333333', '#005fb8'], ['contrast', '#000000', '#ffffff', '#ffff00']]) {
					await frame.locator('body').evaluate((body, values) => {
						const [background, foreground, accent] = values;
						const tokens = { 'editor-background': background, 'editor-foreground': foreground, 'editorWidget-background': background, 'keybindingLabel-background': background, 'keybindingLabel-foreground': foreground, 'keybindingLabel-border': foreground, 'keybindingLabel-bottomBorder': foreground, 'widget-border': foreground, 'descriptionForeground': foreground, 'focusBorder': accent, 'font-family': 'Segoe UI, sans-serif', 'editor-font-family': 'Consolas, monospace', 'font-size': '13px', 'button-secondaryBackground': background, 'button-secondaryForeground': foreground, 'button-secondaryHoverBackground': background, 'button-border': foreground };
						for (const [name, value] of Object.entries(tokens)) { body.style.setProperty(`--vscode-${name}`, value); }
					}, [background, foreground, accent]);
					for (const [index, style] of ['toast', 'keycaps', 'terminal'].entries()) {
						s.setSelection(index); await s.registry.get('keyboardShortcutEducation.setStyle')();
						await expect(frame.locator('body')).toHaveAttribute('data-style', style);
						const dimensions = await frame.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth, height: document.documentElement.clientHeight, scrollHeight: document.documentElement.scrollHeight }));
						assert.ok(dimensions.scrollWidth <= dimensions.width && dimensions.scrollHeight > dimensions.height, JSON.stringify({ theme, style, width, dimensions }));
						await frame.locator('.card').last().scrollIntoViewIfNeeded();
						await page.mouse.move(250, 700);
						await expect(frame.locator('#clear')).toBeInViewport();
						await expect(frame.locator('#clear')).toBeVisible();
					}
				}
				await frame.locator('#clear').click();
				await expect(frame.locator('.card')).toHaveCount(0);
				await expect(frame.locator('#waiting')).toBeInViewport();
			} finally { await close(); }
		}
	} finally { await browser.close(); }
});
