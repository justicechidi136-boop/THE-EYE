#!/usr/bin/env node
/**
 * CI guard: enforce a single pnpm setup path via Corepack composite action.
 * - package.json packageManager must match the canonical pnpm version
 * - workflows must not pin conflicting pnpm installers
 * - jobs that invoke pnpm must use ./.github/actions/setup-pnpm
 */
const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const expectedManager = "pnpm@9.15.0";
const expectedPnpmVersion = "9.15.0";
const failures = [];

const pkgPath = path.join(repoRoot, "package.json");
const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

if (pkg.packageManager !== expectedManager) {
  failures.push(
    `package.json packageManager must be "${expectedManager}", got "${pkg.packageManager ?? "undefined"}"`,
  );
}

const compositeActionPath = path.join(repoRoot, ".github", "actions", "setup-pnpm", "action.yml");
if (!fs.existsSync(compositeActionPath)) {
  failures.push("Missing composite action .github/actions/setup-pnpm/action.yml");
} else {
  const actionContent = fs.readFileSync(compositeActionPath, "utf8");
  if (!/corepack\s+enable/i.test(actionContent)) {
    failures.push("setup-pnpm action must run corepack enable");
  }
  if (!/corepack\s+prepare[\s\S]*pnpm@(\$\{\{\s*inputs\.pnpm-version\s*\}\}|9\.15\.0)/i.test(actionContent)) {
    failures.push(`setup-pnpm action must prepare pnpm@${expectedPnpmVersion} (or via inputs.pnpm-version)`);
  }
  if (!/default:\s*["']9\.15\.0["']/i.test(actionContent)) {
    failures.push('setup-pnpm action inputs.pnpm-version default must be "9.15.0"');
  }
  if (!/pnpm store path/i.test(actionContent)) {
    failures.push("setup-pnpm action must cache pnpm store path");
  }
  if (/pnpm\/action-setup/i.test(actionContent)) {
    failures.push("setup-pnpm action must not use pnpm/action-setup");
  }
  if (/cache:.*pnpm/i.test(actionContent) && /setup-node@v4[\s\S]*cache:\s*pnpm/i.test(actionContent)) {
    failures.push("setup-pnpm action must not use setup-node pnpm cache (pnpm unavailable before cache restore)");
  }
}

const workflowsDir = path.join(repoRoot, ".github", "workflows");
const workflowFiles = fs
  .readdirSync(workflowsDir)
  .filter((name) => name.endsWith(".yml") || name.endsWith(".yaml"));

const forbiddenPatterns = [
  { label: "pnpm/action-setup", regex: /pnpm\/action-setup/i },
  { label: "npm install -g pnpm", regex: /npm\s+install\s+-g\s+pnpm/i },
  {
    label: "setup-node cache:pnpm before Corepack",
    regex: /uses:\s*actions\/setup-node@v4[\s\S]*?cache:\s*pnpm/i,
  },
];

function extractJobs(content) {
  const jobs = [];
  const jobsMatch = content.match(/^jobs:\s*\n([\s\S]*)$/m);
  if (!jobsMatch) return jobs;

  const jobsBody = jobsMatch[1];
  const lines = jobsBody.split("\n");
  let current = null;

  for (const line of lines) {
    const jobHeader = line.match(/^  ([A-Za-z0-9_-]+):\s*$/);
    if (jobHeader) {
      if (current) jobs.push(current);
      current = { id: jobHeader[1], lines: [] };
      continue;
    }
    if (current) current.lines.push(line);
  }
  if (current) jobs.push(current);
  return jobs;
}

function jobUsesPnpm(jobLines) {
  const block = jobLines.join("\n");
  return /\brun:\s*[^\n]*\bpnpm\b/.test(block) || /\brun:\s*\|\s*\n(?:[^\n]*\n)*?[^\n]*\bpnpm\b/.test(block);
}

for (const file of workflowFiles) {
  const filePath = path.join(workflowsDir, file);
  const content = fs.readFileSync(filePath, "utf8");

  for (const { label, regex } of forbiddenPatterns) {
    if (regex.test(content)) {
      failures.push(`.github/workflows/${file}: forbidden pattern "${label}"`);
    }
  }

  for (const job of extractJobs(content)) {
    const block = job.lines.join("\n");
    if (!jobUsesPnpm(job.lines)) continue;
    if (!/\.\/\.github\/actions\/setup-pnpm/.test(block)) {
      failures.push(
        `.github/workflows/${file} job "${job.id}": runs pnpm but missing ./.github/actions/setup-pnpm`,
      );
    }
  }
}

if (failures.length) {
  console.error("validate-ci-pnpm failed:");
  for (const failure of failures) {
    console.error(`  - ${failure}`);
  }
  process.exit(1);
}

console.log("validate-ci-pnpm: OK");
console.log(`  packageManager: ${pkg.packageManager}`);
console.log(`  workflows scanned: ${workflowFiles.length}`);
