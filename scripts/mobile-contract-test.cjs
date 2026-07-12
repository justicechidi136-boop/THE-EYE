const fs = require("fs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");
const manifestPath = path.join(repoRoot, "packages", "shared", "dist", "contracts.json");
const enumsPath = path.join(repoRoot, "apps", "mobile", "lib", "contracts", "the_eye_enums.dart");
const payloadsPath = path.join(repoRoot, "apps", "mobile", "lib", "contracts", "the_eye_payloads.dart");
const pathsPath = path.join(repoRoot, "apps", "mobile", "lib", "contracts", "the_eye_api_paths.dart");
const clientPath = path.join(repoRoot, "apps", "mobile", "lib", "contracts", "the_eye_api_client.dart");
const mainPath = path.join(repoRoot, "apps", "mobile", "lib", "main.dart");

function read(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Missing required file: ${filePath}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function extractDartConstValues(source, className) {
  const classBlock = source.match(new RegExp(`abstract final class ${className}[\\s\\S]*?(?=abstract final class |$)`));
  if (!classBlock) return [];
  const values = [];
  const regex = /static const \w+ = "([^"]+)"/g;
  let match;
  while ((match = regex.exec(classBlock[0])) !== null) {
    values.push(match[1]);
  }
  return values;
}

function extractPayloadMethods(source) {
  return [...source.matchAll(/static Map<String, Object\?> (\w+)\(/g)].map((match) => match[1]);
}

const manifest = JSON.parse(read(manifestPath));
const enumsSource = read(enumsPath);
const payloadsSource = read(payloadsPath);
const pathsSource = read(pathsPath);
const clientSource = read(clientPath);
const mainSource = read(mainPath);
const failures = [];

for (const [enumName, expectedValues] of Object.entries(manifest.enums)) {
  const dartValues = extractDartConstValues(enumsSource, enumName);
  if (!dartValues.length) {
    failures.push(`Dart enum mirror missing for ${enumName}`);
    continue;
  }
  for (const value of expectedValues) {
    if (!dartValues.includes(value)) {
      failures.push(`Dart ${enumName} missing value ${value}`);
    }
  }
  for (const value of dartValues) {
    if (!expectedValues.includes(value)) {
      failures.push(`Dart ${enumName} has unexpected value ${value}`);
    }
  }
}

const validation = manifest.validation;
for (const [key, value] of Object.entries(validation)) {
  if (!enumsSource.includes(String(value))) {
    failures.push(`Dart TheEyeEnums missing validation constant value for ${key}=${value}`);
  }
}

const payloadMethods = extractPayloadMethods(payloadsSource);
const endpointKeys = Object.keys(manifest.endpoints);
for (const endpointKey of endpointKeys) {
  const contract = manifest.endpoints[endpointKey];
  if (!contract.body) continue;
  const methodGuess = endpointKey.split(".").pop();
  const builderName = {
    start: "liveVideoStart",
    locationUpdate: "liveVideoLocationUpdate",
    register: "registerSmartwatchDevice",
    gps: "smartwatchGps",
    sos: "smartwatchSos",
    heartbeat: "smartwatchHeartbeat",
    offlineSync: "smartwatchOfflineSync",
    report: "reportIncident",
  }[methodGuess];
  if (builderName && !payloadMethods.includes(builderName)) {
    failures.push(`Missing Dart payload builder ${builderName} for endpoint ${endpointKey}`);
  }
  for (const field of Object.keys(contract.body)) {
    if (!payloadsSource.includes(`"${field}"`)) {
      failures.push(`Payload definitions missing field ${field} for endpoint ${endpointKey}`);
    }
  }
}

const requiredClientMethods = [
  "reportIncident",
  "login",
  "requestPhoneOtp",
  "verifyPhoneOtp",
  "requestPasswordReset",
  "presignIncidentMedia",
  "confirmIncidentMedia",
  "uploadPresignedEvidence",
  "startLiveVideo",
  "stopLiveVideo",
  "postLiveVideoLocation",
  "registerSmartwatch",
  "postSmartwatchGps",
  "postSmartwatchSos",
  "postSmartwatchHeartbeat",
  "postSmartwatchOfflineSync",
];
for (const method of requiredClientMethods) {
  if (!clientSource.includes(`Future`) || !clientSource.includes(method)) {
    failures.push(`TheEyeApiClient missing method ${method}`);
  }
}

const requiredPaths = [
  "/live-video/incidents/",
  "/live-video/sessions/",
  "/smartwatch/devices/register",
  "/smartwatch/sos",
  "/incidents/report",
  "/auth/login",
  "/auth/phone/request-otp",
];
for (const route of requiredPaths) {
  if (!pathsSource.includes(route)) {
    failures.push(`TheEyeApiPaths missing route fragment ${route}`);
  }
}

const requiredMainImports = [
  "contracts/the_eye_api_client.dart",
  "contracts/the_eye_enums.dart",
  "contracts/the_eye_payloads.dart",
  "contracts/report_type.dart",
  "evidence/evidence_attachment_picker.dart",
  "evidence/evidence_capture_service.dart",
  "auth/auth_service.dart",
  "auth/auth_validation.dart",
  "incidents/incident_submission_service.dart",
  "incidents/incident_draft_factory.dart",
  "live_video/live_video_session_controller.dart",
  "LiveVideoPreviewPane",
  "LiveVideoSessionController",
  "TheEyeApiClient",
  "TheEyePayloads",
  "IncidentTrackingItem",
  "submitIncident",
  "buildIncidentDraft",
];
for (const token of requiredMainImports) {
  if (!mainSource.includes(token)) {
    failures.push(`main.dart missing contract integration token: ${token}`);
  }
}

if (!mainSource.includes("class IncidentStatus ")) {
  // renamed successfully
} else {
  failures.push("main.dart still defines conflicting IncidentStatus class");
}

if (failures.length) {
  console.error("Mobile contract test failed:\n- " + failures.join("\n- "));
  process.exit(1);
}

console.log(`Mobile contract test passed (${endpointKeys.length} endpoints, ${Object.keys(manifest.enums).length} enum groups).`);
