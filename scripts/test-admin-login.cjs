const fs = require("fs");
const path = require("path");

const envPath = path.join(__dirname, "..", "apps", "api", ".env");

function parseEnv(filePath) {
  const values = {};
  if (!fs.existsSync(filePath)) return values;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

async function main() {
  const env = parseEnv(envPath);
  const email = env.ADMIN_EMAIL ?? "dev-admin@theeye.local";
  const password = env.ADMIN_PASSWORD ?? "change_me_dev_admin_password";

  const response = await fetch("http://localhost:4000/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ email, password, admin: true }),
  });

  if (!response.ok) {
    const body = await response.text();
    console.error(`Admin login test failed (${response.status}): ${body}`);
    process.exit(1);
  }

  const payload = await response.json();
  console.log(`Admin login test passed for ${email} (role: ${payload.user?.role ?? "unknown"})`);
}

main().catch((error) => {
  console.error(`Admin login test failed: ${error.message}`);
  process.exit(1);
});
