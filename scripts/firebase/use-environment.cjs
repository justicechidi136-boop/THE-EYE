const { execSync } = require("child_process");
const path = require("path");
const { FIREBASE_ALIASES, FIREBASE_PROJECTS } = require("./constants.cjs");
const { readFirebaserc } = require("./read-firebaserc.cjs");

const alias = process.argv[2];
const repoRoot = path.join(__dirname, "..", "..");

if (!alias || !FIREBASE_ALIASES.includes(alias)) {
  console.error(`Usage: node scripts/firebase/use-environment.cjs <${FIREBASE_ALIASES.join("|")}>`);
  process.exit(1);
}

const { aliases } = readFirebaserc(repoRoot);
if (!aliases[alias]) {
  console.error(`Firebase alias "${alias}" is not defined in .firebaserc.`);
  process.exit(1);
}

try {
  execSync(`firebase use ${alias}`, { cwd: repoRoot, stdio: "inherit" });
} catch {
  console.error(`Failed to switch Firebase CLI to alias "${alias}". Is firebase-tools installed and authenticated?`);
  process.exit(1);
}

console.log(`Firebase environment: ${alias} → ${FIREBASE_PROJECTS[alias]}`);
