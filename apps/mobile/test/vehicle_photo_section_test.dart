import "dart:convert";
import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:permission_handler/permission_handler.dart";
import "package:the_eye_mobile/contracts/the_eye_enums.dart";
import "package:the_eye_mobile/evidence/evidence_capture_controller.dart";
import "package:the_eye_mobile/evidence/evidence_capture_service.dart";
import "package:the_eye_mobile/evidence/evidence_media_source.dart";
import "package:the_eye_mobile/evidence/evidence_permission_service.dart";
import "package:the_eye_mobile/evidence/evidence_policy.dart";
import "package:the_eye_mobile/evidence/local_evidence_attachment.dart";
import "package:the_eye_mobile/vehicles/vehicle_photo_section.dart";
import "package:the_eye_mobile/main.dart" show buildDarkTheme, buildTheme;

const _pixel =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  testWidgets("Vehicle Photos uses angle then Camera or Gallery flow",
      (tester) async {
    final controller = _controller();
    addTearDown(controller.dispose);
    await _pump(tester, controller);

    expect(find.text("Vehicle Photos"), findsOneWidget);
    expect(find.text("0/8"), findsOneWidget);
    await tester.tap(find.text("Add photo"));
    await tester.pumpAndSettle();

    for (final label in ["Front", "Rear", "Side", "Other"]) {
      expect(find.text(label), findsOneWidget);
    }
    await tester.tap(find.text("Front"));
    await tester.pumpAndSettle();
    expect(find.text("Camera"), findsOneWidget);
    expect(find.text("Gallery"), findsOneWidget);
  });

  testWidgets("Vehicle Photos shows thumbnail angle count preview and remove",
      (tester) async {
    final temp = Directory.systemTemp.createTempSync("eye-vehicle-photo-");
    addTearDown(() => temp.deleteSync(recursive: true));
    final image = File("${temp.path}${Platform.pathSeparator}front.png")
      ..writeAsBytesSync(base64Decode(_pixel));
    final controller = _controller();
    addTearDown(controller.dispose);
    controller.attachments.add(
      LocalEvidenceAttachment(
        localId: "front-photo",
        mediaType: IncidentMediaType.image,
        fileName: "front.png",
        originalPath: image.path,
        uploadPath: image.path,
        contentType: "image/png",
        fileHash: "hash",
        originalFileHash: "hash",
        sizeBytes: image.lengthSync(),
        capturedAt: DateTime.utc(2026, 8, 23),
        metadata: const {"vehiclePhotoAngle": "FRONT"},
      ),
    );
    await _pump(tester, controller);

    expect(find.text("Front"), findsOneWidget);
    expect(find.text("1/8"), findsOneWidget);
    await tester.tap(find.byType(InkWell).first);
    await tester.pumpAndSettle();
    expect(find.byType(InteractiveViewer), findsOneWidget);
    await tester.tapAt(const Offset(10, 10));
    await tester.pumpAndSettle();
    await tester.tap(find.byTooltip("Remove front photo"));
    await tester.pump();
    expect(find.text("0/8"), findsOneWidget);
  });

  testWidgets(
      "Vehicle Photos preserves multiple Front Rear Side and Other tags",
      (tester) async {
    final temp = Directory.systemTemp.createTempSync("eye-vehicle-angles-");
    addTearDown(() => temp.deleteSync(recursive: true));
    final image = File("${temp.path}${Platform.pathSeparator}vehicle.png")
      ..writeAsBytesSync(base64Decode(_pixel));
    final controller = _controller();
    addTearDown(controller.dispose);
    for (final angle in VehiclePhotoAngle.values) {
      controller.attachments.add(
        LocalEvidenceAttachment(
          localId: "${angle.apiValue}-photo",
          mediaType: IncidentMediaType.image,
          fileName: "${angle.apiValue.toLowerCase()}.png",
          originalPath: image.path,
          uploadPath: image.path,
          contentType: "image/png",
          fileHash: "${angle.apiValue}-hash",
          originalFileHash: "${angle.apiValue}-hash",
          sizeBytes: image.lengthSync(),
          capturedAt: DateTime.utc(2026, 8, 23),
          metadata: {"vehiclePhotoAngle": angle.apiValue},
        ),
      );
    }
    await _pump(tester, controller);

    expect(find.text("4/8"), findsOneWidget);
    for (final angle in VehiclePhotoAngle.values) {
      expect(find.text(angle.label), findsOneWidget);
      expect(VehiclePhotoAngle.fromApi(angle.apiValue), angle);
    }
  });
}

EvidenceCaptureController _controller() {
  return EvidenceCaptureController(
    captureService: EvidenceCaptureService(),
    mediaSource: FakeEvidenceMediaSource(),
    permissionService: EvidencePermissionService(
      checkPermission: (_) async => PermissionStatus.granted,
      requestPermission: (_) async => PermissionStatus.granted,
    ),
    policy: EvidencePolicy.vehiclePhotos,
  );
}

Future<void> _pump(
  WidgetTester tester,
  EvidenceCaptureController controller,
) async {
  tester.view.physicalSize = const Size(390, 844);
  tester.view.devicePixelRatio = 1;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);
  await tester.pumpWidget(
    MaterialApp(
      theme: buildTheme(false),
      darkTheme: buildDarkTheme(false),
      themeMode: ThemeMode.dark,
      home: Scaffold(
        body: SingleChildScrollView(
          child: VehiclePhotoSection(
            lowDataMode: false,
            controller: controller,
          ),
        ),
      ),
    ),
  );
  await tester.pump();
  expect(tester.takeException(), isNull);
}
