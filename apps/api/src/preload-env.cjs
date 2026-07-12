const { existsSync, readFileSync } = require("fs");
const { join } = require("path");

const candidates = [
  join(__dirname, "../.env"),
  join(process.cwd(), "apps/api/.env"),
  join(process.cwd(), ".env"),
];

for (const filePath of candidates) {
  if (!existsSync(filePath)) continue;
  for (const line of readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
  break;
}
