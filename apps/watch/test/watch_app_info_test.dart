import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/config/watch_app_info.dart';

void main() {
  test('WatchAppInfo exposes semver from pubspec const', () {
    expect(WatchAppInfo.firmwareVersion, '0.1.0');
    expect(WatchAppInfo.appVersion, contains('0.1.0'));
  });
}
