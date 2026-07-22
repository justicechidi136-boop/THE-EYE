import "dart:convert";

import "package:http/http.dart" as http;

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../evidence/local_evidence_attachment.dart";
import "neighborhood_watch_service.dart";

class CommunityMediaUploadFailure implements Exception {
  CommunityMediaUploadFailure(this.message, {this.localId});

  final String message;
  final String? localId;

  @override
  String toString() => message;
}

typedef CommunityMediaUploadProgress = void Function(
    String localId, double progress);

class CommunityMediaUploadService {
  CommunityMediaUploadService({
    TheEyeApiClient? apiClient,
    http.Client? httpClient,
  })  : _apiClient = apiClient ??
            TheEyeApiClient(baseUrl: TheEyeApiPaths.defaultBaseUrl),
        _httpClient = httpClient;

  final TheEyeApiClient _apiClient;
  final http.Client? _httpClient;

  Future<List<CommunityPostMediaItem>> uploadForPost({
    required String communityId,
    required List<LocalEvidenceAttachment> attachments,
    required String accessToken,
    CommunityMediaUploadProgress? onProgress,
  }) async {
    if (attachments.isEmpty) return [];
    final uploaded = <CommunityPostMediaItem>[];
    for (final attachment in attachments) {
      try {
        onProgress?.call(attachment.localId, 0.1);
        final response = await _apiClient.postJson(
          TheEyeApiPaths.neighborhoodWatchCommunityPostMediaPresign(
              communityId),
          {
            "mediaType": attachment.mediaType,
            "contentType": attachment.contentType,
            "fileName": attachment.fileName,
            "sizeBytes": attachment.sizeBytes,
          },
          accessToken: accessToken,
        );
        if (response.statusCode < 200 || response.statusCode >= 300) {
          throw CommunityMediaUploadFailure(
            IncidentApiException.fromResponse(response).userMessage,
            localId: attachment.localId,
          );
        }
        final decoded = jsonDecode(response.body);
        final map = decoded is Map ? decoded["data"] ?? decoded : decoded;
        final presign = Map<String, dynamic>.from(map as Map);
        onProgress?.call(attachment.localId, 0.45);
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
        onProgress?.call(attachment.localId, 1);
        uploaded.add(
          CommunityPostMediaItem(
            mediaType: attachment.mediaType,
            bucket: presign["bucket"] as String,
            objectKey: presign["objectKey"] as String,
            contentType: attachment.contentType,
            fileHash: attachment.fileHash,
          ),
        );
      } on IncidentApiException catch (error) {
        throw CommunityMediaUploadFailure(
          error.userMessage.isNotEmpty
              ? error.userMessage
              : "Media upload failed.",
          localId: attachment.localId,
        );
      } on CommunityMediaUploadFailure {
        rethrow;
      } catch (_) {
        throw CommunityMediaUploadFailure(
          "Media upload is unavailable. Attachments were not uploaded.",
          localId: attachment.localId,
        );
      }
    }
    return uploaded;
  }
}
