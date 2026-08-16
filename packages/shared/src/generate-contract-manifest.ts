import { writeFileSync } from "fs";
import { resolve } from "path";
import {
  API_VERSION_PREFIX,
  apiEnumValues,
  mobileApiContracts,
  reportIncidentValidation,
} from "./contracts";
import {
  COUNTRY_REGISTRY,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_PREFERRED_LOCALE,
  LANGUAGE_REGISTRY,
} from "./language-region";
import { languageAiContract } from "./language-ai-contract";

const manifest = {
  version: "0.1.0",
  generatedAt: new Date().toISOString(),
  apiVersionPrefix: API_VERSION_PREFIX,
  enums: apiEnumValues,
  endpoints: mobileApiContracts,
  validation: reportIncidentValidation,
  languageRegion: {
    defaultCountryCode: DEFAULT_COUNTRY_CODE,
    defaultPreferredLocale: DEFAULT_PREFERRED_LOCALE,
    countries: COUNTRY_REGISTRY,
    languages: LANGUAGE_REGISTRY,
  },
  languageAi: languageAiContract,
};

const outputPath = resolve(__dirname, "contracts.json");
writeFileSync(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
console.log(`Wrote ${outputPath}`);
