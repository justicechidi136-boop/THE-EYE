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
const reloadScript = read("scripts/reload-nginx-upstreams.sh");
const smokeScript = read("scripts/staging-smoke-check.sh");

const checks = [
  [nginxConf.includes("resolver 127.0.0.11"), "nginx.conf must configure Docker embedded DNS resolver"],
  [upstreams.includes(" resolve;"), "upstreams.conf must use resolve for dynamic Docker DNS"],
  [apiLocations.includes("set $the_eye_api_backend"), "api-locations must proxy via variable upstream"],
  [apiLocations.includes("proxy_pass $the_eye_api_backend"), "api-locations must use variable proxy_pass"],
  [deployYml.includes("reload-nginx-upstreams.sh"), "deploy.yml must reload nginx after recreate"],
  [deployYml.includes("staging-smoke-check.sh"), "deploy.yml must run Host-aware smoke checks"],
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
