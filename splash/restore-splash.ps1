# Takes the launch splash out again: puts this DSH release's original app.asar back. Quit DSH first; the script waits.
# It refuses when the kept original belongs to another DSH release, so it can never roll DSH back.
param([string]$InstallDir, [switch]$Relaunch)
& (Join-Path $PSScriptRoot 'install-splash.ps1') -InstallDir $InstallDir -Relaunch:$Relaunch -Command restore
exit $LASTEXITCODE
