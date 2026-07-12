/// API path constants aligned with NestJS `/v1/smartwatch/*` routes.
abstract final class WatchApiPaths {
  /// Legacy emulator default kept for tests referencing the old constant.
  static const legacyDefaultBaseUrl = String.fromEnvironment(
    'THE_EYE_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/v1',
  );

  static const standaloneLogin = '/smartwatch/devices/standalone-login';
  static const sos = '/smartwatch/sos';

  static String heartbeat(String deviceId) =>
      '/smartwatch/devices/$deviceId/heartbeat';

  static String gps(String deviceId) => '/smartwatch/devices/$deviceId/gps';

  static String offlineSync(String deviceId) =>
      '/smartwatch/devices/$deviceId/offline-sync';

  static String firmwareCheck(String deviceId) =>
      '/smartwatch/devices/$deviceId/firmware/check';

  static String firmwareDownload(String deviceId, String version) =>
      '/smartwatch/devices/$deviceId/firmware/$version/download';

  static String emergencyTracking(String sosEventId) =>
      '/smartwatch/sos/$sosEventId/tracking';

  static const pushTokens = '/notifications/push-tokens';
  static const issuePairingCode = '/smartwatch/devices/pairing-codes';

  static String pairingStatus(String deviceId) =>
      '/smartwatch/devices/$deviceId/pairing-status';
}
