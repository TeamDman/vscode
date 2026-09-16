# Copyright (c) Microsoft Corporation. All rights reserved.
# Licensed under the MIT License. See LICENSE.txt in the project root.

param([switch]$InstallDependencies)
$ErrorActionPreference = 'Stop'
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$node = (Get-Command node -ErrorAction Stop).Source
$npm = (Get-Command npm.cmd -ErrorAction Stop).Source
function Invoke-Checked([string]$Executable, [string[]]$Arguments) {
	& $Executable @Arguments
	if ($LASTEXITCODE -ne 0) { throw "Build step failed with exit code $LASTEXITCODE" }
}
Push-Location $repo
try {
	if ($InstallDependencies) {
		# Keep setup scoped to the development build. The upstream root postinstall
		# also changes Git preferences and prepares remote/server workspaces.
		Invoke-Checked $npm @('ci', '--ignore-scripts', '--no-audit', '--no-fund')
		Invoke-Checked $npm @('--prefix', 'build', 'ci', '--ignore-scripts', '--no-audit', '--no-fund')
		Invoke-Checked $node @('build/npm/preinstall.ts')
		$dependencies = @((Get-Content package.json -Raw | ConvertFrom-Json).dependencies.PSObject.Properties.Name)
		Invoke-Checked $npm (@('rebuild', '--foreground-scripts') + $dependencies)
		$directoriesJson = & $node --input-type=module -e "import { dirs } from './build/npm/dirs.ts'; console.log(JSON.stringify(dirs.filter(dir => dir.startsWith('extensions') || dir.startsWith('.vscode/extensions'))));"
		if ($LASTEXITCODE -ne 0) { throw 'Could not read the bundled extension directory list' }
		foreach ($directory in ($directoriesJson | ConvertFrom-Json)) {
			$absolute = [IO.Path]::GetFullPath((Join-Path $repo $directory))
			if (-not $absolute.StartsWith($repo + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Unexpected dependency directory' }
			if (Test-Path -LiteralPath (Join-Path $absolute 'package-lock.json')) {
				Invoke-Checked $npm @('--prefix', $directory, 'ci', '--ignore-scripts', '--no-audit', '--no-fund')
			}
		}
	}
	Invoke-Checked $node @('build/npm/electronTypes.ts')
	Invoke-Checked $npm @('--prefix', 'extensions/copilot', 'run', 'postinstall')
	Invoke-Checked $npm @('run', 'gulp', '--', 'compile-api-proposal-names', 'copy-codicons', 'compile-extensions', 'compile-extension-media')
	Invoke-Checked $npm @('run', 'compile-copilot')
	Invoke-Checked $node @('node_modules/@typescript/native/lib/tsc.js', '--project', 'src/tsconfig.json', '--noEmit', '--skipLibCheck')
	Invoke-Checked $npm @('run', 'transpile-client')
	Invoke-Checked $npm @('run', 'electron')
	Invoke-Checked $npm @('--prefix', 'extensions/keyboard-shortcut-education', 'test')
	Write-Output 'Education development build is ready. Run scripts/code-education.ps1.'
} finally { Pop-Location }
