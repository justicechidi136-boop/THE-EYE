import 'package:flutter/services.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/config/watch_flavor.dart';
import 'package:the_eye_watch/services/launcher_service.dart';

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  const channel = MethodChannel('com.theeye.watch/launcher');

  group('LauncherService', () {
    late LauncherService service;
    final log = <String, dynamic>{};

    setUp(() {
      log.clear();
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, (call) async {
        log[call.method] = call.arguments;
        switch (call.method) {
          case 'isDefaultHome':
            return true;
          case 'listApps':
            return [
              {
                'packageName': 'com.google.android.apps.wearable.settings',
                'label': 'Settings',
                'systemApp': 'true',
              },
              {
                'packageName': 'com.theeye.watch.staging',
                'label': 'THE EYE',
                'systemApp': 'false',
              },
            ];
          case 'launchApp':
            return true;
          case 'getLauncherMode':
            return 'consumer';
          case 'isDebugBuild':
            return true;
          default:
            return null;
        }
      });
      service = LauncherService(channel: channel);
    });

    tearDown(() {
      TestDefaultBinaryMessengerBinding.instance.defaultBinaryMessenger
          .setMockMethodCallHandler(channel, null);
    });

    test('isDefaultHome returns mocked value', () async {
      expect(await service.isDefaultHome(), isTrue);
    });

    test('listApps maps native payload', () async {
      final apps = await service.listApps();
      expect(apps, hasLength(2));
      expect(apps.first.label, 'Settings');
      expect(apps.last.packageName, 'com.theeye.watch.staging');
    });

    test('launchApp forwards package name', () async {
      final ok = await service.launchApp('com.example.app');
      expect(ok, isTrue);
      expect(log['launchApp'], {'packageName': 'com.example.app'});
    });

    test('requestDefaultHome invokes channel', () async {
      await service.requestDefaultHome();
      expect(log.containsKey('requestDefaultHome'), isTrue);
    });

    test('openSystemSettings invokes channel', () async {
      await service.openSystemSettings();
      expect(log.containsKey('openSystemSettings'), isTrue);
    });

    test('getLauncherMode maps consumer', () async {
      expect(await service.getLauncherMode(), WatchLauncherMode.consumer);
    });
  });

  group('WatchFlavor launcher mode', () {
    test('defaults to consumer launcher mode', () {
      expect(WatchFlavor.launcherMode, WatchLauncherMode.consumer);
      expect(WatchFlavor.isManagedLauncher, isFalse);
    });
  });
}
