import "dart:io";

import "package:path/path.dart" as p;

import "../contracts/the_eye_api_client.dart";
import "../evidence/evidence_compressor.dart";

class AvatarUploadService {
  AvatarUploadService({
    TheEyeApiClient? apiClient,
    EvidenceCompressor? compressor,
  })  : _apiClient = apiClient ?? TheEyeApiClient(),
        _compressor = compressor ?? DefaultEvidenceCompressor();

  final TheEyeApiClient _apiClient;
  final EvidenceCompressor _compressor;

  Future<CitizenProfile> uploadAvatar({
    required String accessToken,
    required String sourcePath,
    required bool lowDataMode,
  }) async {
    final extension = p.extension(sourcePath).toLowerCase();
    final contentType = switch (extension) {
      ".png" => "image/png",
      ".webp" => "image/webp",
      _ => "image/jpeg",
    };
    final fileName =
        p.basename(sourcePath).isEmpty ? "avatar.jpg" : p.basename(sourcePath);

    final uploadPath = await _compressor.prepareUploadCopy(
      sourcePath: sourcePath,
      fileName: fileName,
      contentType: contentType,
      lowDataMode: lowDataMode,
      evidenceId: "avatar-${DateTime.now().millisecondsSinceEpoch}",
    );
    final sizeBytes = await File(uploadPath).length();

    final presigned = await _apiClient.presignAvatar(
      accessToken: accessToken,
      contentType: contentType,
      fileName: fileName,
      sizeBytes: sizeBytes,
    );

    await _apiClient.uploadPresignedEvidence(
      uploadUrl: presigned.uploadUrl,
      filePath: uploadPath,
      contentType: contentType,
      requiredHeaders: presigned.requiredHeaders,
    );

    return _apiClient.confirmAvatar(
      accessToken: accessToken,
      objectKey: presigned.objectKey,
      bucket: presigned.bucket,
      contentType: contentType,
    );
  }
}

String avatarUploadErrorMessage(Object error) {
  if (error is AuthApiException) {
    final message = error.userMessage.toLowerCase();
    if (message.contains("storage") || message.contains("configured")) {
      return "Avatar storage is unavailable right now. Try again later.";
    }
    return error.userMessage;
  }
  return "Unable to upload avatar right now.";
}
