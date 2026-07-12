#!/usr/bin/env node
import { validateStagingApiUrl } from "./production-readiness-report.mjs";

const url = process.argv[2] ?? process.env.URL ?? "";
const result = validateStagingApiUrl(url);

if (!result.ok) {
  console.error(result.reason);
  process.exit(1);
}

console.log(url);
