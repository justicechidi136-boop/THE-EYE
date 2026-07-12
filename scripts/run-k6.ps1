param(
  [string]$Script = "smoke.js",
  [string]$OutDir = "scripts/k6/results"
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$scriptPath = Join-Path $repoRoot "scripts/k6/$Script"

if (-not (Get-Command k6 -ErrorAction SilentlyContinue)) {
  Write-Error "k6 is not installed. See https://grafana.com/docs/k6/latest/set-up/install-k6/"
}

if (-not (Test-Path $scriptPath)) {
  Write-Error "Script not found: $scriptPath"
}

$envFile = Join-Path $repoRoot "scripts/k6/.env"
if (Test-Path $envFile) {
  Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*#' -or $_ -notmatch '=') { return }
    $name, $value = $_ -split '=', 2
    Set-Item -Path "env:$name" -Value $value
  }
}

New-Item -ItemType Directory -Force -Path (Join-Path $repoRoot $OutDir) | Out-Null
$timestamp = Get-Date -Format "yyyyMMdd-HHmmss"
$baseName = [IO.Path]::GetFileNameWithoutExtension($Script)
$summaryPath = Join-Path $repoRoot "$OutDir/$baseName-$timestamp.json"

Push-Location $repoRoot
try {
  k6 run --summary-export $summaryPath $scriptPath
  Write-Host "Summary exported to $summaryPath"
} finally {
  Pop-Location
}
