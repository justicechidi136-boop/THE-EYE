#!/usr/bin/env node
import assert from "node:assert/strict";
import shared from "../../packages/shared/dist/index.js";

const {
  LANGUAGE_CONTENT_PROVENANCE,
  LANGUAGE_PROCESSING_STATUS,
  TTS_PURPOSES,
  createTranslationIdentity,
  effectivePreferredLocale,
  isLanguageContentProvenance,
  isLanguageProcessingStatus,
  isTtsPurpose,
  languageAiContract,
  preservesOriginalProvenance,
  resolveLanguageMetadata,
  resolveRecipientOutputLocale,
} = shared;

assert.deepEqual(LANGUAGE_CONTENT_PROVENANCE, [
  "ORIGINAL",
  "TRANSCRIPT",
  "TRANSLATION",
  "SYNTHESIZED_SPEECH",
]);
assert.deepEqual(LANGUAGE_PROCESSING_STATUS, [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "UNSUPPORTED",
]);
assert.deepEqual(TTS_PURPOSES, [
  "danger_alert",
  "notification",
  "message",
  "accessibility",
  "general",
]);

assert.equal(effectivePreferredLocale("ha"), "ha");
assert.equal(resolveRecipientOutputLocale("fr"), "en");
assert.equal(resolveRecipientOutputLocale(null), "en");

assert.deepEqual(resolveLanguageMetadata({
  sourceLocale: "HA",
  targetLocale: "yo",
  preferredLocale: "ig",
  detectedLocale: "pcm",
  fallbackLocale: "fr",
  languageConfidence: 0.82,
}), {
  sourceLocale: "ha",
  targetLocale: "yo",
  preferredLocale: "ig",
  detectedLocale: "pcm",
  languageConfidence: 0.82,
  fallbackLocale: "en",
});

assert.deepEqual(createTranslationIdentity({
  sourceContentId: "audio-1",
  sourceLocale: "ha",
  targetLocale: "en",
}), {
  sourceContentId: "audio-1",
  sourceLocale: "ha",
  targetLocale: "en",
});
assert.throws(
  () => createTranslationIdentity({ sourceContentId: "audio-1", sourceLocale: "fr", targetLocale: "en" }),
  /Unsupported sourceLocale/,
);

const original = { contentId: "voice-1", provenance: "ORIGINAL", locale: "ha" };
const transcript = {
  sourceContentId: "voice-1",
  provider: "example",
  model: "example-model",
  status: "COMPLETED",
};
assert.equal(preservesOriginalProvenance(original, transcript), true);
assert.equal(preservesOriginalProvenance(
  original,
  { ...transcript, sourceContentId: "translation-1" },
), false);

assert.equal(isLanguageContentProvenance("TRANSLATION"), true);
assert.equal(isLanguageContentProvenance("GENERATED"), false);
assert.equal(isLanguageProcessingStatus("UNSUPPORTED"), true);
assert.equal(isLanguageProcessingStatus("DONE"), false);
assert.equal(isTtsPurpose("danger_alert"), true);
assert.equal(isTtsPurpose("marketing"), false);

assert.deepEqual(languageAiContract.fallbackOrder, [
  "recipient preferredLocale",
  "supported effective locale",
  "en",
]);

console.log("Language AI shared contract tests passed.");
