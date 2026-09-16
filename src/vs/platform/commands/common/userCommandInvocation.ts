/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter } from '../../../base/common/event.js';

/** A user initiation, never command arguments or successful-completion telemetry. */
export interface IUserCommandInvocation {
	readonly commandId: string;
	readonly source: 'keyboard' | 'commandPalette';
	readonly shortcut?: string;
}

// Process-local notifications only: no replay, persistence, or command history.
const emitter = new Emitter<IUserCommandInvocation>();
export const onDidInvokeUserCommand = emitter.event;

/** Called only by resolved keyboard dispatch and accepted Command Palette entries. */
export function notifyUserCommandInvocation(commandId: string, source: IUserCommandInvocation['source'], shortcut?: string): void {
	if (!emitter.hasListeners() || /^(type|replacePreviousChar|compositionStart|compositionEnd)$/.test(commandId)) {
		return;
	}
	emitter.fire(Object.freeze(source === 'keyboard' && shortcut ? { commandId, source, shortcut } : { commandId, source }));
}
