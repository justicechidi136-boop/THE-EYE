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
  static const incidents = "/incidents";
  static String incidentDetail(String incidentId) => "/incidents/$incidentId";
  static String incidentLocation(String incidentId) =>
      "/incidents/$incidentId/location";
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
  static const notificationsPushTokensDeactivateAll =
      "/notifications/push-tokens/deactivate-all";
  static String notificationDeviceReceived(String notificationId) =>
      "/notifications/$notificationId/device-received";
  static const notifications = "/notifications";
  static const notificationsUnreadCount = "/notifications/unread-count";
  static const notificationsReadAll = "/notifications/read-all";
  static String notificationDetail(String notificationId) =>
      "/notifications/$notificationId";
  static String notificationRead(String notificationId) =>
      "/notifications/$notificationId/read";
  static const broadcastsNearby = "/broadcasts/nearby";
  static const broadcastsUnreadCount = "/broadcasts/unread-count";
  static String broadcastDetail(String broadcastId) =>
      "/broadcasts/$broadcastId";
  static String broadcastRead(String broadcastId) =>
      "/broadcasts/$broadcastId/read";
  static String incidentsMediaPresign(String incidentId) =>
      "/incidents/$incidentId/media/presign";
  static String incidentsMediaConfirm(String incidentId) =>
      "/incidents/$incidentId/media/confirm";

  static const neighborhoodWatchCommunities = "/neighborhood-watch/communities";
  static const neighborhoodWatchCommunityRequests =
      "/neighborhood-watch/community-requests";
  static const neighborhoodWatchVolunteers = "/neighborhood-watch/volunteers";
  static String neighborhoodWatchCommunity(String communityId) =>
      "/neighborhood-watch/communities/$communityId";
  static String neighborhoodWatchCommunityJoin(String communityId) =>
      "/neighborhood-watch/communities/$communityId/join";
  static String neighborhoodWatchCommunityLeave(String communityId) =>
      "/neighborhood-watch/communities/$communityId/leave";
  static String neighborhoodWatchCommunityFeed(String communityId) =>
      "/neighborhood-watch/communities/$communityId/feed";
  static String neighborhoodWatchCommunityAlerts(String communityId) =>
      "/neighborhood-watch/communities/$communityId/alerts";
  static String neighborhoodWatchCommunityPosts(String communityId) =>
      "/neighborhood-watch/communities/$communityId/posts";
  static String neighborhoodWatchCommunityMembers(String communityId) =>
      "/neighborhood-watch/communities/$communityId/members";
  static String neighborhoodWatchCommunityPatrols(String communityId) =>
      "/neighborhood-watch/communities/$communityId/patrols";
  static String neighborhoodWatchCommunityMap(String communityId) =>
      "/neighborhood-watch/communities/$communityId/map";
  static String neighborhoodWatchPatrolCheckpoint(String scheduleId) =>
      "/neighborhood-watch/patrols/$scheduleId/checkpoints";
  static String neighborhoodWatchChannelMessages(String channelId) =>
      "/neighborhood-watch/channels/$channelId/messages";
  static String neighborhoodWatchPostComments(String postId) =>
      "/neighborhood-watch/posts/$postId/comments";
  static String neighborhoodWatchPostComment(String postId, String commentId) =>
      "/neighborhood-watch/posts/$postId/comments/$commentId";
  static String neighborhoodWatchCommunityStatistics(String communityId) =>
      "/neighborhood-watch/communities/$communityId/statistics";
  static String neighborhoodWatchCommunityReports(String communityId) =>
      "/neighborhood-watch/communities/$communityId/reports";
  static String neighborhoodWatchCommunityPostMediaPresign(
          String communityId) =>
      "/neighborhood-watch/communities/$communityId/posts/media/presign";
  static String neighborhoodWatchPost(String postId) =>
      "/neighborhood-watch/posts/$postId";
}
