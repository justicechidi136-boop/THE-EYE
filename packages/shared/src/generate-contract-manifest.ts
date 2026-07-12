import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  API_VERSION_PREFIX,
  apiEnumValues,
  mobileApiContracts,
  reportIncidentValidation,
} from "./contracts";

const manifest = {
  version: "0.1.0",
  generatedAt: new Date().toISOString(),
  apiVersionPrefix: API_VERSION_PREFIX,
  enums: apiEnumValues,
  endpoints: mobileApiContracts,
  validation: reportIncidentValidation,
};

const outputPath = resolve(__dirname, "contracts.json");
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
