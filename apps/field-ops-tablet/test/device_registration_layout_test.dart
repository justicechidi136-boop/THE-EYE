import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/api/field_api_client.dart';
import 'package:the_eye_field_ops/screens/pair_device_screen.dart';
import 'package:the_eye_field_ops/security/device_keystore_service.dart';
import 'package:the_eye_field_ops/security/secure_session_store.dart';
import 'package:the_eye_field_ops/services/field_app_services.dart';
import 'package:the_eye_field_ops/theme/field_theme.dart';

void main() {
  testWidgets('theme buttons keep finite min width for Row layouts', (
    tester,
  ) async {
    final theme = buildFieldTheme();
    final outlined = theme.outlinedButtonTheme.style!;
    final elevated = theme.elevatedButtonTheme.style!;

    expect(outlined.minimumSize?.resolve({}), isNot(const Size.fromHeight(56)));
    expect(outlined.minimumSize?.resolve({})?.width.isFinite, isTrue);
    expect(elevated.minimumSize?.resolve({})?.width.isFinite, isTrue);

    await tester.pumpWidget(
      MaterialApp(
        theme: theme,
        home: Scaffold(
          body: Center(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Expanded(child: Text('Pairing hint')),
                    OutlinedButton(
                      onPressed: () {},
                      child: const Text('I have a pairing code'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('I have a pairing code'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('registration-style form fields render in landscape', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1920, 1200);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildFieldTheme(),
        home: Scaffold(
          appBar: AppBar(title: const Text('Device registration')),
          body: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(32),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 720),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const TextField(
                      decoration: InputDecoration(labelText: 'Device name'),
                    ),
                    const SizedBox(height: 16),
                    const TextField(
                      decoration: InputDecoration(
                        labelText: 'Supervisor access token',
                      ),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton(
                      onPressed: () {},
                      child: const Text('Submit registration'),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.text('Submit registration'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('pairing chooser renders in a landscape scroll view', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(1280, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    final services = FieldAppServices(
      api: FieldApiClient(
        baseUrl: 'http://127.0.0.1:4000/v1',
        skipEnvGuard: true,
      ),
      session: SecureSessionStore(memory: {}),
      keystore: DeviceKeystoreService(memory: {}),
    );
    addTearDown(services.dispose);

    await tester.pumpWidget(
      MaterialApp(
        theme: buildFieldTheme(),
        home: PairDeviceScreen(services: services),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Pair this device'), findsOneWidget);
    expect(find.text('Scan QR Code'), findsOneWidget);
    expect(find.text('Enter Pairing Code'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}
