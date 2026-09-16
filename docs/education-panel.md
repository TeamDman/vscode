# Keyboard Shortcut Education Panel

Open a text editor, then run **Keyboard Shortcut Education Panel: Open** from the Command Palette. The panel opens beside your editor and keeps a history of the commands you invoke, newest first.

## Use the panel

| Action | Result |
| --- | --- |
| Keyboard shortcut | Shows the registered title, command ID and the actual keys used, including chords |
| Command Palette action | Shows the registered title, command ID and “Command Palette” |
| Left-click a card or press Enter on it | Copies that action as Discord-ready text, including older entries |
| Right-click the panel | Changes style and copies the new style name, ID and description |
| Press Space while the panel has focus | Changes style without replacing the clipboard |
| Clear, or the Clear History command | Empties the history |

Run **Keyboard Shortcut Education Panel: Set Style** to choose Toast, Keycaps or Terminal. **Next Style** cycles through them. The style name, hint and Clear button appear when you hover over the panel or focus it. They disappear when neither condition applies.

The panel updates immediately when a command is invoked. It does not wait for the command to finish. A command that opens a prompt appears before you answer that prompt. A missing registered title falls back to the command ID.

Follow-up prompt actions remain separate entries. For example, choosing Text Power Tools: Insert decimal number sequence and pressing Enter in its prompt leaves the Quick Pick acceptance above the original palette action. Repeated invocations are retained. Scroll down to review earlier actions; the Clear control stays at the top. Clear or closing the panel removes the history. Run **Keyboard Shortcut Education Panel: Clear History** to clear it from the palette or a user-assigned shortcut.

## Build and launch on Windows

This branch targets stable VS Code **1.137.0**, commit `645f29cc3176500b4b5762ba887cf2a7f0ffdf2c`. It produces a development build of Code - OSS. The panel uses a custom proposed API and requires this source change.

