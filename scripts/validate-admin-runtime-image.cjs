const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const SERVER_PATHS = ["/app/apps/admin-web/server.js", "/app/server.js"];
const REQUIRED_PATHS = [
  "/app/apps/admin-web/.next/static",
  "/app/apps/admin-web/public",
];

const root = path.join(__dirname, "..");
const dockerfilePath = path.join(root, "apps", "admin-web", "Dockerfile");
const composeFile = path.join(root, "infra", "docker", "docker-compose.yml");
const DEFAULT_ADMIN_REPO = "the-eye-admin-web";

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function runOrThrow(command) {
  try {
    return run(command);
  } catch (error) {
    const details = [error.stderr, error.stdout].filter(Boolean).join("\n").trim();
    throw new Error(details ? `${error.message}\n${details}` : error.message);
  }
}

function dockerAvailable() {
  try {
    run("docker version --format {{.Server.Version}}");
    return true;
  } catch {
    return false;
  }
}

function quoteForShell(value) {
  if (process.platform === "win32") {
    return `"${String(value).replace(/"/g, '\\"')}"`;
  }
  return `'${String(value).replace(/'/g, `'\"'\"'`)}'`;
}

function discoverAdminImageFromCompose() {
  if (!fs.existsSync(composeFile) || !dockerAvailable()) {
    return null;
  }

  try {
    const envFile = path.join(root, ".env");
    let command = `docker compose -f ${quoteForShell(composeFile)}`;
    if (fs.existsSync(envFile)) {
      command += ` --env-file ${quoteForShell(envFile)}`;
    }
    command += " config --format json";

    const config = JSON.parse(run(command));
    const image = config?.services?.["admin-web"]?.image;
    if (typeof image === "string" && image.length > 0 && !image.includes("${")) {
      return image;
    }
  } catch {
    // compose config unavailable — fall through to tag default
  }

  return null;
}

function resolveImageRef() {
  const argImage = process.argv[2]?.trim();
  if (argImage) {
    return { image: argImage, source: "CLI argument" };
  }

  const envImage = process.env.THE_EYE_ADMIN_IMAGE?.trim();
  if (envImage) {
    return { image: envImage, source: "THE_EYE_ADMIN_IMAGE" };
  }

  const discovered = discoverAdminImageFromCompose();
  if (discovered) {
    return { image: discovered, source: "docker compose config (admin-web service)" };
  }

  const tag = process.env.THE_EYE_IMAGE_TAG?.trim() || "local";
  return {
    image: `${DEFAULT_ADMIN_REPO}:${tag}`,
    source: `THE_EYE_IMAGE_TAG default (${tag})`,
  };
}

function printUsage() {
  console.error(`Usage: node scripts/validate-admin-runtime-image.cjs [<docker-image>]

Resolve order when <docker-image> is omitted:
  1. THE_EYE_ADMIN_IMAGE environment variable
  2. admin-web.image from: docker compose -f infra/docker/docker-compose.yml config
  3. the-eye-admin-web:\${THE_EYE_IMAGE_TAG:-local} (matches compose default)

Examples:
  node scripts/validate-admin-runtime-image.cjs the-eye-admin-web:local
  THE_EYE_ADMIN_IMAGE=the-eye-admin-web:abc1234 node scripts/validate-admin-runtime-image.cjs`);
}

