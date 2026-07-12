const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), "utf8");
}

function exists(relPath) {
  return fs.existsSync(path.join(root, relPath));
}

const brandFiles = [
  "public/brand/the-eye-logo-lockup-dark-bg.png",
  "public/brand/the-eye-logomark-transparent.png",
  "public/brand/the-eye-app-icon-dark-green.png",
  "public/brand/the-eye-app-icon-white.png",
  "apps/admin-web/public/brand/the-eye-logo-lockup-dark-bg.png",
  "apps/admin-web/public/brand/the-eye-logomark-transparent.png",
  "apps/admin-web/public/favicon.png",
  "apps/admin-web/public/apple-touch-icon.png",
  "apps/mobile/assets/images/brand/the-eye-logo-lockup-dark-bg.png",
  "apps/mobile/assets/images/brand/the-eye-logomark-transparent.png",
];

const missingAssets = brandFiles.filter((file) => !exists(file));

const adminLayout = read("apps/admin-web/app/layout.tsx");
const adminStyles = read("apps/admin-web/app/styles.css");
const adminThemeProvider = read("apps/admin-web/components/theme-provider.tsx");
const adminTokens = read("apps/admin-web/lib/theme/tokens.ts");
const mobileMain = read("apps/mobile/lib/main.dart");
const mobileBrand = read("apps/mobile/lib/brand.dart");
const mobileThemePrefs = read("apps/mobile/lib/theme/theme_preferences.dart");

const requiredSnippets = [
  { file: "admin layout", source: adminLayout, needles: ['data-theme="dark"', "ThemeProvider", "BRAND_ASSETS"] },
  { file: "admin styles", source: adminStyles, needles: [':root[data-theme="dark"]', "#0b0f14", "#009933", "#ff9933"] },
  { file: "admin theme provider", source: adminThemeProvider, needles: ['useState<ThemePreference>("dark")', "THEME_STORAGE_KEY", "prefers-color-scheme"] },
  { file: "admin tokens", source: adminTokens, needles: ['THEME_STORAGE_KEY = "the-eye-theme"', "#0B0F14", "#009933"] },
  { file: "mobile main", source: mobileMain, needles: ["ThemePreferences.load()", "controller.themeMode", "BrandAssets.lockupDarkBg", "setThemePreference"] },
  { file: "mobile brand", source: mobileBrand, needles: ["0xFF0B0F14", "0xFF009933", "0xFFFF9933", "lockupDarkBg"] },
  { file: "mobile theme prefs", source: mobileThemePrefs, needles: ['storageKey = "the_eye_theme_preference"', "ThemePreference.dark"] },
];

const missingSnippets = [];
for (const check of requiredSnippets) {
  for (const needle of check.needles) {
    if (!check.source.includes(needle)) {
      missingSnippets.push(`${check.file}: ${needle}`);
    }
  }
}

if (missingAssets.length || missingSnippets.length) {
  console.error("Brand/theme smoke failed.");
  if (missingAssets.length) {
    console.error("Missing assets:", missingAssets.join(", "));
  }
  if (missingSnippets.length) {
    console.error("Missing snippets:", missingSnippets.join(", "));
  }
  process.exit(1);
}

console.log("Brand/theme smoke passed.");
