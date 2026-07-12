const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const { Client } = require(path.join(root, "apps", "api", "node_modules", "pg"));

const envPath = path.join(root, "apps", "api", ".env");

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

function parseDatabaseUrl(url) {
  const parsed = new URL(url);
  return {
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    database: parsed.pathname.replace(/^\//, "").split("?")[0] || "postgres",
  };
}

async function tryConnect(label, config) {
  const client = new Client({
    host: config.host,
    port: config.port,
    user: config.user,
    password: config.password,
    database: config.database,
    connectionTimeoutMillis: 5000,
  });
  try {
    await client.connect();
    await client.query("SELECT 1");
    console.log(`OK: ${label}`);
    return true;
  } catch (error) {
    console.log(`FAIL: ${label} -> ${error.code || error.message}`);
    return false;
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function main() {
  const env = parseEnv(envPath);
  if (!env.DATABASE_URL) {
    console.error("DATABASE_URL missing in apps/api/.env");
    process.exit(1);
  }

  const base = parseDatabaseUrl(env.DATABASE_URL);
  const attempts = [
    ["configured database", base],
    ["postgres maintenance db", { ...base, database: "postgres" }],
    ["unencoded password", { ...base, password: env.DATABASE_URL.match(/:\/\/([^:]+):([^@]+)@/)?.[2] ?? base.password }],
  ];

  for (const [label, config] of attempts) {
    const ok = await tryConnect(label, config);
    if (ok) {
      if (label !== "configured database") {
        console.log("Hint: credentials work, but the configured database name may be missing.");
        console.log("Create it with: CREATE DATABASE the_eye;");
      }
      process.exit(0);
    }
  }

  console.log("No connection attempt succeeded. Update apps/api/.env with the correct Postgres user/password.");
  process.exit(1);
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
