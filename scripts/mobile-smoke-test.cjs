const fs = require("fs");
const path = require("path");

const mainPath = path.join(__dirname, "..", "apps", "mobile", "lib", "main.dart");
const contractsDir = path.join(__dirname, "..", "apps", "mobile", "lib", "contracts");
const source = [
  fs.readFileSync(mainPath, "utf8"),
  fs.readFileSync(path.join(contractsDir, "the_eye_api_paths.dart"), "utf8"),
  fs.readFileSync(path.join(contractsDir, "the_eye_enums.dart"), "utf8"),
].join("\n");

const requiredRoutes = [
  '"/home"',
  '"/report/emergency"',
  '"/live-video"',
  '"/police-stations"',
  '"/notifications"',
  '"/broadcasts"',
  '"/family"',
  '"/smartwatch"',
  '"/neighborhood-watch"',
];

const requiredScreens = [
  "class HomeScreen",
  "class NotificationsScreen",
  "class SmartwatchDeviceScreen",
  "class NearbyPoliceStationsScreen",
  "class LiveEmergencyVideoScreen",
  "LiveVideoSessionController",
  "LiveVideoPreviewPane",
  "class BroadcastCenterScreen",
  "BrandAssets.lockupDarkBg",
  "ThemePreferences.load()",
  "setThemePreference",
];

const requiredApiContract = [
  "http://localhost:4000/v1",
  "contracts/the_eye_api_client.dart",
  "contracts/the_eye_enums.dart",
  "contracts/the_eye_payloads.dart",
  "TheEyeApiClient",
  "TheEyePayloads",
  "IncidentTrackingItem",
  "/smartwatch/sos",
  "/live-video/",
];

const missing = [...requiredRoutes, ...requiredScreens, ...requiredApiContract].filter((needle) => !source.includes(needle));
if (missing.length) {
  console.error("Mobile smoke test failed. Missing:", missing.join(", "));
  process.exit(1);
}

console.log("Mobile smoke test passed.");
