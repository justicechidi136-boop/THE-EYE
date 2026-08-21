const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..", "..");
const buildGradle = fs.readFileSync(
  path.join(root, "apps", "mobile", "android", "app", "build.gradle"),
  "utf8",
);

const required = [
  "signingConfigs {",
  "stagingRelease {",
  "THE_EYE_STAGING_KEYSTORE_PATH",
  "THE_EYE_ALLOW_DEBUG_STAGING_RELEASE",
  "androidComponents {",
  "onVariants(selector().withBuildType(\"release\"))",
  "envFlavor == \"staging\"",
  "tasks.register(\"validateStagingReleaseSigning\")",
  "task.name == \"preStagingReleaseBuild\"",
  "task.name == \"assembleStagingRelease\"",
  "task.name.startsWith(\"packageStagingRelease\")",
  "task.name == \"bundleStagingRelease\"",
  "task.name == \"signStagingReleaseBundle\"",
  "task.dependsOn(validateStagingReleaseSigning)",
  "Staging release signing is not configured",
  "variant.signingConfig?.setConfig(android.signingConfigs.stagingRelease)",
];

const forbidden = [
  "productFlavors {\n        staging {\n            dimension = \"environment\"\n            applicationIdSuffix = \".staging\"\n            resValue \"string\", \"app_name\", \"THE EYE Staging\"\n            signingConfig = signingConfigs.debug",
  "afterEvaluate {\n    android.applicationVariants.configureEach",
  "variant.signingConfig = android.signingConfigs.stagingRelease",
  "gradle.startParameter.taskNames",
];

const missing = required.filter((needle) => !buildGradle.includes(needle));
const hits = forbidden.filter((needle) => buildGradle.includes(needle));

if (missing.length || hits.length) {
  console.error("validate-staging-signing-config failed.");
  if (missing.length) console.error("Missing:", missing.join(", "));
  if (hits.length) console.error("Forbidden debug staging signing pattern detected.");
  process.exit(1);
}

if (!fs.existsSync(path.join(root, "apps", "mobile", "android", "key.properties.example"))) {
  console.error("validate-staging-signing-config failed: key.properties.example missing");
  process.exit(1);
}

console.log("validate-staging-signing-config: passed");
