import 'package:firebase_core/firebase_core.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/config/firebase_bootstrap.dart';
import 'package:the_eye_watch/config/watch_flavor.dart';
import 'package:the_eye_watch/firebase_options_production.dart';
import 'package:the_eye_watch/firebase_options_staging.dart';

void main() {
  group('WatchFlavor', () {
    test('defaults to staging when no flavor is set', () {
      expect(WatchFlavor.firebaseEnv, WatchFirebaseEnv.staging);
      expect(WatchFlavor.androidPackageId, 'com.theeye.watch.staging');
      expect(WatchFlavor.firebaseProjectId, 'the-eye-2stg');
      expect(WatchFlavor.envName, 'staging');
    });

    test('maps production package and project ids', () {
      expect(WatchFlavor.isProduction, isFalse);
      expect(WatchFlavor.androidPackageId, isNot('com.theeye.watch'));
    });
  });

  group('assertWatchFirebaseEnvMatchesFlavor', () {
    test('allows matching staging project', () {
      expect(
        () => assertWatchFirebaseEnvMatchesFlavor(
          WatchFirebaseEnv.staging,
          FirebaseOptionsStaging.currentPlatform,
        ),
        returnsNormally,
      );
    });

    test('allows matching production project', () {
      expect(
        () => assertWatchFirebaseEnvMatchesFlavor(
          WatchFirebaseEnv.production,
          FirebaseOptionsProduction.currentPlatform,
        ),
        returnsNormally,
      );
    });

    test('rejects staging project in production flavor', () {
      expect(
        () => assertWatchFirebaseEnvMatchesFlavor(
          WatchFirebaseEnv.production,
          FirebaseOptionsStaging.currentPlatform,
        ),
        throwsStateError,
      );
    });

    test('rejects development project in production flavor', () {
      const wrongProject = FirebaseOptions(
        apiKey: 'test-key',
        appId: 'test-app',
        messagingSenderId: '123',
        projectId: 'the-eye-29cff',
      );
      expect(
        () => assertWatchFirebaseEnvMatchesFlavor(
          WatchFirebaseEnv.production,
          wrongProject,
        ),
        throwsStateError,
      );
    });
  });
}
