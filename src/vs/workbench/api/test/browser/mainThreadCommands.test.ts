/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import type { UserCommandInvocation } from 'vscode';
import { MenuId, MenuRegistry } from '../../../../platform/actions/common/actions.js';
import { notifyUserCommandInvocation } from '../../../../platform/commands/common/userCommandInvocation.js';
import { MainThreadCommands } from '../../browser/mainThreadCommands.js';
import { CommandsRegistry, ICommandService } from '../../../../platform/commands/common/commands.js';
import { SingleProxyRPCProtocol } from '../common/testRPCProtocol.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { mock } from '../../../../base/test/common/mock.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';

suite('MainThreadCommands', function () {

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('education observation is opt-in, static, latest-event only and disposable', () => {
		const events: UserCommandInvocation[] = [];
		const commands = store.add(new MainThreadCommands(SingleProxyRPCProtocol({ $acceptUserCommandInvocation: (event: UserCommandInvocation) => events.push(event) }), undefined!, new class extends mock<IExtensionService>() { }));
		store.add(MenuRegistry.addCommand({ id: 'education.palette', title: { value: 'Insert Numbers', original: 'Insert Numbers' }, category: 'Example' }));
		store.add(MenuRegistry.appendMenuItem(MenuId.CommandPalette, { command: { id: 'education.menuOnly', title: 'Menu Only' } }));
		notifyUserCommandInvocation('education.palette', 'commandPalette');
		commands.$setUserCommandObservation(true);
		commands.$setUserCommandObservation(true);
		notifyUserCommandInvocation('education.palette', 'commandPalette');
		notifyUserCommandInvocation('education.untitled', 'keyboard', 'Ctrl+K Ctrl+I');
		notifyUserCommandInvocation('education.menuOnly', 'keyboard', 'Ctrl+V');
		notifyUserCommandInvocation('type', 'keyboard', 'A');
		commands.$setUserCommandObservation(false);
		notifyUserCommandInvocation('education.palette', 'commandPalette');
		commands.$setUserCommandObservation(true);
		commands.dispose();
		notifyUserCommandInvocation('education.palette', 'commandPalette');
		assert.deepStrictEqual(events, [
			{ commandId: 'education.palette', source: 'commandPalette', title: 'Example: Insert Numbers' },
			{ commandId: 'education.untitled', source: 'keyboard', shortcut: 'Ctrl+K Ctrl+I', title: 'education.untitled' },
			{ commandId: 'education.menuOnly', source: 'keyboard', shortcut: 'Ctrl+V', title: 'Menu Only' }
		]);
	});

	test('dispose on unregister', function () {

		const commands = new MainThreadCommands(SingleProxyRPCProtocol(null), undefined!, new class extends mock<IExtensionService>() { });
		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);

		// register
		commands.$registerCommand('foo');
		assert.ok(CommandsRegistry.getCommand('foo'));

		// unregister
		commands.$unregisterCommand('foo');
		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);

		commands.dispose();

	});

	test('unregister all on dispose', function () {

		const commands = new MainThreadCommands(SingleProxyRPCProtocol(null), undefined!, new class extends mock<IExtensionService>() { });
		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);

		commands.$registerCommand('foo');
		commands.$registerCommand('bar');

		assert.ok(CommandsRegistry.getCommand('foo'));
		assert.ok(CommandsRegistry.getCommand('bar'));

		commands.dispose();

		assert.strictEqual(CommandsRegistry.getCommand('foo'), undefined);
		assert.strictEqual(CommandsRegistry.getCommand('bar'), undefined);
	});

	test('activate and throw when needed', async function () {

		const activations: string[] = [];
		const runs: string[] = [];

		const commands = new MainThreadCommands(
			SingleProxyRPCProtocol(null),
			new class extends mock<ICommandService>() {
				override executeCommand<T>(id: string): Promise<T | undefined> {
					runs.push(id);
					return Promise.resolve(undefined);
				}
			},
			new class extends mock<IExtensionService>() {
				override activateByEvent(id: string) {
					activations.push(id);
					return Promise.resolve();
				}
			}
		);

		// case 1: arguments and retry
		try {
			activations.length = 0;
			await commands.$executeCommand('bazz', [1, 2, { n: 3 }], true);
			assert.ok(false);
		} catch (e) {
			assert.deepStrictEqual(activations, ['onCommand:bazz']);
			assert.strictEqual((<Error>e).message, '$executeCommand:retry');
		}

		// case 2: no arguments and retry
		runs.length = 0;
		await commands.$executeCommand('bazz', [], true);
		assert.deepStrictEqual(runs, ['bazz']);

		// case 3: arguments and no retry
		runs.length = 0;
		await commands.$executeCommand('bazz', [1, 2, true], false);
		assert.deepStrictEqual(runs, ['bazz']);

		commands.dispose();
	});
});
