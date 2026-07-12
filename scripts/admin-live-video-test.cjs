const fs = require("fs");
const path = require("path");

const viewerPath = path.join(__dirname, "..", "apps", "admin-web", "app", "live-video", "live-video-viewer.tsx");
const playerPath = path.join(__dirname, "..", "apps", "admin-web", "components", "livekit-admin-player.tsx");
const packagePath = path.join(__dirname, "..", "apps", "admin-web", "package.json");

const viewerSource = fs.readFileSync(viewerPath, "utf8");
const playerSource = fs.readFileSync(playerPath, "utf8");
const packageSource = fs.readFileSync(packagePath, "utf8");

const required = [
  { file: "package.json", source: packageSource, needles: ["livekit-client"] },
  { file: "livekit-admin-player.tsx", source: playerSource, needles: ["adaptiveStream", "Reconnecting", "Disconnected", "admin-token"] },
  { file: "live-video-viewer.tsx", source: viewerSource, needles: ["LivekitAdminPlayer", "THE EYE LIVE EVIDENCE", "location/latest", "recordingConfigured"] },
];

for (const check of required) {
  const missing = check.needles.filter((needle) => !check.source.includes(needle));
  if (missing.length) {
    console.error(`Admin live video test failed in ${check.file}. Missing:`, missing.join(", "));
    process.exit(1);
  }
}

console.log("Admin live video test passed.");
