import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const SOURCE_URL = "https://cvr.inecnigeria.org/pu_locator/index";
const API_BASE = "https://cvr.inecnigeria.org/PublicApi";
const EXPECTED = Object.freeze({ states: 37, lgas: 774, wards: 8809 });
const EXPECTED_RAW = Object.freeze({ states: 37, lgas: 774, wards: 8810 });
const OUTPUT_PATH = resolve(
  process.argv[2] ?? "apps/api/prisma/data/nigeria-geography.inec-2026-08-31.json",
);

const STATES = [
  [1, "01", "ABIA"], [2, "02", "ADAMAWA"], [3, "03", "AKWA IBOM"],
  [4, "04", "ANAMBRA"], [5, "05", "BAUCHI"], [6, "06", "BAYELSA"],
  [7, "07", "BENUE"], [8, "08", "BORNO"], [9, "09", "CROSS RIVER"],
  [10, "10", "DELTA"], [11, "11", "EBONYI"], [12, "12", "EDO"],
  [13, "13", "EKITI"], [14, "14", "ENUGU"], [15, "37", "FCT"],
  [16, "15", "GOMBE"], [17, "16", "IMO"], [18, "17", "JIGAWA"],
  [19, "18", "KADUNA"], [20, "19", "KANO"], [21, "20", "KATSINA"],
  [22, "21", "KEBBI"], [23, "22", "KOGI"], [24, "23", "KWARA"],
  [25, "24", "LAGOS"], [26, "25", "NASARAWA"], [27, "26", "NIGER"],
  [28, "27", "OGUN"], [29, "28", "ONDO"], [30, "29", "OSUN"],
  [31, "30", "OYO"], [32, "31", "PLATEAU"], [33, "32", "RIVERS"],
  [34, "33", "SOKOTO"], [35, "34", "TARABA"], [36, "35", "YOBE"],
  [37, "36", "ZAMFARA"],
];

const titleCase = (value) => value
  .toLocaleLowerCase("en-NG")
  .replace(/(^|[\s(/-])([a-z])/g, (_, prefix, letter) => `${prefix}${letter.toUpperCase()}`)
  .replace(/\bFct\b/g, "FCT")
  .replace(/\bIi\b/g, "II")
  .replace(/\bIii\b/g, "III")
  .replace(/\bIv\b/g, "IV");

function parseOption(label) {
  const match = /^(\d+)\s*-\s*(.+)$/.exec(label.trim());
  if (!match) throw new Error(`Unexpected INEC option label: ${label}`);
  const officialName = match[2].replace(/\s+/g, " ").trim();
  return {
    code: match[1].padStart(2, "0"),
    name: titleCase(officialName),
    officialName,
  };
}

async function fetchJson(url, attempts = 4) {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { Accept: "application/json", "User-Agent": "THE-EYE-reference-data-import/1.0" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, attempt * 500));
    }
  }
  throw new Error(`Unable to fetch ${url}: ${lastError?.message ?? "unknown error"}`);
}

function optionsFromResponse(payload) {
  const options = payload?.[0] ?? {};
  return Object.entries(options)
    .filter(([id, label]) => /^\d+$/.test(id) && id !== "0" && typeof label === "string")
    .map(([sourceId, label]) => ({ sourceId: Number(sourceId), ...parseOption(label) }));
}

function canonicalizeWards(wards, lga, anomalies) {
  const byCode = new Map();
  for (const ward of wards) {
    const existing = byCode.get(ward.code);
    if (!existing) {
      byCode.set(ward.code, ward);
      continue;
    }
    if (existing.name !== ward.name) {
      throw new Error(
        `Ambiguous INEC ward code ${ward.code} in ${lga.name}: ${existing.name} / ${ward.name}`,
      );
    }
    anomalies.push({
      type: "EXACT_DUPLICATE_WARD",
      lgaSourceId: lga.sourceId,
      lgaCode: lga.code,
      lgaName: lga.name,
      wardCode: ward.code,
      wardName: ward.name,
      retainedSourceId: existing.sourceId,
      excludedSourceId: ward.sourceId,
    });
  }
  return [...byCode.values()];
}

