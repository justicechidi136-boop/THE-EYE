#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const ENABLED_LOCALES = new Set(["en", "ha", "yo", "ig", "pcm"]);
const CRITICAL_CONCEPTS = [
  "armed robbery",
  "kidnapping",
  "fire",
  "flood",
  "road blocked",
  "officer down",
  "request backup",
  "missing child",
  "vehicle plate",
];

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    const key = argv[index];
    if (!key.startsWith("--")) continue;
    args[key.slice(2)] = argv[index + 1];
    index += 1;
  }
  return args;
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenSet(value) {
  return new Set(normalizeText(value).split(" ").filter(Boolean));
}

function grossWordAccuracy(expected, actual) {
  const expectedTokens = [...tokenSet(expected)];
  if (!expectedTokens.length) return null;
  const actualTokens = tokenSet(actual);
  const matched = expectedTokens.filter((token) => actualTokens.has(token)).length;
  return Number((matched / expectedTokens.length).toFixed(3));
}

function preservedEntities(sample, actualText) {
  const actual = normalizeText(actualText);
  return (sample.criticalEntities ?? []).map((entity) => ({
    entity,
    preserved: actual.includes(normalizeText(entity)),
  }));
}

function summarize(dataset, results) {
  const byId = new Map((results.samples ?? []).map((sample) => [sample.id, sample]));
  return dataset.samples.map((sample) => {
    if (!ENABLED_LOCALES.has(sample.locale)) {
      throw new Error(`Unsupported benchmark locale ${sample.locale} in ${sample.id}`);
    }
    if (!sample.filePath || path.isAbsolute(sample.filePath)) {
      throw new Error(`Sample ${sample.id} must use a relative local fixture path`);
    }
    const result = byId.get(sample.id) ?? {};
    const transcript = result.transcript ?? "";
    const translation = result.translation ?? "";
    const conceptCoverage = CRITICAL_CONCEPTS
      .filter((concept) => normalizeText(sample.expectedTranscript).includes(concept))
      .map((concept) => ({ concept, preserved: normalizeText(transcript).includes(concept) }));

    return {
      id: sample.id,
      locale: sample.locale,
      scenario: sample.scenario,
      provider: result.provider ?? "not-run",
      transcriptionStatus: result.transcriptionStatus ?? "not-run",
      detectedLocale: result.detectedLocale ?? null,
      grossWordAccuracy: grossWordAccuracy(sample.expectedTranscript, transcript),
      criticalEntities: preservedEntities(sample, transcript),
      criticalConcepts: conceptCoverage,
      latencyMs: result.latencyMs ?? null,
      translationTarget: result.translationTarget ?? sample.translationTarget ?? "en",
      translationMeaningReview: result.translationMeaningReview ?? "human-review-required",
      hallucinationReview: result.hallucinationReview ?? "human-review-required",
      omissionReview: result.omissionReview ?? "human-review-required",
      translationGrossWordAccuracy: sample.expectedTranslation
        ? grossWordAccuracy(sample.expectedTranslation, translation)
        : null,
    };
  });
}

function main() {
  const args = parseArgs(process.argv);
  if (!args.dataset) {
    console.error("Usage: node scripts/speech-provider-benchmark.cjs --dataset <fixtures.json> [--results <provider-results.json>]");
    process.exit(1);
  }
  const dataset = readJson(args.dataset);
  const results = args.results ? readJson(args.results) : { samples: [] };
  const report = {
    generatedAt: new Date().toISOString(),
    datasetName: dataset.name,
    notes: [
      "Use only synthetic or explicitly approved recordings.",
      "Gross word accuracy is a coarse screening metric; human emergency-semantic review is required.",
    ],
    samples: summarize(dataset, results),
  };
  console.log(JSON.stringify(report, null, 2));
}

main();
