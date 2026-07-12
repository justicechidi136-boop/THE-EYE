param(
  [Parameter(Mandatory = $true)]
  [string]$BackupFile,
  [switch]$Confirm,
  [string]$ComposeFile = "infra/docker/docker-compose.yml",
  [string]$PostgresUser = $env:POSTGRES_USER,
  [string]$PostgresDb = $env:POSTGRES_DB
)

$ErrorActionPreference = "Stop"
$repoRoot = Split-Path -Parent $PSScriptRoot
$composePath = Join-Path $repoRoot $ComposeFile
$backupPath = if ([IO.Path]::IsPathRooted($BackupFile)) { $BackupFile } else { Join-Path $repoRoot $BackupFile }

if (-not $PostgresUser) { $PostgresUser = "the_eye" }
if (-not $PostgresDb) { $PostgresDb = "the_eye" }

if (-not (Test-Path $backupPath)) {
  throw "Backup file not found: $backupPath"
}

if (-not $Confirm) {
  Write-Host "Restore will overwrite data in database '$PostgresDb'. Re-run with -Confirm to proceed."
  exit 1
}

Write-Host "Restoring PostgreSQL from $backupPath"
Push-Location $repoRoot
try {
  docker compose -f $ComposeFile ps postgres-postgis --status running -q 2>$null | Out-Null
  if ($LASTEXITCODE -ne 0) {
    throw "postgres-postgis is not running. Start the stack before restoring."
  }

  docker compose -f $ComposeFile cp $backupPath "postgres-postgis:/tmp/the_eye_restore.dump"
  if ($LASTEXITCODE -ne 0) { throw "docker compose cp failed with exit code $LASTEXITCODE" }

  docker compose -f $ComposeFile exec -T postgres-postgis `
    pg_restore -U $PostgresUser -d $PostgresDb --clean --if-exists /tmp/the_eye_restore.dump
  if ($LASTEXITCODE -ne 0) { throw "pg_restore failed with exit code $LASTEXITCODE" }
} finally {
  Pop-Location
}

Write-Host "Restore complete."
Write-Host "Next steps:"
Write-Host "  1. docker compose -f $ComposeFile --profile tools run api-migrate"
Write-Host "  2. curl http://localhost/v1/health/ready (or https://your-host/v1/health/ready)"
