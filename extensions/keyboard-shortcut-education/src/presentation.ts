/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import type { UserCommandInvocation } from 'vscode';

export const styles = [
	{ id: 'toast', name: 'Toast', description: 'Compact left-aligned card. Action title leads, shortcut below, command ID and source in quieter text.' },
	{ id: 'keycaps', name: 'Keycaps', description: 'Centered card with a large shortcut badge, action title underneath, and compact command ID and source.' },
	{ id: 'terminal', name: 'Terminal', description: 'Plain left-aligned monospace card with a slim accent rule. Action title, shortcut, command ID and source form a compact stack.' }
] as const;

/** Escape untrusted static metadata so Discord does not interpret mentions or markup. */
function discordText(value: string): string {
	return value.replace(/[\r\n]/g, ' ').replace(/([\\`*_~|>])/g, '\\$1').replace(/@/g, '@\u200b');
}

export function describeAction(action: UserCommandInvocation): string {
	const source = action.source === 'commandPalette' ? 'Command Palette' : `Keyboard${action.shortcut ? `: ${action.shortcut}` : ''}`;
	return `${discordText(action.title)}\n${discordText(action.commandId)}\n${discordText(source)}`;
}

export function describeStyle(style: typeof styles[number]): string {
	return `Keyboard Shortcut Education Panel \u2014 ${style.name} (${style.id})\n${style.description}`;
}
