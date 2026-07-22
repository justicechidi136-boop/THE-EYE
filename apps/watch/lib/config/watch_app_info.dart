import '../config/watch_flavor.dart';

/// Application metadata resolved at runtime (version from pubspec via const).
abstract final class WatchAppInfo {
  static const String appVersion = '0.1.0+1';
  static const String buildNumber = '1';

  static String get firmwareVersion => appVersion.split('+').first;

  static String get environment => WatchFlavor.envName;
}
