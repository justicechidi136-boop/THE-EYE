import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/services/crash_recovery_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.theeye.watch/crash');

  setUp(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, (call) async {
      switch (call.method) {
        case 'readState':
          return {
            'uncleanShutdown': true,
            'activeEmergency': true,
            'queuedSos': false,
            'crashCount': 1,
            'recoveryLoopBlocked': false,
            'corrupted': false,
          };
        default:
          return null;
      }
    });
  });

  tearDown(() {
    TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
        .setMockMethodCallHandler(channel, null);
  });

  test('reads recovery state from native sentinel', () async {
    final service = CrashRecoveryService(channel: channel);
    final state = await service.readState();
    expect(state.uncleanShutdown, isTrue);
    expect(state.activeEmergency, isTrue);
    expect(state.shouldRestoreEmergency, isTrue);
  });

  test('clean shutdown state does not restore emergency', () {
    const state = CrashRecoveryState(
      uncleanShutdown: false,
      activeEmergency: true,
    );
    expect(state.shouldRestoreEmergency, isFalse);
  });

  test('recovery loop is blocked after repeated crashes', () {
    const state = CrashRecoveryState(
      uncleanShutdown: true,
      activeEmergency: true,
      recoveryLoopBlocked: true,
    );
    expect(state.shouldRestoreEmergency, isFalse);
  });

  test('corrupted sentinel never restores emergency', () {
    const state = CrashRecoveryState(
      uncleanShutdown: true,
      activeEmergency: true,
      queuedSos: true,
      corrupted: true,
    );
    expect(state.shouldRestoreEmergency, isFalse);
  });
}
