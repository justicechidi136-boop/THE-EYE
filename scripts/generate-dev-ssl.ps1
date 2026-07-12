param(
  [string]$ServerName = "localhost",
  [int]$DaysValid = 365
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$certDir = Join-Path $repoRoot "infra/docker/nginx/certs/live"
New-Item -ItemType Directory -Force -Path $certDir | Out-Null

$openssl = Get-Command openssl -ErrorAction SilentlyContinue
if (-not $openssl) {
  Write-Error "openssl is required. Install OpenSSL or use Git for Windows openssl."
}

$keyPath = Join-Path $certDir "privkey.pem"
$certPath = Join-Path $certDir "fullchain.pem"

if ((Test-Path $keyPath) -or (Test-Path $certPath)) {
  Write-Host "Certificates already exist in $certDir"
  Write-Host "Delete them first to regenerate."
  exit 0
}

$subject = "/CN=$ServerName/O=THE EYE Dev/C=NG"
& openssl req -x509 -nodes -days $DaysValid -newkey rsa:2048 `
  -keyout $keyPath `
  -out $certPath `
  -subj $subject

Write-Host "Self-signed certificate created:"
Write-Host "  $certPath"
Write-Host "  $keyPath"
Write-Host ""
Write-Host "Set in .env for local HTTPS:"
Write-Host "  THE_EYE_SERVER_NAME=$ServerName"
Write-Host "  THE_EYE_SSL_REDIRECT=false"
Write-Host "  THE_EYE_GENERATE_DEV_SSL=false"
