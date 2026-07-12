/** Canonical Firebase project IDs — do not create projects from this repo. */
const FIREBASE_PROJECTS = {
  development: "the-eye-29cff",
  staging: "the-eye-2stg",
  production: "the-eye-2pd-d0217",
};

const FIREBASE_ALIASES = Object.keys(FIREBASE_PROJECTS);

const DEV_PROJECT_ID = FIREBASE_PROJECTS.development;
const PROD_PROJECT_ID = FIREBASE_PROJECTS.production;

module.exports = {
  FIREBASE_PROJECTS,
  FIREBASE_ALIASES,
  DEV_PROJECT_ID,
  PROD_PROJECT_ID,
};
