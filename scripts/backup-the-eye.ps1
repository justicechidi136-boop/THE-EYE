param(
  [string]$BackupDir = "backups",
  [string]$ComposeFile = "infra/docker/docker-compose.yml",
  [string]$PostgresUser = $env:POSTGRES_USER,
  [string]$PostgresDb = $env:POSTGRES_DB
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $repoRoot $ComposeFile

if (-not $PostgresUser) { $PostgresUser = "the_eye" }
if (-not $PostgresDb) { $PostgresDb = "the_eye" }

if (-not (Test-Path $composePath)) {
  throw "Compose file not found: $composePath"
}

$timestamp = Get-Date -Format "yyyyMMdd_HHmmss"
$backupRoot = Join-Path $repoRoot $BackupDir
$backupFile = Join-Path $backupRoot "the_eye_$timestamp.dump"

New-Item -ItemType Directory -Force -Path $backupRoot | Out-Null

Write-Host "Creating PostgreSQL backup at $backupFile"
Push-Location $repoRoot
try {
  docker compose -f $ComposeFile ps postgres-postgis --status running -q 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "postgres-postgis is not running. Start the stack before backing up."
  }

  docker compose -f $ComposeFile exec -T postgres-postgis `
    pg_dump -U $PostgresUser -Fc $PostgresDb -f /tmp/the_eye_backup.dump
  if ($LASTEXITCODE -ne 0) { throw "pg_dump failed with exit code $LASTEXITCODE" }

  docker compose -f $ComposeFile cp "postgres-postgis:/tmp/the_eye_backup.dump" $backupFile
  if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

$latest = Join-Path $backupRoot "the_eye_latest.dump"
Copy-Item -Force $backupFile $latest
Write-Host "Backup complete: $backupFile"
Write-Host "Latest copy: $latest"
Write-Host "Note: object storage (MinIO/S3) requires separate bucket backup/versioning."
