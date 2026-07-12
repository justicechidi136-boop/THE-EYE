import "dart:io";

import "package:flutter_image_compress/flutter_image_compress.dart";
import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";

import "evidence_constants.dart";

abstract class EvidenceCompressor {
  Future<String> prepareUploadCopy({
    required String sourcePath,
    required String fileName,
    required String contentType,
    required bool lowDataMode,
    required String evidenceId,
  });
}

class DefaultEvidenceCompressor implements EvidenceCompressor {
  @override
  Future<String> prepareUploadCopy({
    required String sourcePath,
    required String fileName,
    required String contentType,
    required bool lowDataMode,
    required String evidenceId,
  }) async {
    if (!EvidenceMimeTypes.image.contains(contentType)) {
      return sourcePath;
    }

    final directory = await getApplicationDocumentsDirectory();
    final outputDir =
        Directory(p.join(directory.path, "the_eye_evidence_upload"));
    if (!await outputDir.exists()) {
      await outputDir.create(recursive: true);
    }

    final extension =
        p.extension(fileName).isEmpty ? ".jpg" : p.extension(fileName);
    final targetPath = p.join(outputDir.path, "$evidenceId$extension");
    final result = await FlutterImageCompress.compressAndGetFile(
      sourcePath,
      targetPath,
      quality: lowDataMode
          ? EvidenceLimits.imageQualityLowData
          : EvidenceLimits.imageQualityNormal,
      minWidth: EvidenceLimits.maxImageEdgePx,
      minHeight: EvidenceLimits.maxImageEdgePx,
      keepExif: false,
    );
    return result?.path ?? sourcePath;
  }
}

class InMemoryEvidenceCompressor implements EvidenceCompressor {
  String? forcedUploadPath;

  @override
  Future<String> prepareUploadCopy({
    required String sourcePath,
    required String fileName,
    required String contentType,
    required bool lowDataMode,
    required String evidenceId,
  }) async {
    return forcedUploadPath ?? sourcePath;
  }
}
