#!/usr/bin/env node
import {
  logDeployUrlValidationFailure,
  validateStagingApiUrl,
} from "./deploy-api-url-validation.mjs";

const url = process.argv[2] ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.URL ?? "";
const result = validateStagingApiUrl(url);

if (!result.ok) {
  logDeployUrlValidationFailure(result);
  process.exit(1);
}

console.log(url.trim());
