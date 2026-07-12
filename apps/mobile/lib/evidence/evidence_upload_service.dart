import "package:http/http.dart" as http;

import "../contracts/the_eye_api_client.dart";
import "../incidents/incident_media_reference.dart";
import "local_evidence_attachment.dart";

class EvidenceUploadFailure implements Exception {
  EvidenceUploadFailure(this.message, {this.localId});

  final String message;
  final String? localId;

  @override
  String toString() => message;
}

typedef EvidenceUploadProgress = void Function(String localId, double progress);

class EvidenceUploadService {
  EvidenceUploadService({
    required TheEyeApiClient apiClient,
    http.Client? httpClient,
  })  : _apiClient = apiClient,
        _httpClient = httpClient;

  final TheEyeApiClient _apiClient;
  final http.Client? _httpClient;

  Future<List<IncidentMediaReference>> uploadForIncident({
    required String incidentId,
    required List<LocalEvidenceAttachment> attachments,
    required String? accessToken,
    required double fallbackLatitude,
    required double fallbackLongitude,
    EvidenceUploadProgress? onProgress,
  }) async {
    if (attachments.isEmpty) return [];
    if (accessToken == null || accessToken.isEmpty) {
      throw EvidenceUploadFailure(
          "Sign in is required to upload evidence attachments.");
    }

    final uploaded = <IncidentMediaReference>[];
    for (final attachment in attachments) {
      try {
        onProgress?.call(attachment.localId, 0.1);
        final presign = await _apiClient.presignIncidentMedia(
          incidentId: incidentId,
          mediaType: attachment.mediaType,
          contentType: attachment.contentType,
          fileName: attachment.fileName,
          sizeBytes: attachment.sizeBytes,
          accessToken: accessToken,
        );
        onProgress?.call(attachment.localId, 0.45);

        await _apiClient.uploadPresignedEvidence(
          uploadUrl: presign.uploadUrl,
          filePath: attachment.uploadPath,
          contentType: attachment.contentType,
          requiredHeaders: presign.requiredHeaders,
          httpClient: _httpClient,
        );
        onProgress?.call(attachment.localId, 0.8);

        final confirmed = await _apiClient.confirmIncidentMedia(
          incidentId: incidentId,
          media: IncidentMediaReference(
            mediaType: attachment.mediaType,
            bucket: presign.bucket,
            objectKey: presign.objectKey,
            contentType: attachment.contentType,
            fileHash: attachment.fileHash,
            sizeBytes: attachment.sizeBytes,
            capturedAt: attachment.capturedAt.toUtc().toIso8601String(),
            latitude: attachment.latitude ?? fallbackLatitude,
            longitude: attachment.longitude ?? fallbackLongitude,
            metadata: {
              ...attachment.metadata,
              "localEvidenceId": attachment.localId,
              "originalFileHash": attachment.originalFileHash,
            },
          ),
          accessToken: accessToken,
        );
        uploaded.add(confirmed);
        onProgress?.call(attachment.localId, 1);
      } on IncidentApiException catch (error) {
        throw EvidenceUploadFailure(
          error.userMessage.isNotEmpty
              ? error.userMessage
              : "Evidence upload failed. Try again.",
          localId: attachment.localId,
        );
      }
    }
    return uploaded;
  }
}
