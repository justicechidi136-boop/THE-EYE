import "dart:io";
import "dart:typed_data";

import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";
import "package:uuid/uuid.dart";

import "evidence_media_source.dart";
import "evidence_compressor.dart";
import "evidence_constants.dart";
import "evidence_error_codes.dart";
import "evidence_hash.dart";
import "evidence_validation.dart";
import "local_evidence_attachment.dart";

class EvidenceCaptureResult {
  const EvidenceCaptureResult.success(this.attachment)
      : errorMessage = null,
        cancelled = false;
  const EvidenceCaptureResult.cancelled()
      : attachment = null,
        errorMessage = null,
        cancelled = true;
  const EvidenceCaptureResult.failure(this.errorMessage)
      : attachment = null,
        cancelled = false;

  final LocalEvidenceAttachment? attachment;
  final String? errorMessage;
  final bool cancelled;

  bool get isSuccess => attachment != null;
}

class EvidenceCaptureService {
  EvidenceCaptureService({
    EvidenceCompressor? compressor,
    Uuid? uuid,
    Future<Directory> Function()? documentsDirectoryProvider,
  })  : _compressor = compressor ?? DefaultEvidenceCompressor(),
        _uuid = uuid ?? const Uuid(),
        _documentsDirectoryProvider =
            documentsDirectoryProvider ?? getApplicationDocumentsDirectory;

  final EvidenceCompressor _compressor;
  final Uuid _uuid;
  final Future<Directory> Function() _documentsDirectoryProvider;

  Future<EvidenceCaptureResult> ingestPickedFile({
    required PickedEvidenceFile picked,
    required String mediaType,
    required bool lowDataMode,
    double? latitude,
    double? longitude,
  }) async {
    try {
      final evidenceId = _uuid.v4();
      final sourcePath = await _resolveSourcePath(picked, evidenceId);
      final contentType = EvidenceValidation.normalizeMimeType(picked.mimeType,
          fileName: picked.fileName);
      await EvidenceValidation.validateFile(
        path: sourcePath,
        fileName: picked.fileName,
        mediaType: mediaType,
        mimeType: contentType,
        durationSeconds: picked.durationSeconds,
      );

      final originalPath = await _preserveOriginal(
        sourcePath,
        evidenceId,
        picked.fileName,
        fallbackBytes: picked.bytes,
      );
      final uploadPath = await _prepareUploadCopy(
        sourcePath: originalPath,
        fileName: picked.fileName,
        contentType: contentType,
        lowDataMode: lowDataMode,
        evidenceId: evidenceId,
      );

      final originalFileHash = await sha256FileHash(originalPath);
      final uploadFileHash = await sha256FileHash(uploadPath);
      final uploadSize = await File(uploadPath).length();
      final capturedAt = DateTime.now().toUtc();

      final attachment = LocalEvidenceAttachment(
        localId: evidenceId,
        mediaType: mediaType,
        fileName: picked.fileName,
        originalPath: originalPath,
        uploadPath: uploadPath,
        contentType: contentType,
        fileHash: uploadFileHash,
        originalFileHash: originalFileHash,
        sizeBytes: uploadSize,
        capturedAt: capturedAt,
        latitude: latitude,
        longitude: longitude,
        durationSeconds: picked.durationSeconds,
        metadata: {
          "captureSource": "mobile",
          "hashSource": uploadPath == originalPath
              ? "original"
              : "compressed_upload_copy",
          "originalFileHash": originalFileHash,
          "capturedAtSource": "device_clock",
          if (latitude != null) "latitudeSource": "device_gps",
          if (longitude != null) "longitudeSource": "device_gps",
        },
      );
      return EvidenceCaptureResult.success(attachment);
    } on EvidenceValidationException catch (error) {
      return EvidenceCaptureResult.failure(error.message);
    } catch (error, _) {
      // EVIDENCE-001 / EVIDENCE-002 — user-facing message stays friendly.
      if (error is _EvidenceSourceException) {
        return const EvidenceCaptureResult.failure(
            "Unable to prepare evidence file.");
      }
      return const EvidenceCaptureResult.failure(
          "Unable to prepare evidence file.");
    }
  }

  Future<void> cleanupAttachments(
      Iterable<LocalEvidenceAttachment> attachments) async {
    final paths = <String>{};
    for (final attachment in attachments) {
      paths.add(attachment.originalPath);
      if (attachment.uploadPath != attachment.originalPath) {
        paths.add(attachment.uploadPath);
      }
    }
    for (final path in paths) {
      final file = File(path);
      if (await file.exists()) {
        await file.delete();
      }
    }
  }

  Future<String> _resolveSourcePath(
      PickedEvidenceFile picked, String evidenceId) async {
    if (picked.bytes != null && picked.bytes!.isNotEmpty) {
      return _writeBytesToCache(picked.bytes!, evidenceId, picked.fileName);
    }
    if (picked.path.isNotEmpty && await File(picked.path).exists()) {
      return picked.path;
    }
    throw _EvidenceSourceException(EvidenceErrorCodes.sourceUnavailable);
  }

  Future<String> _writeBytesToCache(
      Uint8List bytes, String evidenceId, String fileName) async {
    final directory = await _documentsDirectoryProvider();
    final cacheDir =
        Directory(p.join(directory.path, "the_eye_evidence_cache"));
    if (!await cacheDir.exists()) {
      await cacheDir.create(recursive: true);
    }
    final extension = p.extension(fileName);
    final target = p.join(cacheDir.path, "$evidenceId$extension");
    await File(target).writeAsBytes(bytes, flush: true);
    return target;
  }

  Future<String> _preserveOriginal(
      String sourcePath, String evidenceId, String fileName,
      {Uint8List? fallbackBytes}) async {
    final directory = await _documentsDirectoryProvider();
    final originalDir =
        Directory(p.join(directory.path, "the_eye_evidence_original"));
    if (!await originalDir.exists()) {
      await originalDir.create(recursive: true);
    }
    final extension = p.extension(fileName);
    final target = p.join(originalDir.path, "$evidenceId$extension");

    final sourceFile = File(sourcePath);
    if (await sourceFile.exists()) {
      try {
        await sourceFile.copy(target);
        return target;
      } catch (_) {
        // Fall through to bytes fallback.
      }
    }

    if (fallbackBytes != null && fallbackBytes.isNotEmpty) {
      await File(target).writeAsBytes(fallbackBytes, flush: true);
      return target;
    }

    throw _EvidenceSourceException(EvidenceErrorCodes.persistFailed);
  }

  Future<String> _prepareUploadCopy({
    required String sourcePath,
    required String fileName,
    required String contentType,
    required bool lowDataMode,
    required String evidenceId,
  }) async {
    try {
      return await _compressor.prepareUploadCopy(
        sourcePath: sourcePath,
        fileName: fileName,
        contentType: contentType,
        lowDataMode: lowDataMode,
        evidenceId: evidenceId,
      );
    } catch (_) {
      return sourcePath;
    }
  }
}

class _EvidenceSourceException implements Exception {
  _EvidenceSourceException(this.code);

  final String code;
}
