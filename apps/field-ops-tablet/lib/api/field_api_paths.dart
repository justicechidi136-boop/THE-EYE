/// API path constants aligned with NestJS `/v1/field/*` routes.
abstract final class FieldApiPaths {
  static const legacyDefaultBaseUrl = String.fromEnvironment(
    'THE_EYE_API_BASE_URL',
    defaultValue: 'http://10.0.2.2:4000/v1',
  );

  static const deviceChallenge = '/field/devices/challenge';
  static const deviceRegister = '/field/devices/register';
  static const deviceRegistrationStatus = '/field/devices/registration-status';
  static const deviceCompletePairing = '/field/devices/complete-pairing';

  static String deviceHeartbeat(String publicDeviceId) =>
      '/field/devices/$publicDeviceId/heartbeat';

  static const authLogin = '/field/auth/login';
  static const authRefresh = '/field/auth/refresh';
  static const authLogout = '/field/auth/logout';
  static const authLock = '/field/auth/lock';
  static const authUnlock = '/field/auth/unlock';
  static const authSession = '/field/auth/session';
}
