import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:the_eye_flutter_l10n/the_eye_locales.dart';
import 'package:the_eye_watch/alerts/danger_alert_models.dart';
import 'package:the_eye_watch/l10n/generated/watch_localizations.dart';
import 'package:the_eye_watch/models/watch_safety_status.dart';
import 'package:the_eye_watch/storage/secure_credential_store.dart';

DangerAlertPayload _payload({
  String alertId = 'alert-1',
  int version = 1,
  String code = DangerAlertCodes.armedRobberyNearby,
  DangerAlertLifecycleState state = DangerAlertLifecycleState.active,
  DangerAlertPriority priority = DangerAlertPriority.high,
  DateTime? expiresAt,
}) {
  final issuedAt = DateTime.utc(2026, 8, 16, 10);
  return DangerAlertPayload(
    schemaVersion: 1,
    alertId: alertId,
    version: version,
    sequence: version,
    lifecycleState: state,
    alertCode: code,
    priority: priority,
    incidentId: 'incident-1',
    zoneId: 'zone-1',
    safetyAlertId: 'safety-1',
    issuedAt: issuedAt,
    issuedAtWire: issuedAt.toIso8601String(),
    areaName: 'Ikeja',
    distanceMeters: 450,
    expiresAt: expiresAt,
  );
}

Widget _localized(Widget child) {
  return MaterialApp(
    supportedLocales: TheEyeLocaleCatalog.supportedLocales,
    localizationsDelegates: const [
      WatchLocalizations.delegate,
      ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
    ],
    home: Builder(builder: (_) => child),
  );
}

void main() {
  setUp(() {
    SharedPreferences.setMockInitialValues({});
  });

  test('trusted safety statuses do not use old history count', () {
    expect(WatchSafetyStatus.safe.level, WatchSafetyLevel.safe);

    final highAlert = WatchSafetyStatus.fromTrustedPayload(
      _payload(code: DangerAlertCodes.proximityIncrease),
    );
    expect(highAlert.level, WatchSafetyLevel.highAlert);

    final danger = WatchSafetyStatus.fromTrustedPayload(
      _payload(code: DangerAlertCodes.kidnappingNearby),
    );
    expect(danger.level, WatchSafetyLevel.danger);
    expect(danger.dangerCode, DangerAlertCodes.kidnappingNearby);

    final cleared = WatchSafetyStatus.fromTrustedPayload(
      _payload(state: DangerAlertLifecycleState.cleared),
    );
    expect(cleared.level, WatchSafetyLevel.safe);

    final expired = WatchSafetyStatus.fromTrustedPayload(
      _payload(expiresAt: DateTime.utc(2020)),
    );
    expect(expired.level, WatchSafetyLevel.safe);
  });

  test('danger A to danger B updates displayed trusted type', () {
    final armed = WatchSafetyStatus.fromTrustedPayload(
      _payload(alertId: 'a', code: DangerAlertCodes.armedRobberyNearby),
    );
    final fire = WatchSafetyStatus.fromTrustedPayload(
      _payload(alertId: 'b', code: DangerAlertCodes.fireNearby),
    );

    expect(armed.dangerCode, isNot(fire.dangerCode));
    expect(fire.dangerCode, DangerAlertCodes.fireNearby);
  });

  test('active safety persistence restores only live trusted status', () async {
    final preferences = PreferencesStore(
      preferences: await SharedPreferences.getInstance(),
    );
    final danger = WatchSafetyStatus.fromTrustedPayload(
      _payload(code: DangerAlertCodes.fireNearby),
    );

    await preferences.saveActiveSafetyStatus(danger);
    expect(
      (await preferences.loadActiveSafetyStatus()).dangerCode,
      DangerAlertCodes.fireNearby,
    );

    await preferences.saveActiveSafetyStatus(
      WatchSafetyStatus.fromTrustedPayload(
        _payload(expiresAt: DateTime.utc(2020)),
      ),
    );
    expect(
      (await preferences.loadActiveSafetyStatus()).level,
      WatchSafetyLevel.safe,
    );
  });

  testWidgets('every trusted danger code has a specific display label',
      (tester) async {
    await tester.pumpWidget(_localized(Builder(builder: (context) {
      final l10n = WatchLocalizations.of(context);
      for (final code in DangerAlertCodes.trusted) {
        if (code == DangerAlertCodes.generalEntry) continue;
        final label = WatchDangerLabels.labelFor(l10n, code);
        expect(label.trim(), isNotEmpty);
        if (code != DangerAlertCodes.cleared) {
          expect(label, isNot(l10n.dangerAlert));
        }
      }
      return const SizedBox.shrink();
    })));
  });

  testWidgets('area risk labels are available in every watch locale',
      (tester) async {
    for (final locale in TheEyeLocaleCatalog.supportedLocales) {
      await tester.pumpWidget(MaterialApp(
        locale: locale,
        supportedLocales: TheEyeLocaleCatalog.supportedLocales,
        localizationsDelegates: const [
          WatchLocalizations.delegate,
          ...TheEyeLocaleCatalog.frameworkLocalizationsDelegates,
        ],
        home: Builder(builder: (context) {
          final l10n = WatchLocalizations.of(context);
          expect(l10n.highRiskArea.trim(), isNotEmpty);
          expect(l10n.mediumRiskArea.trim(), isNotEmpty);
          expect(l10n.greenSafeArea.trim(), isNotEmpty);
          return const SizedBox.shrink();
        }),
      ));
      await tester.pumpAndSettle();
    }
  });
}
