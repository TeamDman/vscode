/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

declare module 'vscode' {
	/** Static presentation metadata for a user-invoked command in this window. */
	export interface UserCommandInvocation {
		readonly commandId: string;
		/** Registered title, or the command ID when no title is registered. */
		readonly title: string;
		// Keep the serialized source tags shared with the internal invocation event.
		// eslint-disable-next-line local/vscode-dts-literal-or-types, local/vscode-dts-string-type-literals
		readonly source: 'keyboard' | 'commandPalette';
		/** The actual resolved shortcut, including chords. Absent for palette actions. */
		readonly shortcut?: string;
	}
	export namespace commands {
		/**
		 * Fires when a user invokes a resolved keyboard binding or accepts a Command
		 * Palette command. It does not indicate successful completion. Programmatic
		 * commands, arguments, typed text, dynamic pick labels and history are excluded.
		 * Observation lasts only while listeners exist; there is no replay.
		 */
		export const onDidInvokeUserCommand: Event<UserCommandInvocation>;
	}
}
