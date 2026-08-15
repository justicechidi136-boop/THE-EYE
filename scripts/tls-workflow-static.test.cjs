const fs = require("fs");

const workflow = fs.readFileSync(".github/workflows/staging-issue-tls.yml", "utf8");
const issueScript = fs.readFileSync("scripts/issue-letsencrypt.sh", "utf8");

const checks = [
  ["workflow omits appleboy script_stop", !workflow.includes("script_stop: true")],
  ["remote script keeps fail-fast shell", workflow.includes("script: |\n            set -euo pipefail")],
  ["storage host guard remains", workflow.includes("EXPECTED_STORAGE_HOST: storage-staging.theeye.com.ng")],
  ["staging ancestry check remains", workflow.includes('git merge-base --is-ancestor "$WORKFLOW_SHA" origin/staging')],
  ["DNS check remains", workflow.includes('getent ahostsv4 "$EXPECTED_STORAGE_HOST"')],
  ["ACME HTTP reachability check remains", workflow.includes("/.well-known/acme-challenge/the-eye-tls-probe")],
  ["SAN validation checks subjectAltName", workflow.includes("subjectAltName")],
  ["API SAN remains", workflow.includes("staging-api.theeye.com.ng")],
  ["dashboard SAN remains", workflow.includes("staging-dashboard8jps.theeye.com.ng")],
  ["LiveKit SAN remains", workflow.includes("staging-livekit.theeye.com.ng")],
  ["storage SAN remains", workflow.includes('"$EXPECTED_STORAGE_HOST"')],
  ["nginx validation remains", workflow.includes("exec -T nginx nginx -t")],
  ["port 9000/9001 checks remain", workflow.includes("for port in 9000 9001; do")],
  ["remote if blocks remain balanced", count(workflow, "\n            if ") === count(workflow, "\n            fi")],
  ["remote for blocks remain balanced", count(workflow, "\n            for ") === count(workflow, "\n            done")],
  ["remote function remains balanced", workflow.includes("cleanup() {") && workflow.includes("verify_tls_host() {")],
  ["ACME nginx bootstrap is cert-only", issueScript.includes('"${COMPOSE[@]}" up -d --no-deps nginx')],
  ["ACME nginx bootstrap does not start deps", !issueScript.includes('"${COMPOSE[@]}" up -d nginx')],
];

let failed = false;
for (const [name, ok] of checks) {
  console.log(`${ok ? "PASS" : "FAIL"} ${name}`);
  if (!ok) failed = true;
}

if (failed) {
  process.exit(1);
}

function count(haystack, needle) {
  return haystack.split(needle).length - 1;
}
