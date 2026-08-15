import "dart:convert";

import "package:http/http.dart" as http;

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../evidence/local_evidence_attachment.dart";
import "../incidents/incident_submission_service.dart";

class BroadcastMediaUploadFailure implements Exception {
  BroadcastMediaUploadFailure(this.message, {this.localId});

  final String message;
  final String? localId;

  @override
  String toString() => message;
}

class BroadcastMediaUploadService {
  BroadcastMediaUploadService({
    TheEyeApiClient? apiClient,
    http.Client? httpClient,
  })  : _apiClient = apiClient ?? TheEyeApiClient(),
        _httpClient = httpClient;

  final TheEyeApiClient _apiClient;
  final http.Client? _httpClient;

  Future<List<Map<String, Object?>>> uploadAttachments({
    required List<LocalEvidenceAttachment> attachments,
    required String accessToken,
  }) async {
    if (attachments.isEmpty) return const [];
    final uploaded = <Map<String, Object?>>[];
    var photoCount = 0;
    var videoCount = 0;
    var audioCount = 0;

    for (final attachment in attachments) {
      try {
        final response = await _apiClient.postJson(
          TheEyeApiPaths.broadcastMediaPresign,
          {
            "mediaType": attachment.mediaType,
            "contentType": attachment.contentType,
            "fileName": attachment.fileName,
            "sizeBytes": attachment.sizeBytes,
          },
          accessToken: accessToken,
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw BroadcastMediaUploadFailure(
            IncidentApiException.fromResponse(response).userMessage,
            localId: attachment.localId,
          );
        }
        final decoded = jsonDecode(response.body);
        final map = decoded is Map ? decoded["data"] ?? decoded : decoded;
        final presign = Map<String, dynamic>.from(map as Map);
        final headersRaw = presign["requiredHeaders"];
        await _apiClient.uploadPresignedEvidence(
          uploadUrl: presign["uploadUrl"] as String,
          filePath: attachment.uploadPath,
          contentType: attachment.contentType,
          requiredHeaders: headersRaw is Map
              ? Map<String, String>.from(
                  headersRaw.map((key, value) => MapEntry("$key", "$value")),
                )
              : const {},
          httpClient: _httpClient,
        );

        final label = switch (attachment.mediaType) {
          "image" => "Photo ${++photoCount}",
          "video" => "Video ${++videoCount}",
          "audio" => "Audio ${++audioCount}",
          _ => "Attachment",
        };
        uploaded.add({
          "mediaType": attachment.mediaType,
          "bucket": "${presign["bucket"]}",
          "objectKey": "${presign["objectKey"]}",
          "contentType": attachment.contentType,
          "fileName": attachment.fileName,
          "clientAttachmentId": attachment.localId,
          "label": label,
          "fileHash": attachment.fileHash,
          "sizeBytes": attachment.sizeBytes,
          if (attachment.durationSeconds != null)
            "durationSeconds": attachment.durationSeconds,
        });
      } on IncidentApiException catch (error) {
        throw BroadcastMediaUploadFailure(
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
