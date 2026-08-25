import 'dart:async';
import 'dart:io';

import 'package:http/http.dart' as http;
import 'package:image_picker/image_picker.dart';
import 'package:path_provider/path_provider.dart';
import 'package:record/record.dart';
import 'package:uuid/uuid.dart';

import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';

class FieldBroadcastAttachment {
  const FieldBroadcastAttachment({
    required this.id,
    required this.path,
    required this.fileName,
    required this.mediaType,
    required this.contentType,
    required this.sizeBytes,
    required this.capturedAt,
    this.durationSeconds,
  });

  final String id;
  final String path;
  final String fileName;
  final String mediaType;
  final String contentType;
  final int sizeBytes;
  final DateTime capturedAt;
  final int? durationSeconds;
}

class FieldBroadcastMediaService {
  FieldBroadcastMediaService({
    required FieldApiClient api,
    ImagePicker? picker,
    AudioRecorder? recorder,
    http.Client? httpClient,
  }) : _api = api,
       _picker = picker ?? ImagePicker(),
       _recorder = recorder ?? AudioRecorder(),
       _http = httpClient ?? http.Client();

  final FieldApiClient _api;
  final ImagePicker _picker;
  final AudioRecorder _recorder;
  final http.Client _http;
  final _uuid = const Uuid();
  DateTime? _recordingStartedAt;

  Future<List<FieldBroadcastAttachment>> pickPhotos() async {
    final images = await _picker.pickMultiImage(imageQuality: 88);
    return Future.wait(images.map((image) => _fromXFile(image, 'image')));
  }

  Future<FieldBroadcastAttachment?> pickVideo() async {
    final video = await _picker.pickVideo(source: ImageSource.gallery);
    return video == null ? null : _fromXFile(video, 'video');
  }

  Future<FieldBroadcastAttachment?> recordVideo() async {
    final video = await _picker.pickVideo(
      source: ImageSource.camera,
      maxDuration: const Duration(minutes: 5),
    );
    return video == null ? null : _fromXFile(video, 'video');
  }

  Future<void> startVoiceRecording() async {
    if (!await _recorder.hasPermission()) {
      throw StateError(
        'Microphone permission is required to record a voice note.',
      );
    }
    final directory = await getTemporaryDirectory();
    final path = '${directory.path}/field-broadcast-${_uuid.v4()}.m4a';
    await _recorder.start(
      const RecordConfig(encoder: AudioEncoder.aacLc),
      path: path,
    );
    _recordingStartedAt = DateTime.now();
  }

  Future<FieldBroadcastAttachment?> stopVoiceRecording() async {
    final path = await _recorder.stop();
    final startedAt = _recordingStartedAt;
    _recordingStartedAt = null;
    if (path == null || startedAt == null) return null;
    final file = File(path);
    if (!await file.exists()) return null;
    final seconds =
        DateTime.now().difference(startedAt).inSeconds.clamp(1, 3600).toInt();
    return FieldBroadcastAttachment(
      id: _uuid.v4(),
      path: path,
      fileName: path.split(Platform.pathSeparator).last,
      mediaType: 'audio',
      contentType: 'audio/mp4',
      sizeBytes: await file.length(),
      capturedAt: startedAt,
      durationSeconds: seconds,
    );
  }

  Future<void> cancelVoiceRecording() async {
    await _recorder.cancel();
    _recordingStartedAt = null;
  }

  Future<List<Map<String, Object?>>> uploadAll(
    List<FieldBroadcastAttachment> attachments,
  ) async {
    final uploaded = <Map<String, Object?>>[];
    for (final attachment in attachments) {
      final presignResponse = await _api.post(
        FieldApiPaths.broadcastsMediaPresign,
        body: {
          'fileName': attachment.fileName,
          'contentType': attachment.contentType,
          'mediaType': attachment.mediaType,
          'sizeBytes': attachment.sizeBytes,
        },
      );
      final presign = Map<String, dynamic>.from(
        (presignResponse['data'] as Map?) ?? presignResponse,
      );
      final uploadUrl = presign['uploadUrl']?.toString() ?? '';
      if (uploadUrl.isEmpty) {
        throw StateError('Evidence upload URL is unavailable.');
      }
      final request = http.StreamedRequest('PUT', Uri.parse(uploadUrl));
      request.contentLength = attachment.sizeBytes;
      final requiredHeaders = presign['requiredHeaders'];
      if (requiredHeaders is Map) {
        requiredHeaders.forEach((key, value) {
          request.headers[key.toString()] = value.toString();
        });
      } else {
        request.headers['content-type'] = attachment.contentType;
      }
      await request.sink.addStream(File(attachment.path).openRead());
      await request.sink.close();
      final response = await _http
          .send(request)
          .timeout(const Duration(minutes: 3));
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw StateError('Evidence upload failed (${response.statusCode}).');
      }
      uploaded.add({
        'mediaType': attachment.mediaType,
        'bucket': presign['bucket']?.toString() ?? '',
        'objectKey': presign['objectKey']?.toString() ?? '',
        'contentType': attachment.contentType,
        'fileName': attachment.fileName,
        'sizeBytes': attachment.sizeBytes,
        'capturedAt': attachment.capturedAt.toUtc().toIso8601String(),
        'clientAttachmentId': attachment.id,
        if (attachment.durationSeconds != null)
          'durationSeconds': attachment.durationSeconds,
      });
    }
    return uploaded;
  }

  Future<FieldBroadcastAttachment> _fromXFile(
    XFile source,
    String mediaType,
  ) async {
    final contentType = _contentType(source.name, mediaType);
    return FieldBroadcastAttachment(
      id: _uuid.v4(),
      path: source.path,
      fileName: source.name,
      mediaType: mediaType,
      contentType: contentType,
      sizeBytes: await source.length(),
      capturedAt: DateTime.now(),
    );
  }

  String _contentType(String fileName, String mediaType) {
    final extension = fileName.toLowerCase().split('.').last;
    if (mediaType == 'image') {
      return switch (extension) {
        'png' => 'image/png',
        'webp' => 'image/webp',
        'gif' => 'image/gif',
        _ => 'image/jpeg',
      };
    }
    return switch (extension) {
      'mov' => 'video/quicktime',
      'webm' => 'video/webm',
      _ => 'video/mp4',
    };
  }

  void dispose() {
    unawaited(_recorder.dispose());
    _http.close();
  }
}
