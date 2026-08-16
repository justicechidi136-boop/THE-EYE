import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/l10n/generated/field_localizations.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';

Widget _localized(Locale locale) {
  return MaterialApp(
    locale: locale,
    supportedLocales: TheEyeLocaleCatalog.supportedLocales,
    localizationsDelegates: const [
      FieldLocalizations.delegate,
      ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
    ],
    home: Builder(
      builder: (context) {
        final l10n = FieldLocalizations.of(context);
        return Scaffold(
          body: ListView(
            children: [
              Text(l10n.officerSignIn),
              Text(l10n.dashboard),
              Text(l10n.operationalDashboard),
              Text(l10n.patrol),
              Text(l10n.checkpoint),
              Text(l10n.assignments),
              Text(l10n.incidentWorkspace),
              Text(l10n.boloSearch),
              Text(l10n.communications),
              Text(l10n.languageRegion),
              Text(l10n.officerSafety),
              Text(l10n.requestBackup),
              Text(l10n.emergency),
            ],
          ),
        );
      },
    ),
  );
}

void main() {
  for (final option in TheEyeLocaleCatalog.enabled) {
    testWidgets(
      'renders representative Field Ops Wave 5 UI in ${option.code}',
      (tester) async {
        await tester.pumpWidget(_localized(option.locale));
        await tester.pumpAndSettle();

        expect(find.byType(ListView), findsOneWidget);
        expect(tester.takeException(), isNull);
      },
    );
  }
}
