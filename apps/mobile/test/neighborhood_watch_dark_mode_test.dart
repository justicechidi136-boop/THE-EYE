import "dart:io";

import "package:flutter_test/flutter_test.dart";
import "package:the_eye_mobile/emergency/live_video_startup_phase.dart";

void main() {
  test("startup phases expose human labels", () {
    expect(LiveVideoStartupPhase.creatingIncident.label, "Creating emergency");
    expect(LiveVideoStartupPhase.startingForegroundService.label,
        "Starting location service");
  });

  test("terminal phases are marked terminal", () {
    expect(LiveVideoStartupPhase.streaming.isTerminal, isTrue);
    expect(LiveVideoStartupPhase.failed.isTerminal, isTrue);
    expect(LiveVideoStartupPhase.creatingIncident.isTerminal, isFalse);
  });

  test("neighborhood watch dart sources avoid hardcoded white surfaces", () {
    final violations = <String>[];
    void scanFile(File file) {
      final content = file.readAsStringSync();
      if (content.contains("Colors.white") ||
          content.contains("EyeTokens.whiteBg") ||
          content.contains("BrandColors.lightBackground") ||
          content.contains("BrandColors.lightSurface") ||
          content.contains("Color(0xFFFFFFFF)")) {
        violations.add(file.path);
      }
    }

    final libRoot = Directory("lib/neighborhood_watch");
    for (final entity in libRoot.listSync(recursive: true)) {
      if (entity is File && entity.path.endsWith(".dart")) {
        scanFile(entity);
      }
    }

    // NW routes also live in main.dart — scan the Neighborhood Watch section only.
    final mainDart = File("lib/main.dart");
    final lines = mainDart.readAsLinesSync();
    final nwStart = lines.indexWhere((line) => line.contains("class NeighborhoodWatchHomeScreen"));
    final nwEnd = lines.indexWhere((line) => line.contains("class SafetyScaffold"));
    if (nwStart >= 0 && nwEnd > nwStart) {
      final nwBlock = lines.sublist(nwStart, nwEnd).join("\n");
      if (nwBlock.contains("Colors.white") ||
          nwBlock.contains("EyeTokens.whiteBg") ||
          nwBlock.contains("BrandColors.lightBackground") ||
          nwBlock.contains("BrandColors.lightSurface")) {
        violations.add("lib/main.dart (Neighborhood Watch section)");
      }
    }

    expect(
      violations,
      isEmpty,
      reason: "Hardcoded light surfaces in NW feature: $violations",
    );
  });
}
