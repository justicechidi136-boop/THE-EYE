const path = require("path");

const slaPath = path.join(__dirname, "..", "apps", "admin-web", "lib", "dispatch", "sla-display.ts");
const dispatchPagePath = path.join(__dirname, "..", "apps", "admin-web", "app", "dispatch", "page.tsx");
const dispatchActionsPath = path.join(
  __dirname,
  "..",
  "apps",
  "admin-web",
  "components",
  "dispatch",
  "dispatch-actions.tsx",
);

const slaSource = require("fs").readFileSync(slaPath, "utf8");
const dispatchPageSource = require("fs").readFileSync(dispatchPagePath, "utf8");
const dispatchActionsSource = require("fs").readFileSync(dispatchActionsPath, "utf8");

if (!slaSource.includes("countdownLabel") || !slaSource.includes("formatDuration")) {
  console.error("SLA display helpers missing from sla-display.ts");
  process.exit(1);
}

const requiredDispatchPage = ["Time since report", "Silent SOS", "Stale location", "formatDuration"];
const missingPage = requiredDispatchPage.filter((needle) => !dispatchPageSource.includes(needle));
if (missingPage.length) {
  console.error("Dispatch command center missing SLA/stale/silent indicators:", missingPage.join(", "));
  process.exit(1);
}

if (!dispatchActionsSource.includes("overrideReason")) {
  console.error("Dispatch actions must send overrideReason for triage updates");
  process.exit(1);
}

console.log("Admin SLA display test passed.");
