# Restores the original app.asar (removes the launch splash). Quit DeepSeek Harness first.
param([string]$InstallDir = 'F:\DeepSeekHarness')
$ErrorActionPreference = 'Stop'
$res = Join-Path $InstallDir 'resources'
if (Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($InstallDir, 'OrdinalIgnoreCase') }) { throw 'Quit DeepSeek Harness first.' }
Copy-Item (Join-Path $res 'app.asar.orig') (Join-Path $res 'app.asar') -Force
Write-Host 'Original app.asar restored.'
