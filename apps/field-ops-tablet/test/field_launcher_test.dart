import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/config/field_device_mode.dart';
import 'package:the_eye_field_ops/launcher/approved_app_registry.dart';
import 'package:the_eye_field_ops/launcher/launcher_modules.dart';
import 'package:the_eye_field_ops/launcher/launcher_policy.dart';
import 'package:the_eye_field_ops/screens/launcher/launcher_shell_gate.dart';
import 'package:the_eye_field_ops/screens/routes.dart';

void main() {
  group('FieldDeviceMode', () {
    test('parses standard/launcher/managed_kiosk', () {
      expect(FieldDeviceModeConfig.parse('standard'), FieldDeviceMode.standard);
      expect(FieldDeviceModeConfig.parse('launcher'), FieldDeviceMode.launcher);
      expect(
        FieldDeviceModeConfig.parse('managed_kiosk'),
        FieldDeviceMode.managedKiosk,
      );
    });

    test('standard mode is not a launcher shell', () {
      expect(
        FieldDeviceModeConfig.isLauncherShell(FieldDeviceMode.standard),
        isFalse,
      );
      expect(
        FieldDeviceModeConfig.isLauncherShell(FieldDeviceMode.launcher),
        isTrue,
      );
    });
  });

  group('ApprovedAppRegistry', () {
    test('does not expose arbitrary packages', () {
      final apps = ApprovedAppRegistry.resolve(
        mode: FieldDeviceMode.launcher,
        role: 'officer',
        policyPackageNames: const [
          'com.google.android.apps.maps',
          'com.evil.spyware',
        ],
      );
      expect(apps.any((a) => a.packageName.contains('evil')), isFalse);
      expect(apps.any((a) => a.packageName.contains('maps')), isTrue);
    });

    test('hides browser when policy disables it', () {
      final apps = ApprovedAppRegistry.resolve(
        mode: FieldDeviceMode.launcher,
        role: 'officer',
        browserAllowed: false,
      );
      expect(apps.any((a) => a.packageName == 'com.android.chrome'), isFalse);
    });
  });

  group('LauncherPolicy + modules', () {
    test('checkpoint role modules exclude drone', () {
      final policy = LauncherPolicy.defaults(
        mode: FieldDeviceMode.launcher,
        role: 'checkpoint',
      );
      final modules = LauncherModules.visibleFor(policy);
      expect(modules.any((m) => m.id == 'checkpoint'), isTrue);
      expect(modules.any((m) => m.id == 'drone'), isFalse);
    });

    test('home route prefers launcher when enabled', () {
      final policy = LauncherPolicy.defaults(mode: FieldDeviceMode.launcher);
      expect(homeRouteForPolicy(policy), FieldRoutes.launcherHome);
      expect(homeRouteForPolicy(LauncherPolicy.defaults()), FieldRoutes.home);
    });

    test('locked policy routes to device lock', () {
      final locked = LauncherPolicy.fromJson({
        ...LauncherPolicy.defaults(mode: FieldDeviceMode.launcher).toJson(),
        'locked': true,
        'lockReason': 'Device revoked',
      });
      expect(homeRouteForPolicy(locked), FieldRoutes.deviceLock);
    });

    test('cache round-trip preserves mode', () {
      final original = LauncherPolicy.defaults(
        mode: FieldDeviceMode.managedKiosk,
      );
      final restored = LauncherPolicy.tryDecodeCache(original.encodeCache());
      expect(restored?.deviceMode, FieldDeviceMode.managedKiosk);
      expect(restored?.kioskEnabled, isTrue);
    });
  });

  test(
    'launcher resolves a readable location instead of using raw GPS data',
    () {
      final source =
          File(
            'lib/screens/launcher/field_launcher_home_screen.dart',
          ).readAsStringSync();

      expect(source, contains('_resolveHumanReadableLocation()'));
      expect(source, contains('deviceContext.reverseGeocode('));
      expect(source, isNot(contains("dash['gpsLabel']")));
    },
  );
}
