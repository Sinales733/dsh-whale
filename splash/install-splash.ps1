# Puts the launch splash into the DeepSeek Harness installed on this PC, whatever its release (Windows).
# The patch is made from the installed release itself (patch-app.mjs), run by DSH's own executable, so nothing else
# needs installing. Quit DSH first; the script waits for it. After a DSH update, run it again, or let the dsh-motion
# plugin do it for you.
#   .\install-splash.ps1                 find DSH and install
#   .\install-splash.ps1 -Relaunch       and open DSH afterwards
#   .\install-splash.ps1 -InstallDir D:\Apps\DeepSeekHarness
param(
  [string]$InstallDir,
  [switch]$Relaunch,
  [string]$Command = 'install'
)
$ErrorActionPreference = 'Stop'

if (-not $InstallDir) {
  $keys = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*', 'HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*'
  $InstallDir = Get-ItemProperty -Path $keys -ErrorAction SilentlyContinue |
    Where-Object { $_.DisplayName -like 'DeepSeek Harness*' -and $_.InstallLocation } |
    Select-Object -First 1 -ExpandProperty InstallLocation
}
$exe = if ($InstallDir) { Join-Path $InstallDir 'DeepSeek Harness.exe' }
if (-not $exe -or -not (Test-Path -LiteralPath $exe)) {
  throw 'DeepSeek Harness not found. Pass its folder: .\install-splash.ps1 -InstallDir <folder>'
}

$running = { Get-Process -Name 'DeepSeek Harness' -ErrorAction SilentlyContinue }
if ($Command -ne 'status' -and (& $running)) {
  Write-Host 'Quit DeepSeek Harness (including its tray icon); this continues as soon as it has closed...'
  while (& $running) { Start-Sleep -Seconds 1 }
  Start-Sleep -Seconds 1
}

# DSH's executable is a windowed program: Start-Process -Wait is what waits for it and collects its output.
$out = [System.IO.Path]::GetTempFileName()
$err = [System.IO.Path]::GetTempFileName()
$env:ELECTRON_RUN_AS_NODE = '1'
try {
  $script = Join-Path $PSScriptRoot 'patch-app.mjs'
  $p = Start-Process -FilePath $exe -ArgumentList "`"$script`"", $Command, '--dir', "`"$InstallDir`"" `
    -Wait -PassThru -NoNewWindow -RedirectStandardOutput $out -RedirectStandardError $err
} finally {
  Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
}
Get-Content -LiteralPath $out, $err -Encoding UTF8 | Where-Object { $_ } | ForEach-Object { Write-Host $_ }
Remove-Item -LiteralPath $out, $err -ErrorAction SilentlyContinue
if ($p.ExitCode -ne 0) { exit $p.ExitCode }

if ($Relaunch) { Start-Process -FilePath $exe }
