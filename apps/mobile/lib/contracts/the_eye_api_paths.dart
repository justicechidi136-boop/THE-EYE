import "the_eye_enums.dart";

/// API path constants aligned with NestJS controllers under `/v1`.
abstract final class TheEyeApiPaths {
  static const defaultBaseUrl = TheEyeEnums.defaultApiBaseUrl;

  static String liveVideoStart(String incidentId) =>
      "/live-video/incidents/$incidentId/start";
  static String liveVideoStop(String sessionId) =>
      "/live-video/sessions/$sessionId/stop";
  static String liveVideoLocation(String sessionId) =>
      "/live-video/sessions/$sessionId/location";

  static const smartwatchRegister = "/smartwatch/devices/register";
  static String smartwatchGps(String deviceId) =>
      "/smartwatch/devices/$deviceId/gps";
  static const smartwatchSos = "/smartwatch/sos";
  static String smartwatchHeartbeat(String deviceId) =>
      "/smartwatch/devices/$deviceId/heartbeat";
  static String smartwatchOfflineSync(String deviceId) =>
      "/smartwatch/devices/$deviceId/offline-sync";

  static const incidentsReport = "/incidents/report";
  static const health = "/health";
  static const authLogin = "/auth/login";
  static const authRegister = "/auth/register";
  static const authRefresh = "/auth/refresh";
  static const authLogout = "/auth/logout";
  static const authFirebaseExchange = "/auth/firebase/exchange";
  static const authProvidersLink = "/auth/providers/link";
  static const authRequestPhoneOtp = "/auth/phone/request-otp";
  static const authVerifyPhoneOtp = "/auth/phone/verify-otp";
  static const authPasswordResetRequest = "/auth/password-reset/request";
  static const usersMe = "/users/me";
  static const usersMeEmergencyContacts = "/users/me/emergency-contacts";
  static String usersMeEmergencyContact(String id) =>
      "/users/me/emergency-contacts/$id";
  static const usersMeAvatarPresign = "/users/me/avatar/presign";
  static const usersMeAvatarConfirm = "/users/me/avatar/confirm";
  static const usersMeKyc = "/users/me/kyc";
  static const usersMeDeletionRequest = "/users/me/deletion-request";
  static const notificationsPushTokens = "/notifications/push-tokens";
  static const notificationsPushTokensDeactivate =
      "/notifications/push-tokens/deactivate";
  static String incidentsMediaPresign(String incidentId) =>
      "/incidents/$incidentId/media/presign";
  static String incidentsMediaConfirm(String incidentId) =>
      "/incidents/$incidentId/media/confirm";
}
