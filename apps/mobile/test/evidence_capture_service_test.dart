import "dart:convert";
import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:http/http.dart" as http;
import "package:http/testing.dart";
import "package:permission_handler/permission_handler.dart";

import "package:the_eye_mobile/contracts/the_eye_api_client.dart";
import "package:the_eye_mobile/contracts/the_eye_enums.dart";
import "package:the_eye_mobile/evidence/evidence_capture_service.dart";
import "package:the_eye_mobile/evidence/evidence_compressor.dart";
import "package:the_eye_mobile/evidence/evidence_hash.dart";
import "package:the_eye_mobile/evidence/evidence_media_source.dart";
import "package:the_eye_mobile/evidence/evidence_permission_service.dart";
import "package:the_eye_mobile/evidence/evidence_permission_state.dart";
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

Future<Directory> testDocumentsDir() async {
  final dir = Directory("${Directory.systemTemp.path}/the_eye_evidence_test");
  if (!await dir.exists()) {
    await dir.create(recursive: true);
  }
  return dir;
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
}
