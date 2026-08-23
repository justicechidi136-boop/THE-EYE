import "dart:convert";
import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:permission_handler/permission_handler.dart";

import "package:the_eye_mobile/contracts/the_eye_enums.dart";
import "package:the_eye_mobile/evidence/evidence_attachment_picker.dart";
import "package:the_eye_mobile/evidence/evidence_capture_controller.dart";
import "package:the_eye_mobile/evidence/evidence_capture_service.dart";
import "package:the_eye_mobile/evidence/evidence_media_source.dart";
import "package:the_eye_mobile/evidence/evidence_permission_service.dart";
import "package:the_eye_mobile/evidence/evidence_policy.dart";
import "package:the_eye_mobile/evidence/evidence_viewer_screen.dart";
import "package:the_eye_mobile/evidence/local_evidence_attachment.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  late Directory tempDir;

  setUp(() {
    tempDir = Directory.systemTemp.createTempSync("eye-evidence-picker-");
  });

  tearDown(() {
    if (tempDir.existsSync()) tempDir.deleteSync(recursive: true);
  });

  testWidgets("empty state opens the unified add evidence sheet",
      (tester) async {
    final controller = _controller();
    addTearDown(controller.dispose);

    await _pumpPicker(tester, controller);

    expect(find.text("Photos 0/6"), findsOneWidget);
    expect(find.text("Videos 0/2"), findsOneWidget);
    expect(find.text("Audio 0/2"), findsOneWidget);
    expect(find.text("Add evidence"), findsOneWidget);
    expect(find.text("Audio / Voice report"), findsNothing);

    await tester.tap(find.text("Add evidence"));
    await tester.pumpAndSettle();

    expect(find.text("Camera"), findsOneWidget);
    expect(find.text("Gallery"), findsOneWidget);
    expect(find.text("Video"), findsOneWidget);
    expect(find.text("Record voice"), findsOneWidget);
    expect(find.text("Choose audio file"), findsOneWidget);

    await tester.tap(find.text("Record voice"));
    await tester.pumpAndSettle();
    expect(find.text("Audio / Voice report"), findsOneWidget);
  });

  testWidgets("reports attachment count after build without parent setState",
      (tester) async {
    final controller = _controller();
    addTearDown(controller.dispose);
    var reportedCount = -1;

    tester.view.physicalSize = const Size(390, 844);
    tester.view.devicePixelRatio = 1;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);
    await tester.pumpWidget(
      MaterialApp(
        home: StatefulBuilder(
          builder: (context, setState) => Scaffold(
            body: EvidenceAttachmentPicker(
              controller: controller,
              lowDataMode: false,
              onAttachmentsChanged: (count) {
                setState(() => reportedCount = count);
              },
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(tester.takeException(), isNull);
    expect(reportedCount, 0);
  });

  testWidgets("renders mixed evidence in order with preview and remove",
      (tester) async {
    final image = File("${tempDir.path}${Platform.pathSeparator}photo.png")
      ..writeAsBytesSync(base64Decode(_onePixelPng));
    final controller = _controller();
    addTearDown(controller.dispose);
    controller.attachments.addAll([
      _attachment(
        id: "photo-1",
        mediaType: IncidentMediaType.image,
        path: image.path,
        contentType: "image/png",
      ),
      _attachment(
        id: "video-1",
        mediaType: IncidentMediaType.video,
        path: "${tempDir.path}${Platform.pathSeparator}video.mp4",
        contentType: "video/mp4",
        durationSeconds: 24,
      ),
      _attachment(
        id: "audio-1",
        mediaType: IncidentMediaType.audio,
        path: "${tempDir.path}${Platform.pathSeparator}audio.m4a",
        contentType: "audio/mp4",
        durationSeconds: 12,
      ),
    ]);

    await _pumpPicker(tester, controller);

    expect(find.text("Photos 1/6"), findsOneWidget);
    expect(find.text("Videos 1/2"), findsOneWidget);
    expect(find.text("Audio 1/2"), findsOneWidget);
    expect(find.text("Photo"), findsOneWidget);
    expect(find.text("Video"), findsOneWidget);
    expect(find.text("00:24"), findsOneWidget);
    expect(find.text("Audio 1 · 00:12"), findsOneWidget);
    expect(find.text("00:12"), findsOneWidget);
    expect(find.byTooltip("Play audio"), findsOneWidget);

    await tester.tap(find.byTooltip("Remove Video 1 · 00:24"));
    await tester.pump();
    expect(find.text("Videos 0/2"), findsOneWidget);
    expect(controller.attachments.map((item) => item.localId),
        isNot(contains("video-1")));

    await tester.tap(find.byTooltip("Remove Photo 1"));
    await tester.pump();
    expect(find.text("Photos 0/6"), findsOneWidget);
  });

  testWidgets("photo tile opens a larger preview", (tester) async {
    final image = File("${tempDir.path}${Platform.pathSeparator}preview.png")
      ..writeAsBytesSync(base64Decode(_onePixelPng));
    final controller = _controller();
    addTearDown(controller.dispose);
    controller.attachments.add(
      _attachment(
        id: "photo-preview",
        mediaType: IncidentMediaType.image,
        path: image.path,
        contentType: "image/png",
      ),
    );

    await _pumpPicker(tester, controller);
    await tester.tap(find.bySemanticsLabel(RegExp("Open Photo 1")));
    await tester.pumpAndSettle();

    expect(find.byType(EvidenceViewerScreen), findsOneWidget);
    expect(find.text("Photo 1"), findsOneWidget);
    expect(find.byTooltip("Back"), findsOneWidget);
  });

  testWidgets("shows policy limit without discarding selected evidence",
      (tester) async {
    const policy = EvidencePolicy(
      maxPhotos: 1,
      maxVideos: 0,
      maxAudio: 0,
      maxFiles: 1,
      maxFileSize: 5 * 1024 * 1024,
      maxTotalBytes: 5 * 1024 * 1024,
      supportedMimeTypes: {"image/png"},
    );
    final controller = _controller(policy: policy);
    addTearDown(controller.dispose);
    controller.attachments.add(
      _attachment(
        id: "kept-photo",
        mediaType: IncidentMediaType.image,
        path: "${tempDir.path}${Platform.pathSeparator}kept.png",
        contentType: "image/png",
      ),
    );

    await controller.takePhoto();
    await _pumpPicker(tester, controller);

    expect(find.text("Photos 1/1"), findsOneWidget);
    expect(find.textContaining("Evidence limit reached"), findsOneWidget);
    expect(controller.attachments.single.localId, "kept-photo");
    expect(
      tester.widget<OutlinedButton>(find.byType(OutlinedButton)).onPressed,
      isNull,
    );
  });

  testWidgets("shows upload progress and supports failed upload retry",
      (tester) async {
    final controller = _controller();
    addTearDown(controller.dispose);
    controller.attachments.addAll([
      _attachment(
        id: "uploading-video",
        mediaType: IncidentMediaType.video,
        path: "${tempDir.path}${Platform.pathSeparator}uploading.mp4",
        contentType: "video/mp4",
        state: LocalEvidenceState.uploading,
        uploadProgress: 0.45,
      ),
      _attachment(
        id: "failed-audio",
        mediaType: IncidentMediaType.audio,
        path: "${tempDir.path}${Platform.pathSeparator}failed.m4a",
        contentType: "audio/mp4",
        state: LocalEvidenceState.failed,
        durationSeconds: 9,
      ),
    ]);

    await _pumpPicker(tester, controller);

    expect(find.byType(LinearProgressIndicator), findsOneWidget);
    expect(find.text("Upload failed"), findsOneWidget);
    expect(find.byTooltip("Retry Audio 1 · 00:09"), findsOneWidget);

    await tester.tap(find.byTooltip("Retry Audio 1 · 00:09"));
    await tester.pump();

    expect(controller.attachments.last.state, LocalEvidenceState.captured);
    expect(find.byTooltip("Retry Audio 1 · 00:09"), findsNothing);
  });
}

EvidenceCaptureController _controller({
  EvidencePolicy policy = EvidencePolicy.incident,
}) {
  return EvidenceCaptureController(
    captureService: EvidenceCaptureService(),
    mediaSource: FakeEvidenceMediaSource(),
    permissionService: EvidencePermissionService(
      checkPermission: (_) async => PermissionStatus.granted,
      requestPermission: (_) async => PermissionStatus.granted,
    ),
    policy: policy,
  );
}

Future<void> _pumpPicker(
  WidgetTester tester,
  EvidenceCaptureController controller,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      theme: ThemeData.light(useMaterial3: true),
      darkTheme: ThemeData.dark(useMaterial3: true),
      themeMode: ThemeMode.dark,
      home: Scaffold(
        body: SingleChildScrollView(
          padding: const EdgeInsets.all(16),
          child: EvidenceAttachmentPicker(
            controller: controller,
            lowDataMode: false,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
}

LocalEvidenceAttachment _attachment({
  required String id,
  required String mediaType,
  required String path,
  required String contentType,
  int? durationSeconds,
  LocalEvidenceState state = LocalEvidenceState.captured,
  double uploadProgress = 0,
}) {
  return LocalEvidenceAttachment(
    localId: id,
    mediaType: mediaType,
    fileName: "$id.bin",
    originalPath: path,
    uploadPath: path,
    contentType: contentType,
    fileHash: "hash-$id",
    originalFileHash: "hash-$id",
    sizeBytes: 128,
    capturedAt: DateTime.utc(2026, 8, 19, 12),
    durationSeconds: durationSeconds,
    state: state,
    uploadProgress: uploadProgress,
  );
}

const _onePixelPng =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
