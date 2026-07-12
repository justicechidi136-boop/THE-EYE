const fs = require("fs");
const path = require("path");
const { FIREBASE_PROJECTS } = require("./constants.cjs");

function readFirebaserc(repoRoot = path.join(__dirname, "..", "..")) {
  const rcPath = path.join(repoRoot, ".firebaserc");
  if (!fs.existsSync(rcPath)) {
    return { path: rcPath, projects: {}, aliases: {} };
  }
  const raw = JSON.parse(fs.readFileSync(rcPath, "utf8"));
  const projects = raw.projects ?? {};
  const aliases = {};
  for (const [alias, projectId] of Object.entries(projects)) {
    if (typeof projectId === "string") aliases[alias] = projectId;
  }
  return { path: rcPath, projects, aliases, raw };
}

function resolveAliasForProjectId(projectId, aliases = FIREBASE_PROJECTS) {
  return Object.entries(aliases).find(([, id]) => id === projectId)?.[0] ?? null;
}

function resolveActiveFromFirebaserc(repoRoot) {
  const { aliases } = readFirebaserc(repoRoot);
  const defaultProjectId = aliases.default;
  if (!defaultProjectId) {
    return { alias: null, projectId: null };
  }
  const namedAlias = Object.entries(aliases).find(
    ([name, id]) => name !== "default" && id === defaultProjectId,
  )?.[0];
  return {
    alias: namedAlias ?? "default",
    projectId: defaultProjectId,
  };
}

module.exports = {
  readFirebaserc,
  resolveAliasForProjectId,
  resolveActiveFromFirebaserc,
};
