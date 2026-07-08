const fs = require("fs");
const path = require("path");

const composePath = path.join(__dirname, "..", "infra", "docker", "docker-compose.yml");
const compose = fs.readFileSync(composePath, "utf8");

const required = [
  "api:",
  "admin-web:",
  "postgres-postgis:",
  "redis:",
  "minio:",
  "livekit:",
  "nginx:",
  "api-migrate:",
  "api-seed:",
  "healthcheck:",
  "postgres_data:",
  "redis_data:",
  "minio_data:",
  "nginx_cache:",
  "prisma:deploy",
  "db:seed",
];

const missing = required.filter((needle) => !compose.includes(needle));
if (missing.length) {
  console.error("Docker Compose smoke failed. Missing:", missing.join(", "));
  process.exit(1);
}

const nginxConf = fs.readFileSync(path.join(__dirname, "..", "infra", "docker", "nginx", "conf.d", "the-eye.conf"), "utf8");
if (!nginxConf.includes("ssl_certificate") || !nginxConf.includes("proxy_set_header Upgrade")) {
  console.error("Docker Compose smoke failed. Nginx SSL or websocket readiness is missing.");
  process.exit(1);
}

console.log("Docker Compose smoke passed.");