Prerequisites are Node.js 24.18.0 or a newer release in the same major version, npm below 13, Python and the VS 2022 C++ toolchain. The tested setup used Node 24.19.0, npm 10.9.4, Python 3.12.14 and MSVC 14.44.35207. Install the matching x64/x86 Spectre libraries and ATL Spectre libraries through Visual Studio Installer. The [upstream contribution guide](https://github.com/microsoft/vscode/wiki/How-to-Contribute) describes the general build prerequisites.

From the repository root, with `node`, `npm.cmd`, `python` and Git available on PATH:

```powershell
# First setup, or after changing package locks. Close this checkout's running
# Code - OSS and build watchers before replacing dependencies.
./scripts/build-education.ps1 -InstallDependencies

# Later builds reuse installed dependencies.
./scripts/build-education.ps1

# Launch with a separate education profile.
./scripts/code-education.ps1
```

Set `PYTHON` and `NODE_GYP_FORCE_PYTHON` to your Python executable if a Windows Store alias is selected instead. The build script installs locked JavaScript packages, then runs the required native and asset build steps explicitly. It leaves Git preferences alone and prepares the desktop development targets. Remote-server packaging is outside this build.

The launcher stores its profile under the local application data folder in `CodeOSS-Education`. Pass `-DataDirectory`, `-ExtensionsDirectory` or `-OpenFile` to use other locations. It does not use your regular VS Code profile. The first launch disables telemetry, updates and Command Palette history in this separate profile.

Text Power Tools is a separate extension. Install a compatible VSIX in Code - OSS, or point `-ExtensionsDirectory` at a dedicated directory containing your existing installation. Verification used `qcz.text-power-tools` 1.51.0.

## Search and install extensions

A source build has no extension gallery by default. Installed-extension filtering works, but online search needs a gallery configuration. The education build can use [Open VSX](https://github.com/eclipse-openvsx/openvsx/wiki/Using-Open-VSX-in-VS-Code).

To enable online search in a development checkout, merge this into the local, Git-ignored `product.overrides.json` in the repository root:

```json
{
  "extensionsGallery": {
    "serviceUrl": "https://open-vsx.org/vscode/gallery",
    "itemUrl": "https://open-vsx.org/vscode/item",
    "resourceUrlTemplate": "https://open-vsx.org/vscode/unpkg/{publisher}/{name}/{version}/{path}",
    "extensionUrlTemplate": "https://open-vsx.org/vscode/gallery/{publisher}/{name}/latest"
  }
}
```

Fully quit and relaunch the education app after changing this file. Reload Window alone does not reload the main process's product configuration. No rebuild is needed. Open VSX has its own catalog; some Microsoft Marketplace extensions may be absent.

IntelliJ IDEA Keybindings (`k--kato.intellij-idea-keybindings`) 1.7.7 was installed into the isolated education extension directory through the normal CLI installer. The Open VSX search endpoint returned the same extension. Its Alt+J and Ctrl+Shift+Alt+J bindings invoke the original editor commands and are observed by the panel.

This development build does not include the optional `@vscode/vsce-sign` package. The installer reported that signature verification was not performed; installation completed through the upstream development-build path.

## Edit and check

The core hook lives in `src/vs/platform/commands/common/userCommandInvocation.ts`, keyboard dispatch and the Command Palette acceptance handler. Main-thread command code resolves registered titles and forwards a safe event through the opt-in `userCommandInvocation` proposed API. The bundled extension lives in `extensions/keyboard-shortcut-education`.

For fast core iteration:

```powershell
npm run watch-client-transpile
```

For panel TypeScript changes:

```powershell
npm run gulp -- compile-extension:keyboard-shortcut-education
```

Reload the Code - OSS window after changing extension code. Closing and reopening the panel refreshes webview media changes. The measured one-file core output update was 248 milliseconds; window reload was about 3 seconds.

Focused checks:

```powershell
./scripts/test.bat --run src/vs/platform/keybinding/test/common/abstractKeybindingService.test.ts --run src/vs/workbench/api/test/browser/mainThreadCommands.test.ts
npm --prefix extensions/keyboard-shortcut-education test
# Requires the Playwright Chromium browser installed for this checkout.
npm --prefix extensions/keyboard-shortcut-education run test:browser
npm run valid-layers-check
```

## Data and behavior boundaries

The feature observes resolved keyboard commands and accepted Command Palette entries. It does not rewrite bindings or intercept every programmatic command. It reads registered command metadata, not dynamic palette search labels.

The event contains only `commandId`, `title`, `source` and an optional `shortcut`. The panel retains an action history in memory while open, including while its tab is hidden. Clear removes all entries. Closing the panel clears the history and removes its listener; reopening starts empty. It does not read typed text, command arguments, editor contents or clipboard contents. It writes to the clipboard only for explicit copy gestures. History is not saved to disk or restored after a window reload.

Panel control commands do not become history entries. Each card copies its own action, even if another action arrives before it is clicked. Existing VS Code behavior outside this feature still follows its own settings. No Marketplace release or upstream API compatibility is implied.

## Verified build results

The core typecheck, bundled extension and media compilation, Copilot compilation, module-layer checks and targeted lint checks passed. The keyboard and bridge suites passed 28 tests; the history panel passed 7 contract and formatting tests plus 2 browser tests covering 18 style/width/theme combinations. The history update includes regression checks for palette/prompt ordering, per-card copying, clearing, stale copy requests and disposal. Browser checks exercise the compiled panel for hover/focus controls, Space/Enter behavior, focus preservation and scrolling.

Desktop verification covered the original editor shortcuts and `textPowerTools.insertDecimalNumbers` from the palette. Text Power Tools inserted 1, 2 and 3 at three cursors while the panel showed the exact title and command ID without a shortcut. Left-click copy and right-click style-and-copy both completed in the running panel.

The required runtime dependency rebuild completed in about 3 minutes 9 seconds. The optional SSH crypto accelerator failed to compile; its installer retained the JavaScript fallback. Bundled extension and media compilation took about 21 seconds including task startup. These are local measurements, not a promise for other machines.
