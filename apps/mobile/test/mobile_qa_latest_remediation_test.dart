import "dart:io";

import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/design_system/components/eye_cancellation_reason_sheet.dart";
import "package:the_eye_mobile/main.dart";
import "package:the_eye_mobile/presentation/citizen_presentation.dart";
import "package:the_eye_mobile/presentation/citizen_time_picker.dart";

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group("UI-017 incident titles", () {
    test("normal Emergency stays Emergency", () {
      expect(citizenIncidentCategoryLabel("Emergency"), "Emergency");
      expect(citizenIncidentCategoryLabel("EMERGENCY"), "Emergency");
    });

    test("standalone live video incident is Live Emergency Video", () {
      expect(
        citizenIncidentCategoryLabel("LiveEmergencyVideo"),
        "Live Emergency Video",
      );
      expect(citizenIncidentCategoryLabel("LiveVideo"), "Live Emergency Video");
    });

    test("typed categories ignore free-text descriptions", () {
      expect(citizenIncidentCategoryLabel("Fire"), "Fire");
      expect(citizenIncidentCategoryLabel("Accident"), "Accident");
      // Adding live video later must not rename a normal Emergency.
      expect(citizenIncidentCategoryLabel("Emergency"), isNot("Live Emergency Video"));
    });
  });

  group("UX-027 / FUNC-020 citizen time", () {
    test("formats AM/PM", () {
      expect(formatCitizenTimeOfDay(const TimeOfDay(hour: 5, minute: 35)), "5:35 AM");
      expect(formatCitizenTimeOfDay(const TimeOfDay(hour: 17, minute: 35)), "5:35 PM");
    });
  });

  group("UI-016 cancel emergency keyboard", () {
    testWidgets("sheet stays usable with large keyboard inset", (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: MediaQuery(
            data: const MediaQueryData(
              size: Size(360, 640),
              viewInsets: EdgeInsets.only(bottom: 280),
            ),
            child: Builder(
              builder: (context) {
                return Scaffold(
                  body: Center(
                    child: TextButton(
                      onPressed: () {
                        showCancellationReasonSheet(
                          context,
                          title: "Cancel emergency",
                          confirmLabel: "Confirm cancel",
                        );
                      },
                      child: const Text("Open"),
                    ),
                  ),
                );
              },
            ),
          ),
        ),
      );
      await tester.tap(find.text("Open"));
      await tester.pumpAndSettle();
      expect(find.text("Other"), findsOneWidget);
      await tester.tap(find.text("Other"));
      await tester.pumpAndSettle();
      expect(find.text("Please tell us why"), findsOneWidget);
      expect(tester.takeException(), isNull);
      expect(find.text("Confirm cancel"), findsOneWidget);
    });
  });

  group("UX-030 service cards", () {
    testWidgets("narrow width does not overflow long labels", (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          home: Scaffold(
            body: SizedBox(
              width: 280,
              child: GridView.count(
                crossAxisCount: 2,
                shrinkWrap: true,
                childAspectRatio: 1.15,
                children: const [
                  ActionTile(
                    "Live emergency video",
                    Icons.videocam,
                    Colors.red,
                    _noop,
                  ),
                  ActionTile(
                    "Neighborhood Watch",
                    Icons.groups,
                    Colors.teal,
                    _noop,
                  ),
                ],
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
      expect(find.textContaining("Live emergency"), findsOneWidget);
      expect(find.textContaining("Neighborhood"), findsOneWidget);
    });

    testWidgets("large text scale does not overflow", (tester) async {
      await tester.pumpWidget(
        MediaQuery(
          data: const MediaQueryData(textScaler: TextScaler.linear(1.4)),
          child: const MaterialApp(
            home: Scaffold(
              body: SizedBox(
                width: 320,
                height: 200,
                child: ActionTile(
                  "Live emergency video",
                  Icons.videocam,
                  Colors.red,
                  _noop,
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();
      expect(tester.takeException(), isNull);
    });
  });

  group("FUNC-010 / FUNC-0XX vehicle image persist", () {
    test("helper is wired for content-uri safe persistence", () {
      final source = File("lib/vehicles/vehicle_image_persist.dart").readAsStringSync();
      expect(source.contains("readAsBytes"), isTrue);
      expect(source.contains("content://"), isTrue);
      final main = File("lib/main.dart").readAsStringSync();
      expect(main.contains("persistPickedVehicleImage"), isTrue);
      expect(main.contains("File(picked.path).copy(destination)"), isFalse);
    });
  });

  group("UX-028 / UX-029 terminology", () {
    test("My Vehicles and Vehicle Description strings exist in product UI", () {
      final source = File("lib/main.dart").readAsStringSync();
      expect(source.contains('title: "My Vehicles"'), isTrue);
      expect(source.contains('labelText: "Vehicle Description"'), isTrue);
      expect(source.contains('"My Cars"'), isFalse);
      expect(source.contains('_VehiclePhotoUploadState.local => "LOCAL"'), isFalse);
      expect(source.contains('"Vehicle saved."'), isTrue);
    });
  });

  group("FUNC-004 authorized client wiring", () {
    test("AppController requires shared apiClient", () {
      final source = File("lib/main.dart").readAsStringSync();
      expect(source.contains("required TheEyeApiClient apiClient"), isTrue);
      expect(
        source.contains("BroadcastMediaUploadService(apiClient: apiClient)"),
        isTrue,
      );
      expect(source.contains("TheEyeApiClient get apiClient"), isTrue);
    });
  });
}

void _noop() {}
