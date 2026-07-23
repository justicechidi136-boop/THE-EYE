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
  static const pushTokensDeactivateAll =
      '/notifications/push-tokens/deactivate-all';
  static String devicePushTokens(String deviceId) =>
      '/smartwatch/devices/$deviceId/push-tokens';
  static String devicePushTokensDeactivate(String deviceId) =>
      '/smartwatch/devices/$deviceId/push-tokens/deactivate';
  static String telemetry(String deviceId) =>
      '/smartwatch/devices/$deviceId/telemetry';
  static String notificationAck(String deviceId, String notificationId) =>
      '/smartwatch/devices/$deviceId/notifications/$notificationId/ack';
  static String notificationRead(String deviceId, String notificationId) =>
      '/smartwatch/devices/$deviceId/notifications/$notificationId/read';
  static String deviceNotifications(String deviceId) =>
      '/smartwatch/devices/$deviceId/notifications';
  static String versionPolicy(String deviceId) =>
      '/smartwatch/devices/$deviceId/version-policy';
  static String deviceSettings(String deviceId) =>
      '/smartwatch/devices/$deviceId/settings';
  static String notificationDeviceReceived(String notificationId) =>
      '/notifications/$notificationId/device-received';
  static const issuePairingCode = '/smartwatch/devices/pairing-codes';

  static String pairingStatus(String deviceId) =>
      '/smartwatch/devices/$deviceId/pairing-status';
}
