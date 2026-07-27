param(
  [string]$BackupDir = "backups",
  [string]$ComposeFile = "infra/docker/docker-compose.yml",
  [string]$EnvFile = ".env",
  [string]$PostgresUser = $env:POSTGRES_USER,
  [string]$PostgresDb = $env:POSTGRES_DB,
  [string]$ProjectName = $env:COMPOSE_PROJECT_NAME
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $repoRoot $ComposeFile
$envPath = Join-Path $repoRoot $EnvFile
$environment = if ($env:THE_EYE_APP_ENV) { $env:THE_EYE_APP_ENV } else { "staging" }

if (-not $PostgresUser) { $PostgresUser = "the_eye" }
if (-not $PostgresDb) { $PostgresDb = "the_eye" }

function Invoke-Compose {
  param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Args)
  $base = @("compose", "-f", $composePath, "--env-file", $envPath)
  if ($ProjectName) { $base += @("--project-name", $ProjectName) }
  & docker @base @Args
  if ($LASTEXITCODE -ne 0) { throw "docker compose failed with exit code $LASTEXITCODE" }
}

if (-not (Test-Path $composePath)) { throw "BACKUP-003: Compose file not found: $composePath" }
if (-not (Test-Path $envPath)) { throw "BACKUP-004: Environment file not found: $envPath" }

$timestamp = Get-Date -Format "yyyyMMddTHHmmssZ"
$backupRoot = Join-Path $repoRoot $BackupDir
$tempFile = Join-Path $backupRoot ".the-eye-$environment-$timestamp.tmp.dump"
$backupFile = Join-Path $backupRoot "the-eye-$environment-$timestamp.dump"

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Write-Host "Creating PostgreSQL backup at $backupFile"
Push-Location $repoRoot
try {
  $containerId = Invoke-Compose ps --status running -q postgres-postgis
  if (-not $containerId) {
    throw "BACKUP-006: postgres-postgis is not running. Start the stack before backing up."
  }

  $resolvedUser = (Invoke-Compose exec -T postgres-postgis printenv POSTGRES_USER).Trim()
  $resolvedDb = (Invoke-Compose exec -T postgres-postgis printenv POSTGRES_DB).Trim()
  if ($resolvedUser) { $PostgresUser = $resolvedUser }
  if ($resolvedDb) { $PostgresDb = $resolvedDb }

  $pgDump = Invoke-Compose exec -T postgres-postgis pg_dump -U $PostgresUser -Fc $PostgresDb --file -
  [System.IO.File]::WriteAllBytes($tempFile, [System.Text.Encoding]::GetEncoding(28591).GetBytes($pgDump))
  if (-not (Test-Path $tempFile) -or (Get-Item $tempFile).Length -eq 0) {
    throw "BACKUP-008: pg_dump produced an empty backup file."
  }

  Move-Item -Force $tempFile $backupFile
  $hash = (Get-FileHash -Algorithm SHA256 $backupFile).Hash.ToLowerInvariant()
  $meta = @{
    environment = $environment
    createdAt = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    databaseName = $PostgresDb
    sha256 = $hash
    backupFormat = "pg_dump-custom"
    scriptVersion = "2.0.0"
    validationResult = "archive-not-validated-on-windows"
  } | ConvertTo-Json -Depth 4
  Set-Content -Path ($backupFile -replace '\.dump$','.json') -Value $meta -Encoding UTF8

  Copy-Item -Force $backupFile (Join-Path $backupRoot "the-eye-$environment-latest.dump")
  Copy-Item -Force $backupFile (Join-Path $backupRoot "the_eye_latest.dump")
} finally {
  if (Test-Path $tempFile) { Remove-Item -Force $tempFile }
  Pop-Location
}

Write-Host "Backup complete: $backupFile"
Write-Host "SHA-256: $hash"
Write-Host "Note: object storage (MinIO/S3) requires separate bucket backup/versioning."
