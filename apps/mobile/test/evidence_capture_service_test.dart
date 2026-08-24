import "dart:convert";
import "dart:io";
import "dart:typed_data";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:permission_handler/permission_handler.dart";

import "package:the_eye_mobile/broadcasts/broadcast_media_upload_service.dart";
import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_enums.dart";
import "package:the_eye_mobile/evidence/evidence_capture_controller.dart";
import "package:the_eye_mobile/evidence/evidence_capture_service.dart";
import "package:the_eye_mobile/evidence/evidence_compressor.dart";
import "package:the_eye_mobile/evidence/evidence_hash.dart";
import "package:the_eye_mobile/evidence/evidence_media_source.dart";
import "package:the_eye_mobile/evidence/evidence_permission_service.dart";
import "package:the_eye_mobile/evidence/evidence_permission_state.dart";
import "package:the_eye_mobile/evidence/evidence_policy.dart";
import "package:the_eye_mobile/evidence/evidence_upload_coordinator.dart";
import "package:the_eye_mobile/evidence/evidence_upload_service.dart";
import "package:the_eye_mobile/evidence/evidence_constants.dart";
import "package:the_eye_mobile/evidence/evidence_validation.dart";
import "package:the_eye_mobile/evidence/local_evidence_attachment.dart";

Future<File> writeTempJpeg(String name, {int size = 128}) async {
  final file = File("${Directory.systemTemp.path}/$name");
  final bytes = <int>[
    0xFF,
    0xD8,
    0xFF,
    0xE0,
    0x00,
    0x10,
    0x4A,
    0x46,
    0x49,
    0x46
  ];
  while (bytes.length < size) {
    bytes.add(0xAB);
  }
  await file.writeAsBytes(bytes);
  return file;
}

Future<File> writeTempMp4(String name, {int size = 256}) async {
  final file = File("${Directory.systemTemp.path}/$name");
  final bytes = <int>[
    0x00,
    0x00,
    0x00,
    0x18,
    0x66,
    0x74,
    0x79,
    0x70,
    0x6D,
    0x70,
    0x34,
    0x32,
  ];
  while (bytes.length < size) {
    bytes.add(0x00);
  }
  await file.writeAsBytes(bytes);
  return file;
}

Future<File> writeTempGif(String name, {int size = 128}) async {
  final file = File("${Directory.systemTemp.path}/$name");
  final bytes = <int>[0x47, 0x49, 0x46, 0x38, 0x39, 0x61];
  while (bytes.length < size) {
    bytes.add(0x00);
  }
  await file.writeAsBytes(bytes);
  return file;
}

Future<Directory> testDocumentsDir() async {
  final dir = Directory("${Directory.systemTemp.path}/the_eye_evidence_test");
  if (!await dir.exists()) {
    await dir.create(recursive: true);
  }
  return dir;
}

