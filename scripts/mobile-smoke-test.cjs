const fs = require("fs");
const path = require("path");

const mainPath = path.join(__dirname, "..", "apps", "mobile", "lib", "main.dart");
const source = fs.readFileSync(mainPath, "utf8");

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
  "class BroadcastCenterScreen",
];

const missing = [...requiredRoutes, ...requiredScreens].filter((needle) => !source.includes(needle));
if (missing.length) {
  console.error("Mobile smoke test failed. Missing:", missing.join(", "));
  process.exit(1);
}

console.log("Mobile smoke test passed.");
