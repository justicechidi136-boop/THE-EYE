import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/models/emergency_mode.dart';
import 'package:the_eye_watch/services/push_message_router.dart';

void main() {
  test('watch push router accepts incident status updates', () {
    expect(PushMessageRouter.isWatchCategory(WatchPushCategories.incidentStatus), isTrue);
  });

  test('silent SOS mode is distinct from normal SOS', () {
    expect(WatchEmergencyMode.silentSos.apiValue, 'SilentSOS');
    expect(WatchEmergencyMode.normalSos.apiValue, isNot('SilentSOS'));
  });
}
