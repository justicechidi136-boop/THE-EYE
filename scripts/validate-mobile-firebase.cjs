#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const mobileRoot = path.join(__dirname, "..", "apps", "mobile");
const flavors = ["development", "staging", "production"];
const packageByFlavor = {
  development: "com.theeye.app.dev",
  staging: "com.theeye.app.staging",
  production: "com.theeye.app",
};
const projectByFlavor = {
  development: "the-eye-29cff",
  staging: "the-eye-2stg",
  production: "the-eye-2pd-d0217",
};

const failures = [];
const required = [
  "lib/config/app_flavor.dart",
  "lib/config/firebase_bootstrap.dart",
  "lib/firebase_options_staging.dart",
  "lib/firebase_options_production.dart",
  "android/app/build.gradle",
  "lib/push/push_notification_service.dart",
];

for (const relative of required) {
  const full = path.join(mobileRoot, relative);
  if (!fs.existsSync(full)) failures.push(`missing ${relative}`);
}

const buildGradle = fs.readFileSync(
  path.join(mobileRoot, "android/app/build.gradle"),
  "utf8",
);
if (!buildGradle.includes('id "com.google.gms.google-services"')) {
  failures.push("android/app/build.gradle missing com.google.gms.google-services plugin");
}

function readDartFirebaseOptions(flavor) {
  const filePath = path.join(
    mobileRoot,
    `lib/firebase_options_${flavor}.dart`,
  );
  const source = fs.readFileSync(filePath, "utf8");
  const projectId = source.match(/projectId:\s*"([^"]+)"/)?.[1];
  const appId = source.match(/appId:\s*"([^"]+)"/)?.[1];
  const messagingSenderId = source.match(
    /messagingSenderId:\s*"([^"]+)"/,
  )?.[1];
  const webClientId = source.match(
    /androidGoogleWebClientId\s*=\s*"([^"]+)"/,
  )?.[1];
  return { projectId, appId, messagingSenderId, webClientId, source };
}

function readGoogleServicesForPackage(googleServices, packageName) {
  const client =
    googleServices.client?.find(
      (entry) =>
        entry?.client_info?.android_client_info?.package_name === packageName,
    ) ?? googleServices.client?.[0];
  const projectId = googleServices.project_info?.project_id;
  const senderId = googleServices.project_info?.project_number;
  const appId = client?.client_info?.mobilesdk_app_id;
  const packageNameFromClient =
    client?.client_info?.android_client_info?.package_name;
  const webClientId = client?.oauth_client?.find(
    (oauth) => oauth.client_type === 3,
  )?.client_id;
  return { projectId, senderId, appId, packageNameFromClient, webClientId };
}

for (const flavor of flavors) {
  const googleServicesPath = path.join(
    mobileRoot,
    "android/app/src",
    flavor,
    "google-services.json",
  );
  if (!fs.existsSync(googleServicesPath)) {
    failures.push(`android/app/src/${flavor}/google-services.json`);
    continue;
  }

  const googleServices = JSON.parse(fs.readFileSync(googleServicesPath, "utf8"));
  const expectedPackage = packageByFlavor[flavor];
  const expectedProject = projectByFlavor[flavor];
  const fromJson = readGoogleServicesForPackage(googleServices, expectedPackage);

  if (fromJson.projectId !== expectedProject) {
    failures.push(
      `${flavor} google-services.json project_id mismatch (got ${fromJson.projectId})`,
    );
  }
  if (fromJson.packageNameFromClient !== expectedPackage) {
    failures.push(
      `${flavor} google-services.json package_name mismatch (got ${fromJson.packageNameFromClient})`,
    );
  }

  const dart = readDartFirebaseOptions(flavor);
  if (!dart.projectId) failures.push(`${flavor} firebase_options missing projectId`);
  if (!dart.appId) failures.push(`${flavor} firebase_options missing appId`);
  if (!dart.messagingSenderId) {
    failures.push(`${flavor} firebase_options missing messagingSenderId`);
  }
  if (!dart.webClientId) {
    failures.push(`${flavor} firebase_options missing androidGoogleWebClientId`);
  }

  if (dart.projectId && dart.projectId !== expectedProject) {
    failures.push(
      `${flavor} firebase_options projectId mismatch (got ${dart.projectId})`,
    );
  }
  if (dart.projectId && dart.projectId !== fromJson.projectId) {
    failures.push(
      `${flavor} firebase_options projectId does not match google-services.json`,
    );
  }
  if (dart.appId && dart.appId !== fromJson.appId) {
    failures.push(
      `${flavor} firebase_options appId does not match google-services.json`,
    );
  }
  if (dart.messagingSenderId && dart.messagingSenderId !== fromJson.senderId) {
    failures.push(
      `${flavor} firebase_options messagingSenderId does not match google-services.json`,
    );
  }
  if (dart.webClientId && dart.webClientId !== fromJson.webClientId) {
    failures.push(
      `${flavor} firebase_options web client ID does not match google-services.json`,
    );
  }
}

const productionOptions = readDartFirebaseOptions("production");
if (
  productionOptions.source.includes("PRIVATE_KEY") ||
  productionOptions.source.includes("service_account")
) {
  failures.push("firebase_options_production.dart must not contain service-account secrets");
}

if (failures.length) {
  console.error("Mobile Firebase validation failed:");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

const report = flavors.map((flavor) => {
  const googleServices = JSON.parse(
    fs.readFileSync(
      path.join(mobileRoot, "android/app/src", flavor, "google-services.json"),
      "utf8",
    ),
  );
  const fromJson = readGoogleServicesForPackage(
    googleServices,
    packageByFlavor[flavor],
  );
  const dart = readDartFirebaseOptions(flavor);
  return {
    flavor,
    packageName: packageByFlavor[flavor],
    projectId: projectByFlavor[flavor],
    appId: fromJson.appId,
    fcmSenderId: fromJson.senderId,
    webClientId: fromJson.webClientId,
    dartProjectId: dart.projectId,
    dartAppId: dart.appId,
    dartSenderId: dart.messagingSenderId,
  };
});

console.log(JSON.stringify({ status: "ok", flavors: report }, null, 2));