EvidencePermissionService grantedPermissionService() {
  return EvidencePermissionService(
    checkPermission: (_) async => PermissionStatus.granted,
    requestPermission: (_) async => PermissionStatus.granted,
  );
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();
  group("EvidencePermissionService", () {
    test("maps denied before request to not requested", () async {
      final service = EvidencePermissionService(
        checkPermission: (_) async => PermissionStatus.denied,
        requestPermission: (_) async => PermissionStatus.granted,
      );
      expect(await service.cameraState(), EvidencePermissionState.notRequested);
    });

    test("maps permanently denied and restricted states", () async {
      final blocked = EvidencePermissionService(
        checkPermission: (_) async => PermissionStatus.permanentlyDenied,
        requestPermission: (_) async => PermissionStatus.permanentlyDenied,
      );
      final restricted = EvidencePermissionService(
        checkPermission: (_) async => PermissionStatus.restricted,
        requestPermission: (_) async => PermissionStatus.restricted,
      );
      expect(await blocked.cameraState(),
          EvidencePermissionState.permanentlyDenied);
      expect(
          await restricted.cameraState(), EvidencePermissionState.restricted);
    });
  });

  group("EvidenceValidation", () {
    test("accepts animated GIF image evidence", () async {
      final file = await writeTempGif("neighborhood-chat.gif");
      await EvidenceValidation.validateFile(
        path: file.path,
        fileName: "neighborhood-chat.gif",
        mediaType: IncidentMediaType.image,
        mimeType: "image/gif",
      );
    });

    test("rejects unsupported mime type and extension", () async {
      final file = File("${Directory.systemTemp.path}/bad-evidence.exe");
      await file.writeAsBytes(const [1, 2, 3, 4]);
      expect(
        () => EvidenceValidation.validateFile(
          path: file.path,
          fileName: "bad-evidence.exe",
          mediaType: IncidentMediaType.image,
        ),
        throwsA(isA<EvidenceValidationException>()),
      );
    });

    test("rejects corrupt image magic bytes", () async {
      final file = File("${Directory.systemTemp.path}/corrupt.jpg");
      await file.writeAsBytes(const [0, 1, 2, 3, 4, 5, 6, 7]);
      expect(
        () => EvidenceValidation.validateFile(
          path: file.path,
          fileName: "corrupt.jpg",
          mediaType: IncidentMediaType.image,
          mimeType: "image/jpeg",
        ),
        throwsA(isA<EvidenceValidationException>()),
      );
    });

    test("rejects oversized files", () async {
      final file = await writeTempJpeg("huge.jpg", size: 1024);
      expect(
        () => EvidenceValidation.validateFile(
          path: file.path,
          fileName: "huge.jpg",
          mediaType: IncidentMediaType.image,
          mimeType: "image/jpeg",
        ),
        returnsNormally,
      );
      final oversized = File("${Directory.systemTemp.path}/oversized.jpg");
      final bytes = List<int>.filled(EvidenceLimits.maxFileBytes + 1, 0xAB);
      bytes[0] = 0xFF;
      bytes[1] = 0xD8;
      bytes[2] = 0xFF;
      await oversized.writeAsBytes(bytes);
      expect(
        () => EvidenceValidation.validateFile(
          path: oversized.path,
          fileName: "oversized.jpg",
          mediaType: IncidentMediaType.image,
          mimeType: "image/jpeg",
        ),
        throwsA(isA<EvidenceValidationException>()),
      );
    });
  });

  group("EvidenceCaptureService", () {
    test("GIF picker preserves private image upload metadata", () async {
      final gif = await writeTempGif("chat-picker.gif");
      final mediaSource = FakeEvidenceMediaSource()
        ..nextGif = PickedEvidenceFile(
          path: gif.path,
          fileName: "chat-picker.gif",
          mimeType: "image/gif",
        );
      final controller = EvidenceCaptureController(
        captureService: EvidenceCaptureService(
          compressor: InMemoryEvidenceCompressor(),
          documentsDirectoryProvider: testDocumentsDir,
        ),
        mediaSource: mediaSource,
        permissionService: grantedPermissionService(),
      );

      await controller.pickGif();

      expect(controller.attachments, hasLength(1));
      expect(controller.attachments.single.mediaType, IncidentMediaType.image);
      expect(controller.attachments.single.contentType, "image/gif");
      controller.dispose();
    });

    test("bundled GIF enters the same private image upload pipeline", () async {
      final controller = EvidenceCaptureController(
        captureService: EvidenceCaptureService(
          compressor: InMemoryEvidenceCompressor(),
          documentsDirectoryProvider: testDocumentsDir,
        ),
        mediaSource: FakeEvidenceMediaSource(),
        permissionService: grantedPermissionService(),
      );

      await controller.addBundledGif(
        fileName: "heart.gif",
        bytes: Uint8List.fromList([
          0x47,
          0x49,
          0x46,
          0x38,
          0x39,
          0x61,
          ...List<int>.filled(64, 0x00),
        ]),
      );

      expect(controller.attachments, hasLength(1));
      expect(controller.attachments.single.fileName, "heart.gif");
      expect(controller.attachments.single.contentType, "image/gif");
      controller.dispose();
    });

    test("empty selection returns validation failure", () async {
      final service = EvidenceCaptureService(
        compressor: InMemoryEvidenceCompressor(),
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(path: "", fileName: "cancelled.jpg"),
        mediaType: IncidentMediaType.image,
        lowDataMode: false,
      );
      expect(result.isSuccess, isFalse);
    });

    test("successful attachment computes hash and preserves metadata",
        () async {
      final file = await writeTempJpeg("evidence-success.jpg");
      final compressor = InMemoryEvidenceCompressor()
        ..forcedUploadPath = file.path;
      final service = EvidenceCaptureService(
        compressor: compressor,
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(
            path: file.path,
            fileName: "evidence-success.jpg",
            mimeType: "image/jpeg"),
        mediaType: IncidentMediaType.image,
        lowDataMode: false,
        latitude: 6.6018,
        longitude: 3.3515,
      );

      expect(result.isSuccess, isTrue);
      final attachment = result.attachment!;
      expect(attachment.fileHash, startsWith("sha256:"));
      expect(attachment.originalFileHash, startsWith("sha256:"));
      expect(attachment.latitude, 6.6018);
      expect(attachment.longitude, 3.3515);
      expect(attachment.metadata["capturedAtSource"], "device_clock");
      expect(attachment.metadata["latitudeSource"], "device_gps");
    });

    test("invalid files return user-facing failure", () async {
      final file = File("${Directory.systemTemp.path}/invalid.png");
      await file.writeAsBytes(const [1, 2, 3]);
      final service = EvidenceCaptureService(
        compressor: InMemoryEvidenceCompressor(),
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(
            path: file.path, fileName: "invalid.png", mimeType: "image/png"),
        mediaType: IncidentMediaType.image,
        lowDataMode: false,
      );
      expect(result.isSuccess, isFalse);
      expect(result.errorMessage, isNotNull);
    });

    test("ingests gallery bytes without a readable source path", () async {
      final bytes = Uint8List.fromList([
        0xFF,
        0xD8,
        0xFF,
        0xE0,
        0x00,
        0x10,
        0x4A,
        0x46,
        0x49,
        0x46,
        ...List<int>.filled(118, 0xAB),
      ]);
      final compressor = InMemoryEvidenceCompressor();
      final service = EvidenceCaptureService(
        compressor: compressor,
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(
          path: "",
          fileName: "gallery-photo.jpg",
          mimeType: "image/jpeg",
          bytes: bytes,
        ),
        mediaType: IncidentMediaType.image,
        lowDataMode: false,
      );

      expect(result.isSuccess, isTrue);
      final attachment = result.attachment!;
      expect(await File(attachment.originalPath).exists(), isTrue);
      expect(await File(attachment.uploadPath).exists(), isTrue);
      expect(attachment.fileHash, startsWith("sha256:"));
    });

    test("preserves selected video duration metadata", () async {
      final file = await writeTempMp4("video-probe.mp4", size: 2048);
      final service = EvidenceCaptureService(
        compressor: InMemoryEvidenceCompressor()..forcedUploadPath = file.path,
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(
          path: file.path,
          fileName: "video-probe.mp4",
          mimeType: "video/mp4",
          durationSeconds: 24,
        ),
        mediaType: IncidentMediaType.video,
        lowDataMode: false,
      );
      expect(result.isSuccess, isTrue);
      expect(result.attachment?.durationSeconds, 24);
    });

    test("preserves selected audio duration metadata", () async {
      final file = await writeTempMp4("audio-probe.m4a", size: 2048);
      final service = EvidenceCaptureService(
        compressor: InMemoryEvidenceCompressor()..forcedUploadPath = file.path,
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(
          path: file.path,
          fileName: "audio-probe.m4a",
          mimeType: "audio/mp4",
          durationSeconds: 12,
        ),
        mediaType: IncidentMediaType.audio,
        lowDataMode: false,
      );
      expect(result.isSuccess, isTrue);
      expect(result.attachment?.durationSeconds, 12);
    });

    test("falls back to original file when image compression fails", () async {
      final file = await writeTempJpeg("compression-fallback.jpg");
      final service = EvidenceCaptureService(
        compressor: ThrowingEvidenceCompressor(),
        documentsDirectoryProvider: testDocumentsDir,
      );
      final result = await service.ingestPickedFile(
        picked: PickedEvidenceFile(
          path: file.path,
          fileName: "compression-fallback.jpg",
          mimeType: "image/jpeg",
        ),
        mediaType: IncidentMediaType.image,
        lowDataMode: false,
      );

      expect(result.isSuccess, isTrue);
      expect(result.attachment?.uploadPath, result.attachment?.originalPath);
      expect(result.attachment?.metadata["hashSource"], "original");
    });
  });

  group("EvidenceCaptureController", () {
    test("multi-image selection keeps valid files and reports skipped limit",
        () async {
      final first = await writeTempJpeg("batch-first.jpg");
      final second = await writeTempJpeg("batch-second.jpg");
      final third = await writeTempJpeg("batch-third.jpg");
      final mediaSource = FakeEvidenceMediaSource()
        ..nextImages = [
          PickedEvidenceFile(
            path: first.path,
            fileName: "batch-first.jpg",
            mimeType: "image/jpeg",
          ),
          PickedEvidenceFile(
            path: second.path,
            fileName: "batch-second.jpg",
            mimeType: "image/jpeg",
          ),
          PickedEvidenceFile(
            path: third.path,
            fileName: "batch-third.jpg",
            mimeType: "image/jpeg",
          ),
        ];
      final controller = EvidenceCaptureController(
        captureService: EvidenceCaptureService(
          compressor: InMemoryEvidenceCompressor(),
          documentsDirectoryProvider: testDocumentsDir,
        ),
        mediaSource: mediaSource,
        permissionService: grantedPermissionService(),
        policy: const EvidencePolicy(
          maxPhotos: 2,
          maxVideos: 0,
          maxAudio: 0,
          maxFiles: 2,
          maxFileSize: EvidenceLimits.maxFileBytes,
          maxTotalBytes: 300 * 1024 * 1024,
          supportedMimeTypes: EvidenceMimeTypes.allowed,
        ),
      );

      await controller.pickImages();

      expect(controller.attachments, hasLength(2));
      expect(controller.attachments.map((item) => item.fileName), [
        "batch-first.jpg",
        "batch-second.jpg",
      ]);
      expect(controller.lastError, contains("2 files added"));
      expect(controller.lastError, contains("1 file skipped"));
      controller.dispose();
    });

    test("multi-audio selection keeps valid bytes-backed files", () async {
      final audioBytes = Uint8List.fromList([
        0x00,
        0x00,
        0x00,
        0x18,
        0x66,
        0x74,
        0x79,
        0x70,
        0x6D,
        0x70,
        0x34,
        0x32,
        ...List<int>.filled(128, 0x00),
      ]);
      final mediaSource = FakeEvidenceMediaSource()
        ..nextAudioFiles = [
          PickedEvidenceFile(
            path: "",
            fileName: "gallery-voice.m4a",
            mimeType: "audio/mp4",
            durationSeconds: 8,
            bytes: audioBytes,
          ),
        ];
      final controller = EvidenceCaptureController(
        captureService: EvidenceCaptureService(
          compressor: InMemoryEvidenceCompressor(),
          documentsDirectoryProvider: testDocumentsDir,
        ),
        mediaSource: mediaSource,
        permissionService: grantedPermissionService(),
      );

      await controller.pickAudio();

      expect(controller.attachments, hasLength(1));
      expect(controller.attachments.single.fileName, "gallery-voice.m4a");
      expect(controller.attachments.single.durationSeconds, 8);
      expect(controller.lastError, isNull);
      controller.dispose();
    });
  });

  group("EvidenceUploadService", () {
    test("upload failure surfaces without leaking incident details", () async {
      final storeFile = await writeTempJpeg("upload.jpg");
      final client = TheEyeApiClient(
        httpClient: MockClient(
            (request) async => http.Response("Service unavailable", 503)),
      );
      final uploader = EvidenceUploadService(apiClient: client);
      final attachment = LocalEvidenceAttachment(
        localId: "local-1",
        mediaType: IncidentMediaType.image,
        fileName: "upload.jpg",
        originalPath: storeFile.path,
        uploadPath: storeFile.path,
        contentType: "image/jpeg",
        fileHash: await sha256FileHash(storeFile.path),
        originalFileHash: await sha256FileHash(storeFile.path),
        sizeBytes: await storeFile.length(),
        capturedAt: DateTime.utc(2026, 7, 10, 2, 0),
      );

      expect(
        () => uploader.uploadForIncident(
          incidentId: "incident-1",
          attachments: [attachment],
          accessToken: "token",
          fallbackLatitude: 6.6,
          fallbackLongitude: 3.3,
        ),
        throwsA(isA<EvidenceUploadFailure>()),
      );
    });

    test("successful attachment uploads and confirms evidence", () async {
      final storeFile = await writeTempJpeg("upload-success.jpg");
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.method == "POST" &&
              request.url.path.endsWith("/media/presign")) {
            return http.Response(
              jsonEncode({
                "bucket": "the-eye",
                "objectKey":
                    "evidence/incident-1/11111111-1111-1111-1111-111111111111.jpg",
                "uploadUrl": "https://storage.example/upload",
                "requiredHeaders": {"content-type": "image/jpeg"},
              }),
              200,
            );
          }
          if (request.method == "PUT") {
            return http.Response("", 200);
          }
          if (request.method == "POST" &&
              request.url.path.endsWith("/media/confirm")) {
            return http.Response(
              jsonEncode({
                "mediaType": "Image",
                "bucket": "the-eye",
                "objectKey":
                    "evidence/incident-1/11111111-1111-1111-1111-111111111111.jpg",
                "contentType": "image/jpeg",
                "fileHash": "sha256:abc",
              }),
              200,
            );
          }
          return http.Response("not found", 404);
        }),
      );
      final uploader = EvidenceUploadService(apiClient: client);
      final attachment = LocalEvidenceAttachment(
        localId: "local-2",
        mediaType: IncidentMediaType.image,
        fileName: "upload-success.jpg",
        originalPath: storeFile.path,
        uploadPath: storeFile.path,
        contentType: "image/jpeg",
        fileHash: await sha256FileHash(storeFile.path),
        originalFileHash: await sha256FileHash(storeFile.path),
        sizeBytes: await storeFile.length(),
        capturedAt: DateTime.utc(2026, 7, 10, 2, 0),
      );

      final uploaded = await uploader.uploadForIncident(
        incidentId: "incident-1",
        attachments: [attachment],
        accessToken: "token",
        fallbackLatitude: 6.6,
        fallbackLongitude: 3.3,
      );

      expect(uploaded, hasLength(1));
      expect(uploaded.single.objectKey, contains("evidence/incident-1/"));
    });
  });

  group("EvidenceUploadCoordinator", () {
    test("continues batch when one attachment fails", () async {
      final goodFile = await writeTempJpeg("coord-good.jpg");
      final badFile = await writeTempJpeg("coord-bad.jpg");
      final client = TheEyeApiClient(
        httpClient: MockClient((request) async {
          if (request.method == "POST" &&
              request.url.path.endsWith("/media/presign")) {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            if (body["fileName"] == "coord-bad.jpg") {
              return http.Response("Service unavailable", 503);
            }
            return http.Response(
              jsonEncode({
                "bucket": "the-eye",
                "objectKey": "evidence/incident-1/good.jpg",
                "uploadUrl": "https://storage.example/upload/good",
                "requiredHeaders": {"content-type": "image/jpeg"},
              }),
              200,
            );
          }
          if (request.method == "PUT") {
            return http.Response("", 200);
          }
          if (request.method == "POST" &&
              request.url.path.endsWith("/media/confirm")) {
            final body = jsonDecode(request.body) as Map<String, dynamic>;
            return http.Response(
              jsonEncode({
                "mediaType": "Image",
                "bucket": "the-eye",
                "objectKey": "evidence/incident-1/good.jpg",
                "contentType": "image/jpeg",
                "fileHash": "sha256:abc",
                "clientAttachmentId": body["clientAttachmentId"],
              }),
              200,
            );
          }
          return http.Response("not found", 404);
        }),
      );
      final coordinator = EvidenceUploadCoordinator(
        uploadService: EvidenceUploadService(apiClient: client),
      );
      final attachments = [
        LocalEvidenceAttachment(
          localId: "local-good",
          mediaType: IncidentMediaType.image,
          fileName: "coord-good.jpg",
          originalPath: goodFile.path,
          uploadPath: goodFile.path,
          contentType: "image/jpeg",
          fileHash: await sha256FileHash(goodFile.path),
          originalFileHash: await sha256FileHash(goodFile.path),
          sizeBytes: await goodFile.length(),
          capturedAt: DateTime.utc(2026, 7, 10, 2, 0),
        ),
        LocalEvidenceAttachment(
          localId: "local-bad",
          mediaType: IncidentMediaType.image,
          fileName: "coord-bad.jpg",
          originalPath: badFile.path,
          uploadPath: badFile.path,
          contentType: "image/jpeg",
          fileHash: await sha256FileHash(badFile.path),
          originalFileHash: await sha256FileHash(badFile.path),
          sizeBytes: await badFile.length(),
          capturedAt: DateTime.utc(2026, 7, 10, 2, 0),
        ),
      ];

      final batch = await coordinator.uploadForIncident(
        incidentId: "incident-1",
        attachments: attachments,
        accessToken: "token",
        fallbackLatitude: 6.6,
        fallbackLongitude: 3.3,
      );

      expect(batch.uploaded, hasLength(1));
      expect(batch.failures, hasLength(1));
      expect(batch.failures.single.localId, "local-bad");
      expect(batch.isPartialSuccess, isTrue);
    });
  });

  group("BroadcastMediaUploadService", () {
    test("returns chain-of-custody metadata for broadcast attachments",
        () async {
      final storeFile = await writeTempMp4("broadcast-video.mp4", size: 2048);
      final client = TheEyeApiClient(
        baseUrl: "http://localhost:4000/v1",
        httpClient: MockClient((request) async {
          if (request.method == "POST" &&
              request.url.path.endsWith("/broadcasts/media/presign")) {
            return http.Response(
              jsonEncode({
                "bucket": "the-eye",
                "objectKey": "evidence/broadcast-user-1/video-1.mp4",
                "uploadUrl": "https://storage.example/broadcast/video-1",
                "requiredHeaders": {"content-type": "video/mp4"},
              }),
              200,
            );
          }
          if (request.method == "PUT") {
            return http.Response("", 200);
          }
          return http.Response("not found", 404);
        }),
      );
      final uploader = BroadcastMediaUploadService(apiClient: client);
      final attachment = LocalEvidenceAttachment(
        localId: "local-video",
        mediaType: IncidentMediaType.video,
        fileName: "broadcast-video.mp4",
        originalPath: storeFile.path,
        uploadPath: storeFile.path,
        contentType: "video/mp4",
        fileHash: await sha256FileHash(storeFile.path),
        originalFileHash: await sha256FileHash(storeFile.path),
        sizeBytes: await storeFile.length(),
        capturedAt: DateTime.utc(2026, 8, 14, 12, 0),
        durationSeconds: 24,
      );

      final uploaded = await uploader.uploadAttachments(
        attachments: [attachment],
        accessToken: "token",
      );

      expect(uploaded, hasLength(1));
      expect(uploaded.single["fileHash"], attachment.fileHash);
      expect(uploaded.single["sizeBytes"], attachment.sizeBytes);
      expect(uploaded.single["durationSeconds"], 24);
    });
  });
}

class ThrowingEvidenceCompressor implements EvidenceCompressor {
  @override
  Future<String> prepareUploadCopy({
    required String sourcePath,
    required String fileName,
    required String contentType,
    required bool lowDataMode,
    required String evidenceId,
  }) async {
    throw StateError("compression failed");
  }
}
