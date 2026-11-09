# Installs the patched app.asar (launch splash) into DeepSeek Harness.
# Waits for every DeepSeek Harness process to exit first, backs up the original once, then swaps.
param(
  [string]$InstallDir = 'F:\DeepSeekHarness',
  [switch]$Relaunch
)
$ErrorActionPreference = 'Stop'
$res = Join-Path $InstallDir 'resources'
$target = Join-Path $res 'app.asar'
$backup = Join-Path $res 'app.asar.orig'
$patched = Join-Path $PSScriptRoot 'dist\app.asar'
$log = Join-Path $PSScriptRoot 'install-splash.log'
function Log($m) { "$(Get-Date -Format s) $m" | Tee-Object -FilePath $log -Append }

if (-not (Test-Path $patched)) { throw "patched asar missing: $patched" }
Log "waiting for DeepSeek Harness to exit..."
while (Get-Process | Where-Object { $_.Path -and $_.Path.StartsWith($InstallDir, 'OrdinalIgnoreCase') }) { Start-Sleep -Seconds 1 }
Start-Sleep -Seconds 1

if (-not (Test-Path $backup)) { Copy-Item $target $backup; Log "backup -> $backup" }
Copy-Item $patched $target -Force
Log "installed patched app.asar ($((Get-Item $target).Length) bytes)"

if ($Relaunch) {
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
  Start-Process (Join-Path $InstallDir 'DeepSeek Harness.exe')
  Log "relaunched"
}
