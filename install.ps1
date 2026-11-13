# Installs the Hermes usage-meter desktop plugin for the current Windows user.
# No admin rights, packages, API keys or network access are needed.
[CmdletBinding()]
param(
  [string]$HermesHome = $(if ($env:HERMES_HOME) { $env:HERMES_HOME } else { Join-Path $env:LOCALAPPDATA 'hermes' }),
  [string]$Name = 'hermes-usage-meter'
)
$ErrorActionPreference = 'Stop'

$source = Join-Path $PSScriptRoot 'desktop\plugin.js'
if (-not (Test-Path -LiteralPath $source -PathType Leaf)) { throw "Missing $source" }
if ($Name -notmatch '^[A-Za-z0-9][A-Za-z0-9._-]*$') { throw "Invalid folder name: $Name" }

$root = Join-Path $HermesHome 'desktop-plugins'
# An earlier manual copy may live in 'usage-meter'. Update it in place instead of
# installing a second copy with the same plugin id.
$legacy = Join-Path $root 'usage-meter\plugin.js'
if ($Name -eq 'hermes-usage-meter' -and (Test-Path -LiteralPath $legacy) -and
    (Select-String -LiteralPath $legacy -Pattern "id:'usage-meter'" -SimpleMatch -Quiet)) {
  $Name = 'usage-meter'
}

$targetDir = Join-Path $root $Name
$target = Join-Path $targetDir 'plugin.js'
New-Item -ItemType Directory -Force -Path $targetDir | Out-Null

if (Test-Path -LiteralPath $target) {
  $stamp = Get-Date -Format 'yyyyMMdd-HHmmss'
  Copy-Item -LiteralPath $target -Destination (Join-Path $targetDir "plugin.backup-$stamp.js")
}

# Stage then rename, so the running app never hot-reloads a half-written file.
$staged = Join-Path $targetDir ".plugin.$PID.tmp"
Copy-Item -LiteralPath $source -Destination $staged -Force
Move-Item -LiteralPath $staged -Destination $target -Force

$want = (Get-FileHash -LiteralPath $source -Algorithm SHA256).Hash
$got = (Get-FileHash -LiteralPath $target -Algorithm SHA256).Hash
if ($want -ne $got) { throw "Copy verification failed for $target" }

Write-Host "Installed: $target"
Write-Host "SHA256:    $got"
Write-Host 'Hermes Desktop reloads disk plugins automatically. If the widget does not appear, use Plugins > Reload.'