function assertInsideContainer(imageRef, assertionScript) {
  const escaped = assertionScript.replace(/'/g, `'\"'\"'`);
  return runOrThrow(`docker run --rm --entrypoint sh ${imageRef} -lc '${escaped}'`);
}

function validateDockerfileStatic() {
  const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
  const requiredMarkers = [
    ".next/standalone",
    'CMD ["node", "apps/admin-web/server.js"]',
    "USER nextjs",
    "ENV HOSTNAME=0.0.0.0",
    "ENV PORT=3000",
  ];
  const forbiddenMarkers = [
    'CMD ["pnpm", "--filter", "@the-eye/admin-web", "run", "start"]',
  ];

  const missing = requiredMarkers.filter((marker) => !dockerfile.includes(marker));
  if (missing.length) {
    throw new Error(`Admin Dockerfile missing required markers: ${missing.join(", ")}`);
  }

  const forbidden = forbiddenMarkers.filter((marker) => dockerfile.includes(marker));
  if (forbidden.length) {
    throw new Error(`Admin Dockerfile still uses runtime pnpm CMD: ${forbidden.join(", ")}`);
  }

  console.log("Dockerfile static checks passed (Next.js standalone production layout).");
}

function resolveServerPath(imageRef) {
  const probe = SERVER_PATHS.map((containerPath) => {
    return `if [ -f ${containerPath} ]; then echo ${containerPath}; exit 0; fi`;
  }).join("; ");

  const resolved = assertInsideContainer(imageRef, `${probe}; echo missing-server; exit 1`);
  if (resolved === "missing-server" || !resolved) {
    throw new Error(`Could not find Next.js standalone server.js at ${SERVER_PATHS.join(" or ")}`);
  }

  if (resolved !== "/app/apps/admin-web/server.js") {
    console.warn(
      `Warning: server.js resolved at ${resolved}; Dockerfile CMD expects /app/apps/admin-web/server.js`,
    );
  }

  return resolved;
}

function validateDockerImage(imageRef) {
  const serverPath = resolveServerPath(imageRef);

  for (const containerPath of REQUIRED_PATHS) {
    assertInsideContainer(
      imageRef,
      `test -e ${containerPath} || { echo "missing ${containerPath}"; exit 1; }`,
    );
  }

  assertInsideContainer(
    imageRef,
    "command -v pnpm >/dev/null 2>&1 && { echo 'unexpected pnpm shim in runtime image'; exit 1; } || true",
  );

  const serverRelative = serverPath.replace(/^\/app\/?/, "") || "server.js";
  const moduleCheck = [
    "cd /app",
    "node - <<'NODE'",
    `const serverPath = ${JSON.stringify(serverRelative)};`,
    "const fs = require('fs');",
    "const server = fs.readFileSync(serverPath, 'utf8');",
    "if (!/next/i.test(server)) {",
    "  console.error(serverPath + ' does not look like a Next standalone entry');",
    "  process.exit(1);",
    "}",
    "console.log('standalone server.js present at ' + serverPath);",
    "const moduleDirs = ['node_modules', 'apps/admin-web/node_modules'].filter((dir) => {",
    "  try { return fs.statSync(dir).isDirectory(); } catch { return false; }",
    "});",
    "if (!moduleDirs.length) {",
    "  console.error('no traced node_modules directory found under /app');",
    "  process.exit(1);",
    "}",
    "const entries = moduleDirs.flatMap((dir) => fs.readdirSync(dir));",
    "if (entries.length < 3) {",
    "  console.error('standalone node_modules too sparse: ' + entries.join(', '));",
    "  process.exit(1);",
    "}",
    "console.log('traced node_modules entries: ' + entries.length + ' across ' + moduleDirs.join(', '));",
    "NODE",
  ].join("\n");

  const output = assertInsideContainer(imageRef, moduleCheck);
  console.log(output);
}

const { image, source } = resolveImageRef();
console.log(`Validating admin-web runtime image: ${image} (from ${source})`);

try {
  validateDockerfileStatic();

  if (dockerAvailable()) {
    validateDockerImage(image);
    console.log(`Admin-web runtime image validation passed for ${image} (docker).`);
  } else {
    console.warn(
      `Docker unavailable locally — skipped container checks for ${image}. CI will verify standalone layout and startup.`,
    );
    console.log("Admin-web runtime static validation passed (Dockerfile only).");
  }
} catch (error) {
  console.error(`Admin-web runtime image validation failed for ${image}: ${error.message}`);
  if (!process.argv[2] && !process.env.THE_EYE_ADMIN_IMAGE) {
    printUsage();
  }
  process.exit(1);
}
