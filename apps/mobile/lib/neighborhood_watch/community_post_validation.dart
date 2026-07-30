import "../evidence/local_evidence_attachment.dart";
import "../voice/voice_report_validation.dart";
import "neighborhood_watch_service.dart";

bool hasValidCommunityPostNarrative({
  required String body,
  required Iterable<LocalEvidenceAttachment> attachments,
}) {
  if (body.trim().length >= 5) return true;
  if (draftHasVoiceAttachment(localMedia: attachments)) return true;
  if (draftHasImageOrVideo(localMedia: attachments)) return true;
  return false;
}

bool hasValidCommunityCommentNarrative({
  required String body,
  required Iterable<LocalEvidenceAttachment> attachments,
}) {
  if (body.trim().isNotEmpty) return true;
  if (draftHasVoiceAttachment(localMedia: attachments)) return true;
  if (draftHasImageOrVideo(localMedia: attachments)) return true;
  return false;
}

String normalizeVoiceOnlyCommunityPostBody(String title) {
  return "Voice post submitted via THE EYE Neighborhood Watch ($title).";
}

String voiceCommentPreview() => "Voice comment attached";
