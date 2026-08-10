import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/config/field_device_mode.dart';
import 'package:the_eye_field_ops/launcher/launcher_policy.dart';
import 'package:the_eye_field_ops/screens/launcher/device_lock_screen.dart';
import 'package:the_eye_field_ops/screens/launcher/launcher_shell_gate.dart';
import 'package:the_eye_field_ops/screens/routes.dart';
import 'package:the_eye_field_ops/theme/field_branding.dart';
import 'package:the_eye_field_ops/theme/field_theme.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  group('Field Ops branding assets', () {
    test('official branding assets exist on disk', () {
      expect(File('assets/branding/field_ops_logo.png').existsSync(), isTrue);
      expect(
        File('assets/branding/field_ops_logo_ui.png').existsSync(),
        isTrue,
      );
      expect(File('store/icon-512.png').existsSync(), isTrue);
    });

    testWidgets('startup brand header renders without overflow', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildFieldTheme(),
          home: const Scaffold(
            body: Center(
              child: FieldOpsBrandHeader(status: 'Initializing secure device…'),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('THE EYE FIELD OPS'), findsOneWidget);
      expect(find.text('FIELD OPERATIONS TABLET'), findsOneWidget);
      expect(find.text('Initializing secure device…'), findsOneWidget);
      expect(find.byType(Image), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('landscape brand header fits tablet viewport', (tester) async {
      tester.view.physicalSize = const Size(1920, 1200);
      tester.view.devicePixelRatio = 1.0;
      addTearDown(tester.view.resetPhysicalSize);
      addTearDown(tester.view.resetDevicePixelRatio);

      await tester.pumpWidget(
        MaterialApp(
          theme: buildFieldTheme(),
          home: const Scaffold(
            body: SafeArea(
              child: SingleChildScrollView(
                child: FieldOpsBrandHeader(
                  logoSize: 148,
                  status: 'Loading field policy…',
                ),
              ),
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('THE EYE FIELD OPS'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });

    testWidgets('pairing-style brand header is secondary to title', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildFieldTheme(),
          home: const Scaffold(
            body: Column(
              children: [
                FieldOpsBrandHeader(
                  logoSize: 88,
                  compact: true,
                  showTitle: false,
                  showSubtitle: false,
                ),
                Text('THE EYE FIELD OPERATIONS'),
                Text('Secure Field Device Activation'),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.byType(Image), findsOneWidget);
      expect(find.text('THE EYE FIELD OPERATIONS'), findsOneWidget);
      expect(find.text('Secure Field Device Activation'), findsOneWidget);
    });

    testWidgets('login-style brand header identifies Field Operations', (
      tester,
    ) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildFieldTheme(),
          home: const Scaffold(
            body: Column(
              children: [
                FieldOpsBrandHeader(logoSize: 96, compact: true),
                Text('FIELD OPERATIONS'),
              ],
            ),
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.textContaining('FIELD OPS'), findsWidgets);
      expect(find.text('FIELD OPERATIONS'), findsOneWidget);
    });
  });

  group('security routing unchanged by branding', () {
    test('locked policy cannot route to home', () {
      final locked = LauncherPolicy.fromJson({
        ...LauncherPolicy.defaults(mode: FieldDeviceMode.launcher).toJson(),
        'locked': true,
        'lockReason': 'Device revoked',
      });
      expect(homeRouteForPolicy(locked), FieldRoutes.deviceLock);
      expect(homeRouteForPolicy(locked), isNot(FieldRoutes.home));
      expect(homeRouteForPolicy(locked), isNot(FieldRoutes.launcherHome));
    });

    test('standard and launcher modes keep distinct home routes', () {
      expect(homeRouteForPolicy(LauncherPolicy.defaults()), FieldRoutes.home);
      expect(
        homeRouteForPolicy(
          LauncherPolicy.defaults(mode: FieldDeviceMode.launcher),
        ),
        FieldRoutes.launcherHome,
      );
      expect(
        homeRouteForPolicy(
          LauncherPolicy.defaults(mode: FieldDeviceMode.managedKiosk),
        ),
        FieldRoutes.launcherHome,
      );
    });

    testWidgets('device lock screen remains a hard stop', (tester) async {
      await tester.pumpWidget(
        MaterialApp(
          theme: buildFieldTheme(),
          home: const DeviceLockScreen(
            reason: 'Device revoked',
            deviceReference: 'fd_test',
            policy: null,
          ),
        ),
      );
      await tester.pumpAndSettle();

      expect(find.text('Device revoked'), findsOneWidget);
      expect(find.textContaining('THE EYE'), findsWidgets);
      expect(find.text('Officer sign in'), findsNothing);
      expect(find.text('Sign in'), findsNothing);
    });
  });
}
