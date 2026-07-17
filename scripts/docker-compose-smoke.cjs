const fs = require("fs");
const path = require("path");
const { validateComposeLivekitKeys } = require("./validate-livekit-keys.cjs");

const root = path.join(__dirname, "..");
const composePath = path.join(root, "infra", "docker", "docker-compose.yml");
const compose = fs.readFileSync(composePath, "utf8");

const requiredServices = [
  "api:",
  "admin-web:",
  "postgres-postgis:",
  "redis:",
  "minio:",
  "livekit:",
  "nginx:",
  "api-migrate:",
  "api-seed:",
  "api-create-admin:",
  "certbot:",
  "prometheus:",
];

const requiredComposeMarkers = [
  "healthcheck:",
  "127.0.0.1:",
  "API_ORIGIN:",
  "http://api:4000",
  "postgres_data:",
  "redis_data:",
  "minio_data:",
  "nginx_cache:",
  "certbot_www:",
  "node_modules/prisma/build/index.js",
  "prisma/seed.ts",
  "prisma/create-admin.ts",
  "migrate",
  "deploy",
  "DATABASE_DIRECT_URL",
  "THE_EYE_SERVER_NAME",
  "THE_EYE_SSL_REDIRECT",
  "THE_EYE_GENERATE_DEV_SSL",
  "THE_EYE_TLS_BOOTSTRAP",
  "METRICS_BEARER_TOKEN:?",
  "condition: service_healthy",
  "FCM_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
  "THE_EYE_APP_ENV",
  "the-eye-api-tools:",
  "target: tools",
];

const missingServices = requiredServices.filter((needle) => !compose.includes(needle));
const missingMarkers = requiredComposeMarkers.filter((needle) => !compose.includes(needle));
if (missingServices.length || missingMarkers.length) {
  console.error("Docker Compose smoke failed.");
  if (missingServices.length) console.error("Missing services:", missingServices.join(", "));
  if (missingMarkers.length) console.error("Missing markers:", missingMarkers.join(", "));
  process.exit(1);
}

const livekitErrors = validateComposeLivekitKeys(compose, fs.readFileSync(
  path.join(root, "infra", "docker", "livekit", "livekit.yaml"),
  "utf8",
));
if (livekitErrors.length) {
  console.error("Docker Compose smoke failed. LiveKit:", livekitErrors.join("; "));
  process.exit(1);
}

const healthcheckCount = (compose.match(/healthcheck:/g) || []).length;
if (healthcheckCount < 7) {
  console.error(`Docker Compose smoke failed. Expected at least 7 healthchecks, found ${healthcheckCount}.`);
  process.exit(1);
}

const httpTemplate = fs.readFileSync(
  path.join(root, "infra", "docker", "nginx", "render", "http.conf.template"),
  "utf8",
);
const httpsTemplate = fs.readFileSync(
  path.join(root, "infra", "docker", "nginx", "render", "https.conf.template"),
  "utf8",
);
const upstreams = fs.readFileSync(
  path.join(root, "infra", "docker", "nginx", "snippets", "upstreams.conf"),
  "utf8",
);
const nginxLocations = fs.readFileSync(
  path.join(root, "infra", "docker", "nginx", "snippets", "the-eye-locations.conf"),
  "utf8",
);
const nginxChecks = [
  ["ssl_certificate", httpsTemplate, "HTTPS ssl_certificate"],
  ["listen 443 ssl", httpsTemplate, "HTTPS listener"],
  ["include /etc/nginx/snippets/ssl-params.conf", httpsTemplate, "SSL params snippet"],
  ["include /etc/nginx/snippets/the-eye-locations.conf", httpsTemplate, "shared locations snippet"],
  ["location = /metrics", nginxLocations, "metrics blocked"],
  ["location /v1/", nginxLocations, "API /v1/ route"],
  ["proxy_pass http://the_eye_api", nginxLocations, "API upstream"],
  ["location /livekit/", nginxLocations, "LiveKit route"],
  ["proxy_pass http://the_eye_livekit", nginxLocations, "LiveKit upstream"],
  ["/.well-known/acme-challenge/", httpTemplate, "ACME challenge path"],
  ["upstream the_eye_api", upstreams, "API upstream block"],
  ["upstream the_eye_livekit", upstreams, "LiveKit upstream block"],
];
for (const [needle, content, label] of nginxChecks) {
  if (!content.includes(needle)) {
    console.error(`Docker Compose smoke failed. Nginx config missing ${label}.`);
    process.exit(1);
  }
}

const entrypoint = fs.readFileSync(
  path.join(root, "infra", "docker", "nginx", "entrypoint.d", "20-render-the-eye-conf.sh"),
  "utf8",
);
const entrypointChecks = [
  "THE_EYE_SSL_REDIRECT",
  "THE_EYE_TLS_BOOTSTRAP",
  "openssl req",
  "10-http.conf",
  "20-https.conf",
];
for (const needle of entrypointChecks) {
  if (!entrypoint.includes(needle)) {
    console.error(`Docker Compose smoke failed. Nginx entrypoint missing ${needle}.`);
    process.exit(1);
  }
}

const apiDockerfile = fs.readFileSync(path.join(root, "apps", "api", "Dockerfile"), "utf8");
if (
  !apiDockerfile.includes("corepack") ||
  !apiDockerfile.includes("pnpm install --frozen-lockfile") ||
  !apiDockerfile.includes("pnpm --filter @the-eye/api deploy --prod")
) {
  console.error(
    "Docker Compose smoke failed. API Dockerfile must use corepack, frozen lockfile, and pnpm deploy.",
  );
  process.exit(1);
}

const backupScript = fs.readFileSync(path.join(root, "scripts", "backup-the-eye.ps1"), "utf8");
const backupSh = fs.readFileSync(path.join(root, "scripts", "backup-the-eye.sh"), "utf8");
const restoreScript = fs.readFileSync(path.join(root, "scripts", "restore-the-eye.ps1"), "utf8");
const restoreSh = fs.readFileSync(path.join(root, "scripts", "restore-the-eye.sh"), "utf8");
if (!backupScript.includes("pg_dump") || !backupScript.includes("postgres-postgis is not running")) {
  console.error("Docker Compose smoke failed. Backup script validation failed.");
  process.exit(1);
}
if (!backupSh.includes("pg_dump") || !restoreSh.includes("pg_restore")) {
  console.error("Docker Compose smoke failed. Bash backup/restore scripts validation failed.");
  process.exit(1);
}
if (!restoreScript.includes("pg_restore") || !restoreScript.includes("-Confirm")) {
  console.error("Docker Compose smoke failed. Restore script validation failed.");
  process.exit(1);
}

const certsIgnore = path.join(root, "infra", "docker", "nginx", "certs", "live", ".gitignore");
if (!fs.existsSync(certsIgnore) || !fs.readFileSync(certsIgnore, "utf8").includes("*.pem")) {
  console.error("Docker Compose smoke failed. TLS cert gitignore is missing.");
  process.exit(1);
}

console.log("Docker Compose smoke passed.");
