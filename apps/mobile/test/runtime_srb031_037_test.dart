import "package:flutter/material.dart";
import "package:flutter_test/flutter_test.dart";

import "package:the_eye_mobile/config/the_eye_api_config.dart";
import "package:the_eye_mobile/brand.dart";
import "package:the_eye_mobile/design_system/eye_input_theme.dart";
import "package:the_eye_mobile/design_system/eye_semantic_colors.dart";
import "package:the_eye_mobile/family/emergency_contact_relationships.dart";
import "package:the_eye_mobile/main.dart";
import "package:the_eye_mobile/neighborhood_watch/neighborhood_watch_service.dart";

void main() {
  group("dark theme semantics", () {
    testWidgets(
        "Welcome Back screen uses dark background and visible input text",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildTheme(false),
          darkTheme: buildDarkTheme(false),
          themeMode: ThemeMode.dark,
          home: const LoginRegisterScreen(),
        ),
      );
      await tester.pumpAndSettle();

      final semantics = EyeSemanticColors.dark;
      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffold.backgroundColor, semantics.background);

      final emailField = find.byType(TextField).first;
      final emailWidget = tester.widget<TextField>(emailField);
      expect(emailWidget.style?.color, semantics.inputText);
      expect(
        emailWidget.decoration?.fillColor ?? semantics.inputFill,
        semantics.inputFill,
      );
    });

    testWidgets("SafetyScaffold figma shell uses dark background in dark mode",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          darkTheme: buildDarkTheme(false),
          themeMode: ThemeMode.dark,
          home: const SafetyScaffold(
            title: "Home",
            useFigmaShell: true,
            body: SizedBox.shrink(),
          ),
        ),
      );
      await tester.pumpAndSettle();

      final scaffold = tester.widget<Scaffold>(find.byType(Scaffold));
      expect(scaffold.backgroundColor, BrandColors.darkBackground);
    });

    test("Start SOS live video action uses semantic orange in dark mode", () {
      expect(EyeSemanticColors.dark.primaryAction, BrandColors.orange);
      expect(EyeSemanticColors.dark.interactiveText, BrandColors.orange);
    });
  });

  group("EmergencyContactRelationships", () {
    test("normalizes labels to canonical enum values", () {
      expect(EmergencyContactRelationships.normalize("spouse"), "Spouse");
      expect(
          EmergencyContactRelationships.normalize(" Neighbour "), "Neighbour");
      expect(EmergencyContactRelationships.normalize("unknown"), "Other");
    });

    test("validates supported relationships", () {
      expect(EmergencyContactRelationships.isValid("Parent"), isTrue);
      expect(EmergencyContactRelationships.isValid("cousin"), isFalse);
    });
  });

  group("NeighborhoodWatchService base URL", () {
    test("constructs with resolved API config path", () {
      expect(NeighborhoodWatchService(), isA<NeighborhoodWatchService>());
      expect(TheEyeApiConfig.resolveBaseUrl(), isNotEmpty);
    });
  });

  group("EyeInputTheme", () {
    testWidgets("input decoration uses semantic fill and text colors",
        (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          darkTheme: buildDarkTheme(false),
          themeMode: ThemeMode.dark,
          home: Builder(
            builder: (context) {
              final decoration = EyeInputTheme.decoration(
                context,
                hintText: "Hint",
              );
              return InputDecorator(decoration: decoration);
            },
          ),
        ),
      );
      await tester.pumpAndSettle();

      final semantics = EyeSemanticColors.dark;
      final decorator =
          tester.widget<InputDecorator>(find.byType(InputDecorator));
      expect(decorator.decoration.fillColor, semantics.inputFill);
      expect(decorator.decoration.hintStyle?.color, semantics.inputHint);
    });
  });
}
