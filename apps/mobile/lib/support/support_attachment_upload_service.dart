import "package:http/http.dart" as http;

import "../contracts/the_eye_api_client.dart";
import "../evidence/local_evidence_attachment.dart";
import "support_service.dart";

class SupportAttachmentUploadService {
  SupportAttachmentUploadService({
    SupportService? supportService,
    TheEyeApiClient? apiClient,
    http.Client? httpClient,
  })  : _supportService = supportService ?? SupportService(),
        _apiClient = apiClient ?? TheEyeApiClient(),
        _httpClient = httpClient;

  final SupportService _supportService;
  final TheEyeApiClient _apiClient;
  final http.Client? _httpClient;

  Future<String> uploadVoice({
    required String accessToken,
    required String conversationId,
    required LocalEvidenceAttachment attachment,
    void Function(double progress)? onProgress,
  }) async {
    onProgress?.call(0.1);
    final presign = await _supportService.presignAttachment(
      accessToken: accessToken,
      conversationId: conversationId,
      fileName: attachment.fileName,
      contentType: attachment.contentType,
      sizeBytes: attachment.sizeBytes,
    );
    onProgress?.call(0.35);
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
    onProgress?.call(0.85);
    final objectKey = presign["objectKey"] as String;
    await _supportService.confirmAttachment(
      accessToken: accessToken,
      conversationId: conversationId,
      objectKey: objectKey,
      contentType: attachment.contentType,
    );
    onProgress?.call(1);
    return objectKey;
  }
}
