const assert = require("assert");
const {
  validateProductionFirebase,
  isFcmSimulationEnabled,
} = require("./firebase/guard-production.cjs");
const { FIREBASE_PROJECTS, DEV_PROJECT_ID, PROD_PROJECT_ID } = require("./firebase/constants.cjs");
const { readFirebaserc } = require("./firebase/read-firebaserc.cjs");
const path = require("path");

const repoRoot = path.join(__dirname, "..");

function expectFail(input, needle) {
  const result = validateProductionFirebase(input);
  assert.strictEqual(result.ok, false, `expected failure for ${JSON.stringify(input)}`);
  assert.ok(
    result.errors.some((error) => error.includes(needle)),
    `expected error containing "${needle}", got ${result.errors.join("; ")}`,
  );
}

function expectPass(input) {
  const result = validateProductionFirebase(input);
  assert.strictEqual(result.ok, true, result.errors.join("; "));
}

const validProductionInput = {
  fcmProjectId: PROD_PROJECT_ID,
  fcmClientEmail: "firebase-adminsdk@the-eye-2pd-d0217.iam.gserviceaccount.com",
  fcmPrivateKey: "-----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n",
  fcmAllowSimulation: "false",
  fcmSimulationMode: "false",
  fcmMode: "real",
  theEyeDisableRedis: "0",
  activeFirebaseProjectId: PROD_PROJECT_ID,
};

expectPass(validProductionInput);

expectFail(
  {
    fcmProjectId: DEV_PROJECT_ID,
    fcmClientEmail: "a@b.c",
    fcmPrivateKey: "key",
    activeFirebaseProjectId: PROD_PROJECT_ID,
  },
  DEV_PROJECT_ID,
);

expectFail(
  {
    ...validProductionInput,
    fcmClientEmail: "",
    fcmPrivateKey: "",
  },
  "simulation",
);

expectFail(
  {
    ...validProductionInput,
    fcmMode: "simulated",
  },
  "FCM_MODE",
);

expectFail(
  {
    ...validProductionInput,
    theEyeDisableRedis: "1",
  },
  "THE_EYE_DISABLE_REDIS",
);

expectFail(
  {
    fcmProjectId: FIREBASE_PROJECTS.staging,
    fcmClientEmail: "a@b.c",
    fcmPrivateKey: "key",
    activeFirebaseProjectId: PROD_PROJECT_ID,
  },
  PROD_PROJECT_ID,
);

expectFail(
  {
    fcmProjectId: PROD_PROJECT_ID,
    fcmClientEmail: "a@b.c",
    fcmPrivateKey: "key",
    activeFirebaseProjectId: DEV_PROJECT_ID,
  },
  DEV_PROJECT_ID,
);

assert.strictEqual(
  isFcmSimulationEnabled({ FCM_ALLOW_SIMULATION: "true", FCM_PROJECT_ID: PROD_PROJECT_ID, FCM_CLIENT_EMAIL: "a", FCM_PRIVATE_KEY: "b" }),
  true,
);
assert.strictEqual(
  isFcmSimulationEnabled({ FCM_PROJECT_ID: PROD_PROJECT_ID, FCM_CLIENT_EMAIL: "a", FCM_PRIVATE_KEY: "b" }),
  false,
);

const { aliases } = readFirebaserc(repoRoot);
assert.strictEqual(aliases.development, DEV_PROJECT_ID, ".firebaserc development alias");
assert.strictEqual(aliases.staging, FIREBASE_PROJECTS.staging, ".firebaserc staging alias");
assert.strictEqual(aliases.production, PROD_PROJECT_ID, ".firebaserc production alias");
assert.strictEqual(aliases.default, DEV_PROJECT_ID, ".firebaserc default must map to development");
assert.notStrictEqual(aliases.production, DEV_PROJECT_ID, "production must not point to development project");

console.log("Firebase production guard tests passed.");
