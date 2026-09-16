# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.txt in the project root.

param(
	[string]$DataDirectory = (Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'CodeOSS-Education'),
	[string]$ExtensionsDirectory,
	[string]$OpenFile
)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$exe = Join-Path $repo '.build/electron/Code - OSS.exe'
if (-not (Test-Path -LiteralPath $exe) -or -not (Test-Path -LiteralPath (Join-Path $repo 'out/main.js'))) { throw 'Build output is missing. Run scripts/build-education.ps1 first.' }
$data = [IO.Path]::GetFullPath($DataDirectory)
$profile = Join-Path $data 'profile'
if (-not $ExtensionsDirectory) { $ExtensionsDirectory = Join-Path $data 'extensions' }
New-Item -ItemType Directory -Force -Path (Join-Path $profile 'User'), $ExtensionsDirectory | Out-Null
$settingsFile = Join-Path $profile 'User/settings.json'
if (-not (Test-Path -LiteralPath $settingsFile)) {
	@{
		'window.title' = 'Code - OSS Education'
		'workbench.startupEditor' = 'none'
		'workbench.secondarySideBar.defaultVisibility' = 'hidden'
		'telemetry.telemetryLevel' = 'off'
		'update.mode' = 'none'
		'extensions.autoUpdate' = 'off'
		'workbench.commandPalette.history' = 0
		'workbench.commandPalette.preserveInput' = $false
	} | ConvertTo-Json | Set-Content -LiteralPath $settingsFile
}
$environmentNames = @('NODE_ENV','VSCODE_DEV','VSCODE_CLI','VSCODE_PORTABLE')
$previous = @{}
foreach ($name in $environmentNames) { $previous[$name] = [Environment]::GetEnvironmentVariable($name, 'Process') }
try {
	$env:NODE_ENV = 'development'
	$env:VSCODE_DEV = '1'
	$env:VSCODE_CLI = '1'
	$env:VSCODE_PORTABLE = Join-Path $data 'portable'
	$launchArgs = @('.', ('--user-data-dir=' + $profile), ('--shared-data-dir=' + (Join-Path $data 'shared')), ('--extensions-dir=' + [IO.Path]::GetFullPath($ExtensionsDirectory)), '--new-window', '--skip-welcome', '--skip-release-notes', '--disable-telemetry', '--disable-extension=vscode.vscode-api-tests', '--disable-extension=vscode.vscode-colorize-tests', '--disable-extension=vscode.vscode-colorize-perf-tests', '--disable-extension=vscode.vscode-test-resolver')
	if ($OpenFile) { $launchArgs += [IO.Path]::GetFullPath($OpenFile) }
	foreach ($argument in $launchArgs) { if ($argument.Contains('"')) { throw 'A launch path cannot contain a quotation mark' } }
	$quotedArgs = $launchArgs | ForEach-Object { '"' + $_ + '"' }
	$process = Start-Process -FilePath $exe -ArgumentList $quotedArgs -WorkingDirectory $repo -WindowStyle Hidden -PassThru
	Write-Output ('Started Code - OSS Education; PID ' + $process.Id)
} finally {
	foreach ($name in $environmentNames) { [Environment]::SetEnvironmentVariable($name, $previous[$name], 'Process') }
}
