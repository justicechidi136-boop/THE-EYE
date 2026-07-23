import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/pairing/watch_companion_transport.dart';
import 'package:the_eye_watch/services/emergency_foreground_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('emergency foreground service tracks active state', () {
    final service = EmergencyForegroundService();
    service.debugSetActive(true);
    expect(service.isActive, isTrue);
    service.debugSetActive(false);
    expect(service.isActive, isFalse);
  });

  test('companion state enum covers required modes', () {
    expect(WatchCompanionState.values, contains(WatchCompanionState.paired));
    expect(WatchCompanionState.values, contains(WatchCompanionState.standalone));
    expect(
      WatchCompanionState.values,
      contains(WatchCompanionState.companionUnavailable),
    );
  });
}
