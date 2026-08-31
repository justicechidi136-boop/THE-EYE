const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

const nginxConf = read("infra/docker/nginx/nginx.conf");
const upstreams = read("infra/docker/nginx/snippets/upstreams.conf");
const apiLocations = read("infra/docker/nginx/snippets/api-locations.conf");
const deployYml = read(".github/workflows/deploy.yml");
const deployStaging = read("scripts/deploy-staging.sh");
const deployVpsCi = read("scripts/deploy-staging-vps-ci.sh");
const reloadScript = read("scripts/reload-nginx-upstreams.sh");
const smokeScript = read("scripts/staging-smoke-check.sh");
const releaseValidation = read("scripts/lib/staging-release-validation.sh");
const fullDeployStart = deployVpsCi.indexOf(
  '"${COMPOSE[@]}" up -d --force-recreate api notification-worker admin-web',
);
const buildCachePrune = deployVpsCi.indexOf(
  "docker builder prune --all --force",
);
const composeBuildStart = deployVpsCi.indexOf(
  '"${COMPOSE[@]}" build api admin-web api-tools --no-cache api-tools',
);
const preSyncBuildCachePrune = deployYml.indexOf(
  "docker builder prune --all --force",
);
const stagingGitFetch = deployYml.indexOf("git fetch --tags origin");
const livekitRecreate = deployVpsCi.indexOf(
  "force_recreate_livekit_container",
  fullDeployStart,
);
const nginxRecreate = deployVpsCi.indexOf(
  '"${COMPOSE[@]}" up -d --force-recreate nginx',
  fullDeployStart,
);

const checks = [
  [nginxConf.includes("resolver 127.0.0.11"), "nginx.conf must configure Docker embedded DNS resolver"],
  [upstreams.includes(" resolve;"), "upstreams.conf must use resolve for dynamic Docker DNS"],
  [apiLocations.includes("set $the_eye_api_backend"), "api-locations must proxy via variable upstream"],
  [apiLocations.includes("proxy_pass $the_eye_api_backend"), "api-locations must use variable proxy_pass"],
  [
    deployYml.includes("deploy-staging-vps-ci.sh") &&
      deployVpsCi.includes("reload-nginx-upstreams.sh"),
    "deploy workflow must reload nginx after recreate",
  ],
  [
    deployYml.includes("deploy-staging-vps-ci.sh") &&
      (deployVpsCi.includes("staging-smoke-check.sh") ||
        (deployVpsCi.includes("staging_release_validation") &&
          releaseValidation.includes("staging-smoke-check.sh"))),
    "deploy workflow must run Host-aware smoke checks",
  ],
  [
    fullDeployStart >= 0 &&
      livekitRecreate > fullDeployStart &&
      nginxRecreate > livekitRecreate,
    "full staging deploy must recreate LiveKit after patching runtime RTC config",
  ],
  [
    buildCachePrune >= 0 &&
      composeBuildStart >= 0 &&
      buildCachePrune < composeBuildStart,
    "full staging deploy must prune unused build cache before rebuilding images",
  ],
  [
    preSyncBuildCachePrune >= 0 &&
      stagingGitFetch >= 0 &&
      preSyncBuildCachePrune < stagingGitFetch,
    "staging SSH bootstrap must reclaim unused build cache before repository sync",
  ],
  [
    deployVpsCi.includes('docker image prune --force --filter "until=24h"'),
    "full staging deploy must prune only old dangling images",
  ],
  [
    !deployVpsCi.includes("docker volume prune") &&
      !deployVpsCi.includes("docker system prune"),
    "staging disk hygiene must never prune volumes or the full Docker system",
  ],
  [deployStaging.includes("reload-nginx-upstreams.sh"), "deploy-staging.sh must reload nginx"],
  [reloadScript.includes("nginx -t"), "reload script must run nginx -t"],
  [reloadScript.includes("nginx -s reload"), "reload script must gracefully reload nginx"],
  [smokeScript.includes("/v1/health/ready"), "smoke script must probe proxied API readiness"],
  [smokeScript.includes("Host:"), "smoke script must send Host headers for canonical hostnames"],
];

const failures = checks.filter(([ok]) => !ok).map(([, message]) => message);
if (failures.length) {
  console.error("validate-nginx-deploy-lifecycle failed:");
  for (const message of failures) {
    console.error(`- ${message}`);
  }
  process.exit(1);
}

console.log("validate-nginx-deploy-lifecycle: passed");
