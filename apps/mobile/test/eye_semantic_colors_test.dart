import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/brand.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/design_system/typography.dart";
import "package:the_eye_mobile/main.dart" show buildDarkTheme, buildTheme;

void main() {
  group("EyeSemanticColors", () {
    test("dark mode uses orange for interactive and link text", () {
      const semantics = EyeSemanticColors.dark;
      expect(semantics.interactiveText, BrandColors.orange);
      expect(semantics.linkText, BrandColors.orange);
      expect(semantics.primaryAction, BrandColors.orange);
    });

    test("light mode keeps green primary and teal link actions", () {
      const semantics = EyeSemanticColors.light;
      expect(semantics.primaryAction, BrandColors.green);
      expect(semantics.linkText, BrandColors.accentHover);
    });

    test("dark success text stays readable on dark surfaces", () {
      const semantics = EyeSemanticColors.dark;
      expect(semantics.successText, BrandColors.darkText);
      expect(semantics.verified, BrandColors.green);
    });

    testWidgets("themes register semantic extensions", (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(false),
          darkTheme: buildDarkTheme(false),
          home: Builder(
            builder: (context) {
              expect(
                Theme.of(context).extension<EyeSemanticColors>(),
                EyeSemanticColors.light,
              );
              return const SizedBox.shrink();
            },
          ),
        ),
      );
      final context = tester.element(find.byType(SizedBox));
      expect(
        Theme.of(context).extension<EyeSemanticColors>(),
        EyeSemanticColors.light,
      );
    });

    testWidgets("dark theme link helper resolves to orange", (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildDarkTheme(false),
          home: Builder(
            builder: (context) {
              final style = EyeTypography.linkFor(context);
              expect(style.color, BrandColors.orange);
              return const SizedBox.shrink();
            },
          ),
        ),
      );
    });

    testWidgets("pairing mode accent is orange in dark mode", (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildDarkTheme(false),
          home: Builder(
            builder: (context) {
              expect(
                EyeSemanticColors.pairingModeAccent(context, standalone: false),
                BrandColors.orange,
              );
              expect(
                EyeSemanticColors.pairingModeAccent(context, standalone: true),
                BrandColors.orange,
              );
              return const SizedBox.shrink();
            },
          ),
        ),
      );
    });

    testWidgets("verified badge text uses readable foreground in dark mode",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildDarkTheme(false),
          home: Builder(
            builder: (context) {
              expect(
                EyeSemanticColors.verificationLabel(context, "Verified"),
                BrandColors.darkText,
              );
              expect(
                EyeSemanticColors.verificationTint(context, "Verified"),
                BrandColors.green,
              );
              return const SizedBox.shrink();
            },
          ),
        ),
      );
    });
  });
}
