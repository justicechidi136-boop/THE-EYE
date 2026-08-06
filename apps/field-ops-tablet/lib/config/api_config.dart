import '../api/field_api_paths.dart';
import 'app_flavor.dart';

/// Resolves the THE EYE API base URL for this field tablet build.
abstract final class ApiConfig {
  static const String _dartDefineUrl =
      String.fromEnvironment('THE_EYE_API_BASE_URL');

  static const String _stagingDefaultUrl = String.fromEnvironment(
    'THE_EYE_STAGING_API_URL',
    defaultValue: 'https://staging-api.theeye.com.ng/v1',
  );

  static const String _productionDefaultUrl = String.fromEnvironment(
    'THE_EYE_PROD_API_URL',
  );

  static const String stagingApiHost = 'staging-api.theeye.com.ng';

  static String resolveBaseUrl() {
    if (_dartDefineUrl.isNotEmpty) {
      return _dartDefineUrl;
    }

    switch (AppFlavor.firebaseEnv) {
      case FieldFirebaseEnv.staging:
        return _stagingDefaultUrl;
      case FieldFirebaseEnv.production:
        if (_productionDefaultUrl.isEmpty) {
          throw StateError(
            'Production API URL is not configured. Rebuild with '
            '--dart-define=THE_EYE_PROD_API_URL set to the production API base URL.',
          );
        }
        return _productionDefaultUrl;
    }
  }

  static bool isHttpsUrl(String baseUrl) {
    return baseUrl.toLowerCase().startsWith('https://');
  }

  static bool isStagingApiUrl(String baseUrl) {
    return baseUrl.toLowerCase().contains(stagingApiHost);
  }
}

void assertApiBaseUrlMatchesFlavor(FieldFirebaseEnv env, String baseUrl) {
  if (env == FieldFirebaseEnv.staging &&
      !ApiConfig.isStagingApiUrl(baseUrl) &&
      !FieldApiPaths.legacyDefaultBaseUrl.contains('localhost')) {
    // Allow explicit dart-define overrides in tests.
    if (ApiConfig._dartDefineUrl.isEmpty) return;
  }

  if (env != FieldFirebaseEnv.staging && !ApiConfig.isHttpsUrl(baseUrl)) {
    throw StateError(
      'Environment guard: ${env.name} build must use HTTPS API URLs '
      '(`$baseUrl`).',
    );
  }
}
