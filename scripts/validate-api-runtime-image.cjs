const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const image = process.argv[2];

if (!image) {
  console.error("Usage: node scripts/validate-api-runtime-image.cjs <docker-image>");
  process.exit(1);
}

const REQUIRED_MODULES = [
  "reflect-metadata",
  "@nestjs/core",
  "@prisma/client",
  "@the-eye/shared",
];

const REQUIRED_PATHS = [
  "/app/dist/main.js",
  "/app/src/preload-env.cjs",
  "/app/prisma/schema.prisma",
];

const root = path.join(__dirname, "..");
const dockerfilePath = path.join(root, "apps", "api", "Dockerfile");

function run(command) {
  return execSync(command, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function dockerAvailable() {
  try {
    run("docker version --format {{.Server.Version}}");
    return true;
  } catch {
    return false;
  }
}

function assertInsideContainer(imageRef, assertionScript) {
  const escaped = assertionScript.replace(/'/g, `'\"'\"'`);
  return run(`docker run --rm --entrypoint sh ${imageRef} -lc '${escaped}'`);
}

function validateDockerfileStatic() {
  const dockerfile = fs.readFileSync(dockerfilePath, "utf8");
  const requiredMarkers = [
    "pnpm --filter @the-eye/api deploy --prod /app/deploy",
    'CMD ["node", "--require", "./src/preload-env.cjs", "dist/main.js"]',
    "USER nestjs",
    "COPY --from=deploy-prod",
  ];
  const missing = requiredMarkers.filter((marker) => !dockerfile.includes(marker));
  if (missing.length) {
    throw new Error(`API Dockerfile missing required markers: ${missing.join(", ")}`);
  }
  console.log("Dockerfile static checks passed (pnpm deploy production layout).");
}

function validateDockerImage(imageRef) {
  for (const containerPath of REQUIRED_PATHS) {
    assertInsideContainer(
      imageRef,
      `test -f ${containerPath} || { echo "missing ${containerPath}"; exit 1; }`,
    );
  }

  const moduleCheck = [
    "cd /app",
    "node - <<'NODE'",
    "const modules = ['reflect-metadata','@nestjs/core','@prisma/client','@the-eye/shared'];",
    "for (const name of modules) {",
    "  const resolved = require.resolve(name);",
    "  console.log(name + ' -> ' + resolved);",
    "}",
    "const preload = require.resolve('./src/preload-env.cjs');",
    "console.log('preload-env.cjs -> ' + preload);",
    "const entries = require('fs').readdirSync('/app/node_modules');",
    "if (entries.length < 5) {",
    "  console.error('node_modules too sparse: ' + entries.join(', '));",
    "  process.exit(1);",
    "}",
    "NODE",
  ].join("\n");

  const output = assertInsideContainer(imageRef, moduleCheck);
  console.log(output);

  assertInsideContainer(
    imageRef,
    "test -d /app/node_modules/.prisma/client || test -f /app/node_modules/@prisma/client/index.js || test -f /app/node_modules/@prisma/client/default.js || { echo 'missing generated Prisma client'; exit 1; }",
  );
  console.log("Prisma client present in runtime image.");
}

try {
  validateDockerfileStatic();

  if (dockerAvailable()) {
    validateDockerImage(image);
    console.log(`API runtime image validation passed for ${image} (docker).`);
  } else {
    console.warn(
      `Docker unavailable locally — skipped container checks for ${image}. CI will verify require.resolve and startup.`,
    );
    console.log(`Expected runtime modules: ${REQUIRED_MODULES.join(", ")}`);
    console.log("API runtime static validation passed (Dockerfile only).");
  }
} catch (error) {
  console.error(`API runtime image validation failed for ${image}: ${error.message}`);
  process.exit(1);
}
