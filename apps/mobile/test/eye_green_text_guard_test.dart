import "dart:io";

import "package:flutter_test/flutter_test.dart";

/// Guards against reintroducing low-contrast green body/link text in feature code.
void main() {
  test("feature widgets avoid hardcoded green text color assignments", () {
    final root = Directory("lib");
    expect(root.existsSync(), isTrue, reason: "run from apps/mobile");

    const allowedPaths = {
      "lib/brand.dart",
      "lib/design_system/",
    };

    final disallowedTextColor = RegExp(
      r"(TextStyle\(|style:\s*const\s*TextStyle\()[^;]*color:\s*"
      r"(BrandColors\.green|Colors\.green(\.shade\d+)?|Color\(0x[Ff]{2}009933\))",
    );

    final violations = <String>[];

    for (final entity in root.listSync(recursive: true)) {
      if (entity is! File || !entity.path.endsWith(".dart")) continue;
      final normalized = entity.path.replaceAll("\\", "/");
      if (allowedPaths.any(normalized.contains)) continue;

      final lines = entity.readAsLinesSync();
      for (var i = 0; i < lines.length; i++) {
        final line = lines[i];
        if (disallowedTextColor.hasMatch(line)) {
          violations.add("$normalized:${i + 1}: $line");
        }
      }
    }

    expect(
      violations,
      isEmpty,
      reason: "Use EyeSemanticColors / EyeTypography.linkFor instead:\n"
          "${violations.join("\n")}",
    );
  });
}
