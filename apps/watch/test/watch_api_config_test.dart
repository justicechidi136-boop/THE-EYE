import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_watch/config/watch_api_config.dart';
import 'package:the_eye_watch/config/watch_flavor.dart';

void main() {
  group('WatchApiConfig', () {
    test('defaults to staging API when no override is set', () {
      expect(WatchFlavor.firebaseEnv, WatchFirebaseEnv.staging);
      expect(
        WatchApiConfig.resolveBaseUrl(),
        'https://staging-api.theeye.com.ng/v1',
      );
    });

    test('detects production and staging API hosts', () {
      expect(
        WatchApiConfig.isProductionApiUrl('https://api.theeye.com.ng/v1'),
        isTrue,
      );
      expect(
        WatchApiConfig.isStagingApiUrl(
          'https://staging-api.theeye.com.ng/v1',
        ),
        isTrue,
      );
      expect(
        WatchApiConfig.isProductionApiUrl(
          'https://staging-api.theeye.com.ng/v1',
        ),
        isFalse,
      );
    });

    test('treats emulator and test URLs as local dev', () {
      expect(
        WatchApiConfig.isLocalDevUrl('http://10.0.2.2:4000/v1'),
        isTrue,
      );
      expect(WatchApiConfig.isLocalDevUrl('http://test/v1'), isTrue);
    });
  });

  group('assertWatchApiBaseUrlMatchesFlavor', () {
    test('allows staging API for staging flavor', () {
      expect(
        () => assertWatchApiBaseUrlMatchesFlavor(
          WatchFirebaseEnv.staging,
          'https://staging-api.theeye.com.ng/v1',
        ),
        returnsNormally,
      );
    });

    test('rejects production API for staging flavor', () {
      expect(
        () => assertWatchApiBaseUrlMatchesFlavor(
          WatchFirebaseEnv.staging,
          'https://api.theeye.com.ng/v1',
        ),
        throwsStateError,
      );
    });

    test('rejects staging API for production flavor', () {
      expect(
        () => assertWatchApiBaseUrlMatchesFlavor(
          WatchFirebaseEnv.production,
          'https://staging-api.theeye.com.ng/v1',
        ),
        throwsStateError,
      );
    });

    test('rejects local dev API for staging flavor', () {
      expect(
        () => assertWatchApiBaseUrlMatchesFlavor(
          WatchFirebaseEnv.staging,
          'http://10.99.68.107:4000/v1',
        ),
        throwsStateError,
      );
    });

    test('allows local dev API for development flavor', () {
      expect(
        () => assertWatchApiBaseUrlMatchesFlavor(
          WatchFirebaseEnv.development,
          'http://10.0.2.2:4000/v1',
        ),
        returnsNormally,
      );
    });
  });
}
