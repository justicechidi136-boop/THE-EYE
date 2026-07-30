import "../evidence/local_evidence_attachment.dart";
import "voice_constants.dart";

class VoiceRecordingResult {
  const VoiceRecordingResult({
    required this.attachment,
    required this.durationSeconds,
    required this.selectedLanguage,
  });

  final LocalEvidenceAttachment attachment;
  final int durationSeconds;
  final String selectedLanguage;
}

bool draftHasVoiceAttachment({
  required Iterable<LocalEvidenceAttachment> localMedia,
}) {
  return localMedia.any((item) => item.isAudio);
}

bool draftHasImageOrVideo({
  required Iterable<LocalEvidenceAttachment> localMedia,
}) {
  return localMedia.any((item) => item.isImage || item.isVideo);
}

bool hasValidReportNarrative({
  required String description,
  required Iterable<LocalEvidenceAttachment> localMedia,
}) {
  if (description.trim().length >= 5) return true;
  if (draftHasVoiceAttachment(localMedia: localMedia)) return true;
  if (draftHasImageOrVideo(localMedia: localMedia)) return true;
  return false;
}

String normalizeVoiceOnlyDescription(String typeLabel) {
  return "Voice report submitted via THE EYE mobile ($typeLabel).";
}

String formatVoiceDuration(int seconds) {
  final minutes = seconds ~/ 60;
  final remainder = seconds % 60;
  return "${minutes.toString().padLeft(2, "0")}:${remainder.toString().padLeft(2, "0")}";
}

bool isValidVoiceDuration(int? seconds) {
  if (seconds == null) return true;
  return seconds > 0 && seconds <= voiceMaxDurationSeconds;
}
