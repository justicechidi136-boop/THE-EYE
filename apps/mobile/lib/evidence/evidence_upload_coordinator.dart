import "../incidents/incident_media_reference.dart";
import "evidence_upload_service.dart";
import "local_evidence_attachment.dart";

class EvidenceUploadItemResult {
  const EvidenceUploadItemResult({
    required this.localId,
    required this.success,
    this.mediaReference,
    this.errorCode,
    this.userMessage,
  });

  final String localId;
  final bool success;
  final IncidentMediaReference? mediaReference;
  final String? errorCode;
  final String? userMessage;
}

class EvidenceUploadBatchResult {
  const EvidenceUploadBatchResult({
    required this.uploaded,
    required this.failures,
  });

  final List<IncidentMediaReference> uploaded;
  final List<EvidenceUploadItemResult> failures;

  bool get isFullSuccess => failures.isEmpty;
  bool get isPartialSuccess => uploaded.isNotEmpty && failures.isNotEmpty;
  bool get isTotalFailure => uploaded.isEmpty && failures.isNotEmpty;
}

class EvidenceUploadCoordinator {
  EvidenceUploadCoordinator({required EvidenceUploadService uploadService})
      : _uploadService = uploadService;

  final EvidenceUploadService _uploadService;

  Future<EvidenceUploadBatchResult> uploadForIncident({
    required String incidentId,
    required List<LocalEvidenceAttachment> attachments,
    required String? accessToken,
    required double? fallbackLatitude,
    required double? fallbackLongitude,
    EvidenceUploadProgress? onProgress,
  }) async {
    if (attachments.isEmpty) {
      return const EvidenceUploadBatchResult(uploaded: [], failures: []);
    }

    if (accessToken == null || accessToken.isEmpty) {
      return EvidenceUploadBatchResult(
        uploaded: const [],
        failures: [
          for (final attachment in attachments)
            EvidenceUploadItemResult(
              localId: attachment.localId,
              success: false,
              userMessage:
                  "Sign in is required to upload evidence attachments.",
            ),
        ],
      );
    }

    final uploaded = <IncidentMediaReference>[];
    final failures = <EvidenceUploadItemResult>[];

    for (final attachment in attachments) {
      try {
        final reference = await _uploadService.uploadSingle(
          incidentId: incidentId,
          attachment: attachment,
          accessToken: accessToken,
          fallbackLatitude: fallbackLatitude,
          fallbackLongitude: fallbackLongitude,
          onProgress: onProgress,
        );
        uploaded.add(reference);
      } on EvidenceUploadFailure catch (error) {
        failures.add(
          EvidenceUploadItemResult(
            localId: attachment.localId,
            success: false,
            userMessage: error.message,
          ),
        );
      } catch (_) {
        failures.add(
          EvidenceUploadItemResult(
            localId: attachment.localId,
            success: false,
            userMessage: "Evidence upload failed. Try again.",
          ),
        );
      }
    }

    return EvidenceUploadBatchResult(
      uploaded: uploaded,
      failures: failures,
    );
  }
}
