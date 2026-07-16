const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const examplePath = path.join(root, ".env.example");
const composePath = path.join(root, "infra", "docker", "docker-compose.yml");

const example = fs.readFileSync(examplePath, "utf8");
const compose = fs.readFileSync(composePath, "utf8");

const requiredInExample = [
  "POSTGRES_PASSWORD",
  "DATABASE_URL",
  "DATABASE_DIRECT_URL",
  "REDIS_PASSWORD",
  "MINIO_ROOT_PASSWORD",
  "JWT_ACCESS_SECRET",
  "JWT_REFRESH_SECRET",
  "LIVE_LOCATION_LINK_SECRET",
  "LIVEKIT_API_KEY",
  "LIVEKIT_API_SECRET",
  "CORS_ORIGINS",
  "GOOGLE_OAUTH_CLIENT_ID",
  "THE_EYE_SERVER_NAME",
  "THE_EYE_SSL_REDIRECT",
  "THE_EYE_GENERATE_DEV_SSL",
  "THE_EYE_TLS_BOOTSTRAP",
  "HTTPS_PORT",
  "API_ORIGIN",
  "ADMIN_WEB_APP_ENV",
  "NEXT_PUBLIC_API_BASE_URL",
  "METRICS_BEARER_TOKEN",
  "NEXT_PUBLIC_LIVEKIT_URL",
  "ADMIN_EMAIL",
  "ADMIN_PASSWORD",
  "CERTBOT_EMAIL",
];

const requiredInCompose = [
  "POSTGRES_PASSWORD:?",
  "DATABASE_URL:?",
  "REDIS_PASSWORD:?",
  "MINIO_ROOT_PASSWORD:?",
  "JWT_ACCESS_SECRET:?",
  "JWT_REFRESH_SECRET:?",
  "LIVE_LOCATION_LINK_SECRET:?",
  "LIVEKIT_API_KEY:?",
  "LIVEKIT_API_SECRET:?",
  "CORS_ORIGINS:?",
  "METRICS_BEARER_TOKEN:?",
  "THE_EYE_SERVER_NAME",
  "THE_EYE_SSL_REDIRECT",
  "THE_EYE_GENERATE_DEV_SSL",
  "THE_EYE_TLS_BOOTSTRAP",
  "FCM_PROJECT_ID",
  "FIREBASE_PROJECT_ID",
  "THE_EYE_APP_ENV",
];

const missingExample = requiredInExample.filter((key) => !example.includes(`${key}=`));
const missingCompose = requiredInCompose.filter((key) => !compose.includes(key));

if (missingExample.length || missingCompose.length) {
  console.error("Production environment validation failed.");
  if (missingExample.length) console.error("Missing in .env.example:", missingExample.join(", "));
  if (missingCompose.length) console.error("Missing in docker-compose.yml:", missingCompose.join(", "));
  process.exit(1);
}

const placeholderSecrets = (example.match(/change_me/g) || []).length;
if (placeholderSecrets < 5) {
  console.error("Production environment validation failed. .env.example should keep change_me placeholders, not real secrets.");
  process.exit(1);
}

console.log(`Production environment validation passed (${requiredInExample.length} variables documented).`);
