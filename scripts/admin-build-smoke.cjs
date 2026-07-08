const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const requiredFiles = [
  "apps/admin-web/package.json",
  "apps/admin-web/next.config.ts",
  "apps/admin-web/app/page.tsx",
  "apps/admin-web/app/audit/page.tsx",
  "apps/admin-web/app/notifications/page.tsx",
  "apps/admin-web/components/app-shell.tsx",
];

const missing = requiredFiles.filter((file) => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Admin build smoke failed. Missing:", missing.join(", "));
  process.exit(1);
}

const packageJson = JSON.parse(fs.readFileSync(path.join(root, "apps/admin-web/package.json"), "utf8"));
if (!packageJson.scripts?.build || !packageJson.dependencies?.next) {
  console.error("Admin build smoke failed. Next.js build script or dependency is missing.");
  process.exit(1);
}

console.log("Admin build smoke passed.");
