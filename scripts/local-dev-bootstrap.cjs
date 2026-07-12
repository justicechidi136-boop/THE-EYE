const fs = require("fs");
const path = require("path");
const { spawnSync } = require("child_process");

const root = path.join(__dirname, "..");
const apiEnvPath = path.join(root, "apps", "api", ".env");

function parseEnv(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
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

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, stdio: "pipe", encoding: "utf8", shell: process.platform === "win32" });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function probePort(port) {
  const result = run("powershell", [
    "-NoProfile",
    "-Command",
    `(Test-NetConnection -ComputerName localhost -Port ${port} -WarningAction SilentlyContinue).TcpTestSucceeded`,
  ]);
  return result.stdout.trim().toLowerCase() === "true";
}

const env = parseEnv(apiEnvPath);
const failures = [];
const notes = [];

if (!fs.existsSync(apiEnvPath)) {
  failures.push("Missing apps/api/.env — copy apps/api/.env.example and set DATABASE_URL.");
}

if (!env.DATABASE_URL) {
  failures.push("DATABASE_URL is not set in apps/api/.env.");
}

if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
  failures.push("ADMIN_EMAIL and ADMIN_PASSWORD must be set in apps/api/.env.");
}

const prismaStatus = run("npx", ["prisma", "migrate", "status"], path.join(root, "apps", "api"));
if (!prismaStatus.ok) {
  failures.push("Database connection failed. Fix DATABASE_URL in apps/api/.env.");
  if (prismaStatus.stderr.includes("P1000") || prismaStatus.stdout.includes("P1000")) {
    notes.push("Postgres rejected the credentials. URL-encode special characters in the password (e.g. $ -> %24).");
  }
  if (prismaStatus.stderr.includes("P1003") || prismaStatus.stdout.includes("P1003")) {
    notes.push("Database does not exist. Create it, then run: npx prisma migrate deploy");
  }
} else {
  const createAdmin = run("pnpm", ["run", "db:create-admin"], path.join(root, "apps", "api"));
  if (!createAdmin.ok) {
    failures.push("Could not create/update the dev admin user.");
  } else {
    notes.push(`Dev admin ready: ${env.ADMIN_EMAIL}`);
  }
}

const apiUp = probePort(4000);
const adminUp = probePort(3000);
if (!apiUp) notes.push("API is not listening on port 4000. Run: pnpm --filter @the-eye/api run start:dev");
if (!adminUp) notes.push("Admin web is not listening on port 3000. Run: pnpm --filter @the-eye/admin-web run dev");

if (failures.length) {
  console.error("Local dev bootstrap failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  if (notes.length) {
    console.error("");
    console.error("Notes:");
    for (const note of notes) console.error(`- ${note}`);
  }
  process.exit(1);
}

console.log("Local dev bootstrap passed.");
for (const note of notes) console.log(`- ${note}`);
console.log(`Login: http://localhost:3000/login`);
console.log(`Email: ${env.ADMIN_EMAIL}`);
console.log("Password: value of ADMIN_PASSWORD in apps/api/.env");