async function mapWithConcurrency(items, concurrency, mapper) {
  const results = new Array(items.length);
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      results[index] = await mapper(items[index], index);
    }
  }
  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}

async function main() {
  const anomalies = [];
  const states = await mapWithConcurrency(STATES, 4, async ([sourceId, code, officialName]) => {
    const query = new URLSearchParams({ "data[Search][state_id]": String(sourceId) });
    const payload = await fetchJson(`${API_BASE}/lgas/1/Search?${query}`);
    const lgas = optionsFromResponse(payload);
    return {
      sourceId,
      code,
      name: officialName === "FCT" ? "Federal Capital Territory" : titleCase(officialName),
      officialName: officialName === "FCT" ? "Federal Capital Territory (FCT)" : titleCase(officialName),
      type: officialName === "FCT" ? "FCT" : "STATE",
      lgas,
    };
  });

  const lgaEntries = states.flatMap((state) => state.lgas.map((lga) => ({ state, lga })));
  const wardsByLga = await mapWithConcurrency(lgaEntries, 8, async ({ lga }) => {
    const query = new URLSearchParams({ "data[Search][local_government_id]": String(lga.sourceId) });
    const payload = await fetchJson(`${API_BASE}/wards/1/Search?${query}`);
    return optionsFromResponse(payload);
  });

  lgaEntries.forEach(({ state, lga }, index) => {
    lga.type = state.type === "FCT" ? "AREA_COUNCIL" : "LGA";
    lga.wards = canonicalizeWards(wardsByLga[index], lga, anomalies);
  });

  const rawCounts = {
    states: states.length,
    lgas: lgaEntries.length,
    wards: wardsByLga.reduce((total, wards) => total + wards.length, 0),
  };
  const counts = {
    states: states.length,
    lgas: lgaEntries.length,
    wards: states.reduce(
      (stateTotal, state) => stateTotal
        + state.lgas.reduce((lgaTotal, lga) => lgaTotal + lga.wards.length, 0),
      0,
    ),
  };
  for (const [key, expected] of Object.entries(EXPECTED_RAW)) {
    if (rawCounts[key] !== expected) {
      throw new Error(`INEC raw ${key} count mismatch: expected ${expected}, received ${rawCounts[key]}`);
    }
  }
  for (const [key, expected] of Object.entries(EXPECTED)) {
    if (counts[key] !== expected) {
      if (key === "wards") {
        const stateWardCounts = states.map((state) => ({
          state: state.name,
          lgas: state.lgas.length,
          wards: state.lgas.reduce((total, lga) => total + lga.wards.length, 0),
        }));
        console.error(JSON.stringify(stateWardCounts, null, 2));
      }
      throw new Error(`INEC ${key} count mismatch: expected ${expected}, received ${counts[key]}`);
    }
  }

  const snapshot = {
    schemaVersion: 1,
    country: { code: "NG", name: "Nigeria", officialName: "Federal Republic of Nigeria" },
    provenance: {
      organization: "Independent National Electoral Commission (INEC)",
      sourceUrl: SOURCE_URL,
      apiBaseUrl: API_BASE,
      retrievedAt: new Date().toISOString(),
      sourceDescription: "Official INEC Polling Unit Locator State/LGA/Registration Area hierarchy",
      transformations: [
        "Parsed INEC two-digit administrative codes from option labels",
        "Collapsed repeated whitespace",
        "Converted display names from uppercase to title case while preserving source labels as officialName",
        "Classified FCT children as Area Councils",
        "Excluded only exact same-code/same-name duplicates within an LGA and retained each anomaly below",
      ],
      anomalies,
    },
    rawCounts,
    expectedCounts: EXPECTED,
    counts,
    states,
  };

  await mkdir(dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  console.log(`Wrote ${OUTPUT_PATH}`);
  console.log(`Nigeria hierarchy: ${counts.states} State/FCT, ${counts.lgas} LGA/Area Councils, ${counts.wards} wards`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
