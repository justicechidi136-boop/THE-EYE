# Materialize the dedicated staging release keystore for local APK builds.
# Does not print passwords or Base64 payload.
#
# Preferred: export THE_EYE_STAGING_KEYSTORE_PATH and related env vars directly.
# Alternative: set STAGING_ANDROID_KEYSTORE_BASE64 (and password env vars) then run this script.

$ErrorActionPreference = "Stop"

function Require-Env([string]$Name) {
    $value = [Environment]::GetEnvironmentVariable($Name, "Process")
    if (-not $value) {
        $value = [Environment]::GetEnvironmentVariable($Name, "User")
    }
    if (-not $value) {
        throw "Missing required environment variable: $Name"
    }
    return $value
}

if (-not $env:THE_EYE_STAGING_KEYSTORE_PATH) {
    $base64 = Require-Env "STAGING_ANDROID_KEYSTORE_BASE64"
    $keystorePath = Join-Path $env:TEMP "the-eye-staging-release.jks"
    [IO.File]::WriteAllBytes($keystorePath, [Convert]::FromBase64String($base64))
    $env:THE_EYE_STAGING_KEYSTORE_PATH = $keystorePath
    Write-Host "Materialized staging keystore to temporary path (not printed)."
}

$env:THE_EYE_STAGING_KEYSTORE_PASSWORD = Require-Env "STAGING_ANDROID_KEYSTORE_PASSWORD"
$env:THE_EYE_STAGING_KEY_ALIAS = Require-Env "STAGING_ANDROID_KEY_ALIAS"
$env:THE_EYE_STAGING_KEY_PASSWORD = Require-Env "STAGING_ANDROID_KEY_PASSWORD"

Write-Host "Staging signing environment configured (values not printed)."
