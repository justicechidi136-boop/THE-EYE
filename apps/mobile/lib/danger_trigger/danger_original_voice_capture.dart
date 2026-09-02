import "dart:io";

import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";
import "package:record/record.dart";
import "package:uuid/uuid.dart";

import "../contracts/the_eye_enums.dart";
import "../evidence/evidence_hash.dart";
import "../evidence/evidence_upload_service.dart";
import "../evidence/local_evidence_attachment.dart";

abstract interface class DangerOriginalVoiceCapture {
  Future<void> start();
  Future<LocalEvidenceAttachment?> stop();
  Future<void> cancel();
  Future<void> dispose();
}

abstract interface class DangerOriginalVoiceUploader {
  Future<void> upload({
    required String incidentId,
    required LocalEvidenceAttachment attachment,
    required String accessToken,
    required double? latitude,
    required double? longitude,
  });
}

class EvidenceDangerOriginalVoiceUploader
    implements DangerOriginalVoiceUploader {
  EvidenceDangerOriginalVoiceUploader(this._service);

  final EvidenceUploadService _service;

  @override
  Future<void> upload({
    required String incidentId,
    required LocalEvidenceAttachment attachment,
    required String accessToken,
    required double? latitude,
    required double? longitude,
  }) async {
    final temporaryFile = File(attachment.uploadPath);
    try {
      await _service.uploadSingle(
        incidentId: incidentId,
        attachment: attachment,
        accessToken: accessToken,
        fallbackLatitude: latitude,
        fallbackLongitude: longitude,
      );
    } finally {
      if (await temporaryFile.exists()) await temporaryFile.delete();
    }
  }
}

class DeviceDangerOriginalVoiceCapture implements DangerOriginalVoiceCapture {
  DeviceDangerOriginalVoiceCapture({AudioRecorder? recorder})
      : _recorder = recorder ?? AudioRecorder();

  final AudioRecorder _recorder;
  String? _path;
  DateTime? _startedAt;

  @override
  Future<void> start() async {
    final directory = await getTemporaryDirectory();
    final path = p.join(
      directory.path,
      "danger-original-${const Uuid().v4()}.m4a",
    );
    await _recorder.start(
      const RecordConfig(
        encoder: AudioEncoder.aacLc,
        bitRate: 64000,
        sampleRate: 44100,
        numChannels: 1,
      ),
      path: path,
    );
    _path = path;
    _startedAt = DateTime.now();
  }

  @override
  Future<LocalEvidenceAttachment?> stop() async {
    final recordedPath = await _recorder.stop() ?? _path;
    final startedAt = _startedAt;
    _path = null;
    _startedAt = null;
    if (recordedPath == null || startedAt == null) return null;
    final file = File(recordedPath);
    if (!await file.exists()) return null;
    final sizeBytes = await file.length();
    if (sizeBytes <= 0) return null;
    final fileHash = await sha256FileHash(recordedPath);
    final durationSeconds = DateTime.now().difference(startedAt).inSeconds;
    return LocalEvidenceAttachment(
      localId: const Uuid().v4(),
      mediaType: IncidentMediaType.audio,
      fileName: p.basename(recordedPath),
      originalPath: recordedPath,
      uploadPath: recordedPath,
      contentType: "audio/mp4",
      fileHash: fileHash,
      originalFileHash: fileHash,
      sizeBytes: sizeBytes,
      capturedAt: startedAt.toUtc(),
      durationSeconds: durationSeconds < 1 ? 1 : durationSeconds,
      metadata: const {
        "voiceReport": true,
        "source": "danger_trigger_original_voice",
        "provenance": "ORIGINAL_VOICE_NOTE",
      },
    );
  }

  @override
  Future<void> cancel() async {
    String? recordedPath;
    try {
      recordedPath = await _recorder.stop();
    } catch (_) {
      // Preparation can fail before the recorder has fully started.
    }
    recordedPath ??= _path;
    _path = null;
    _startedAt = null;
    if (recordedPath == null) return;
    final file = File(recordedPath);
    if (await file.exists()) await file.delete();
  }

  @override
  Future<void> dispose() => _recorder.dispose();
}
