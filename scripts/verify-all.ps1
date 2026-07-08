$ErrorActionPreference = "Continue"

$root = Split-Path -Parent $PSScriptRoot
$reportDir = Join-Path $root "docs"
$reportPath = Join-Path $reportDir "test-report.md"
$results = New-Object System.Collections.Generic.List[object]

function Run-Check {
  param(
    [string]$Name,
    [string]$Command
  )

  Write-Host "Running $Name..."
  $started = Get-Date
  $output = ""
  $exitCode = 0
  try {
    $output = Invoke-Expression "$Command 2>&1" | Out-String
    $exitCode = $LASTEXITCODE
    if ($null -eq $exitCode) { $exitCode = 0 }
  } catch {
    $output = $_ | Out-String
    $exitCode = 1
  }
  $duration = [Math]::Round(((Get-Date) - $started).TotalSeconds, 2)
  $status = if ($exitCode -eq 0) { "PASS" } else { "FAIL" }
  $results.Add([pscustomobject]@{ Name = $Name; Status = $status; ExitCode = $exitCode; Duration = $duration; Output = $output.Trim() })
}

Run-Check "Install dependencies" "pnpm install"
Run-Check "Lint" "pnpm run lint"
Run-Check "TypeScript checks" "pnpm -r run lint"
Run-Check "Backend tests" "pnpm run test:backend"
Run-Check "Mobile smoke tests" "pnpm run test:mobile:smoke"
Run-Check "Backend API build" "pnpm --filter @the-eye/api run build"
Run-Check "Admin dashboard build" "pnpm --filter @the-eye/admin-web run build"
Run-Check "Admin build smoke" "pnpm run test:admin:smoke"
Run-Check "Docker Compose config" "docker compose -f infra/docker/docker-compose.yml config"
Run-Check "Docker Compose startup" "docker compose -f infra/docker/docker-compose.yml up -d --wait --wait-timeout 60; `$code=`$LASTEXITCODE; docker compose -f infra/docker/docker-compose.yml down; exit `$code"
Run-Check "Docker Compose smoke" "pnpm run test:docker:smoke"

$lines = New-Object System.Collections.Generic.List[string]
$lines.Add("# THE EYE Test Report")
$lines.Add("")
$lines.Add("Generated: $(Get-Date -Format s)")
$lines.Add("")
$lines.Add("| Check | Status | Exit | Seconds |")
$lines.Add("| --- | --- | ---: | ---: |")
foreach ($result in $results) {
  $lines.Add("| $($result.Name) | $($result.Status) | $($result.ExitCode) | $($result.Duration) |")
}
$lines.Add("")
foreach ($result in $results) {
  $lines.Add("## $($result.Name)")
  $lines.Add("")
  $lines.Add("Status: $($result.Status)")
  $lines.Add("")
  $lines.Add('```text')
  $lines.Add($result.Output)
  $lines.Add('```')
  $lines.Add("")
}

Set-Content -Path $reportPath -Value $lines -Encoding UTF8
Write-Host "Report written to $reportPath"

if ($results.Where({ $_.Status -eq "FAIL" }).Count -gt 0) {
  exit 1
}
