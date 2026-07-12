const { execSync } = require("child_process");
const path = require("path");
const { FIREBASE_PROJECTS } = require("./constants.cjs");
const { readFirebaserc, resolveAliasForProjectId } = require("./read-firebaserc.cjs");

const repoRoot = path.join(__dirname, "..", "..");
const { aliases } = readFirebaserc(repoRoot);

let projectId = null;
try {
  projectId = execSync("firebase use", { cwd: repoRoot, encoding: "utf8" }).trim();
} catch {
  projectId = aliases.default ?? null;
}

const alias =
  Object.entries(aliases).find(([name, id]) => name !== "default" && id === projectId)?.[0] ??
  resolveAliasForProjectId(projectId, FIREBASE_PROJECTS) ??
  (projectId === aliases.default ? "default" : null);

const environment = alias && FIREBASE_PROJECTS[alias] ? alias : alias ?? "unknown";

console.log(
  JSON.stringify(
    {
      alias: environment,
      projectId,
      environments: FIREBASE_PROJECTS,
    },
    null,
    2,
  ),
);
