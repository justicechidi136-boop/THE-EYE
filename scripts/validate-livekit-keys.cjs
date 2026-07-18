const fs = require("fs");
const path = require("path");

/**
 * Validates LiveKit LIVEKIT_KEYS syntax: "keyName: secret" (space after colon required).
 */
function validateLivekitKeys(key, secret) {
  const errors = [];
  if (!key || typeof key !== "string" || !key.trim()) {
    errors.push("LIVEKIT_API_KEY is required");
  }
  if (!secret || typeof secret !== "string" || !secret.trim()) {
    errors.push("LIVEKIT_API_SECRET is required");
  }
  if (key && secret) {
    const formatted = `${key.trim()}: ${secret.trim()}`;
    if (!/^[^:]+: .+$/.test(formatted)) {
      errors.push("LIVEKIT_KEYS must use format 'keyName: secret' (space after colon)");
    }
    if (formatted.includes("\n") || formatted.includes(",")) {
      errors.push("LIVEKIT key/secret must not contain newlines or commas");
    }
  }
  return { ok: errors.length === 0, errors, formatted: key && secret ? `${key.trim()}: ${secret.trim()}` : "" };
}

function validateComposeLivekitKeys(composeText, livekitYamlText = "") {
  const errors = [];
  const keysLine = composeText
    .split("\n")
    .find((line) => line.trim().startsWith("LIVEKIT_KEYS:"));

  if (!keysLine) {
    errors.push("docker-compose livekit service must define LIVEKIT_KEYS");
    return errors;
  }

  if (!keysLine.includes("LIVEKIT_API_KEY") || !keysLine.includes("LIVEKIT_API_SECRET")) {
    errors.push("docker-compose livekit service must derive LIVEKIT_KEYS from LIVEKIT_API_KEY/SECRET");
  }

  if (!keysLine.includes(": ${LIVEKIT_API_SECRET")) {
    errors.push("LIVEKIT_KEYS line must reference LIVEKIT_API_SECRET with space after colon");
  }

  if (keysLine.includes("${LIVEKIT_API_KEY}:${LIVEKIT_API_SECRET")) {
    errors.push("LIVEKIT_KEYS must not use key:secret without space — LiveKit parse will fail");
  }

  if (/^keys:/m.test(livekitYamlText)) {
    errors.push("livekit.yaml must not define duplicate keys: — use LIVEKIT_KEYS env only");
  }

  return errors;
}

function main() {
  const root = path.join(__dirname, "..");
  const composePath = path.join(root, "infra", "docker", "docker-compose.yml");
  const livekitYamlPath = path.join(root, "infra", "docker", "livekit", "livekit.yaml");
  const compose = fs.readFileSync(composePath, "utf8");
  const livekitYaml = fs.readFileSync(livekitYamlPath, "utf8");

  const composeErrors = validateComposeLivekitKeys(compose, livekitYaml);
  const sample = validateLivekitKeys("ci_livekit_api_key_32_chars_minimum", "ci_livekit_api_secret_32_chars_minimum");

  if (composeErrors.length || !sample.ok) {
    console.error("LiveKit keys validation failed.");
    for (const err of composeErrors) console.error("-", err);
    if (!sample.ok) console.error("- sample:", sample.errors.join("; "));
    process.exit(1);
  }

  console.log("LiveKit keys validation passed.");
}

if (require.main === module) {
  main();
}

module.exports = { validateLivekitKeys, validateComposeLivekitKeys };
