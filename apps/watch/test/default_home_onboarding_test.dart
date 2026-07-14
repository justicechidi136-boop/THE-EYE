import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/screens/default_home_onboarding_screen.dart';
import 'package:the_eye_watch/services/launcher_service.dart';

class _FakeLauncherService extends LauncherService {
  _FakeLauncherService() : super(channel: const MethodChannel('mock'));

  @override
  Future<bool> isDefaultHome() async => false;

  @override
  Future<bool> isDebugBuild() async => true;

  @override
  Future<void> requestDefaultHome() async {}
}

void main() {
  testWidgets('default home onboarding shows set-default CTA', (tester) async {
    var completed = false;
    await tester.pumpWidget(
      MaterialApp(
        home: DefaultHomeOnboardingScreen(
          launcher: _FakeLauncherService(),
          onComplete: () => completed = true,
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('SET AS DEFAULT HOME'), findsOneWidget);
    expect(find.text('NOT NOW'), findsOneWidget);
    await tester.tap(find.text('NOT NOW'));
    await tester.pumpAndSettle();
    expect(completed, isTrue);
  });
}
