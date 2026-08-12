import "the_eye_enums.dart";

/// API path constants aligned with NestJS controllers under `/v1`.
abstract final class TheEyeApiPaths {
  static const defaultBaseUrl = TheEyeEnums.defaultApiBaseUrl;

  static String liveVideoStart(String incidentId) =>
      "/live-video/incidents/$incidentId/start";
  static String liveVideoStop(String sessionId) =>
      "/live-video/sessions/$sessionId/stop";
  static String liveVideoClientFailure(String sessionId) =>
      "/live-video/sessions/$sessionId/client-failure";
  static String liveVideoLocation(String sessionId) =>
      "/live-video/sessions/$sessionId/location";

  static const smartwatchRegister = "/smartwatch/devices/register";
  static const smartwatchDevices = "/smartwatch/devices";
  static String smartwatchGps(String deviceId) =>
      "/smartwatch/devices/$deviceId/gps";
  static const smartwatchSos = "/smartwatch/sos";
  static String smartwatchHeartbeat(String deviceId) =>
      "/smartwatch/devices/$deviceId/heartbeat";
  static String smartwatchOfflineSync(String deviceId) =>
      "/smartwatch/devices/$deviceId/offline-sync";

  static const incidentsReport = "/incidents/report";
  static const incidentsEmergency = "/incidents/emergency";
  static const incidentsSos = "/incidents/sos";
  static const incidents = "/incidents";
  static String incidentDetail(String incidentId) => "/incidents/$incidentId";
  static String incidentLocation(String incidentId) =>
      "/incidents/$incidentId/location";
  static String incidentLiveLocation(String incidentId) =>
      "/incidents/$incidentId/live-location";
  static String incidentTimeline(String incidentId) =>
      "/incidents/$incidentId/timeline";
  static String incidentCancel(String incidentId) =>
      "/incidents/$incidentId/cancel";
  static String incidentRequestCancellation(String incidentId) =>
      "/incidents/$incidentId/request-cancellation";
  static String incidentReporterStatus(String incidentId) =>
      "/incidents/$incidentId/reporter-status";

  static String incidentUpdates(String incidentId) =>
      "/incidents/$incidentId/updates";
  static String incidentActiveEmergency(String incidentId) =>
      "/incidents/$incidentId/active-emergency";
  static String incidentConversation(String incidentId) =>
      "/incidents/$incidentId/conversation";
  static String incidentMessages(String incidentId) =>
      "/incidents/$incidentId/messages";
  static String incidentMessageRead(String incidentId, String messageId) =>
      "/incidents/$incidentId/messages/$messageId/read";
  static String incidentInformationRequests(String incidentId) =>
      "/incidents/$incidentId/information-requests";
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
  static const authAccountRecoveryRequest = "/auth/account-recovery/request";
  static const authAccountRecoveryVerify = "/auth/account-recovery/verify";
  static const authAccountRecoveryComplete = "/auth/account-recovery/complete";
  static const authAccountRecoveryCancel = "/auth/account-recovery/cancel";
  static const usersMe = "/users/me";
  static const usersMeEmergencyContacts = "/users/me/emergency-contacts";
  static String usersMeEmergencyContact(String id) =>
      "/users/me/emergency-contacts/$id";
  static const usersMeAvatarPresign = "/users/me/avatar/presign";
  static const usersMeAvatarConfirm = "/users/me/avatar/confirm";
  static const usersMeKyc = "/users/me/kyc";
  static const usersMeDeletionRequest = "/users/me/deletion-request";
  static const usersMeVehicles = "/me/vehicles";
  static String usersMeVehicle(String id) => "/me/vehicles/$id";
  static String usersMeVehiclePrimary(String id) => "/me/vehicles/$id/primary";
  static String usersMeVehiclePhotosPresign(String id) =>
      "/me/vehicles/$id/photos/presign";
  static String usersMeVehiclePhotosConfirm(String id) =>
      "/me/vehicles/$id/photos/confirm";
  static String usersMeVehiclePhoto(String id, String photoId) =>
      "/me/vehicles/$id/photos/$photoId";
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
  static const usersMeActivityHistory = "/users/me/activity-history";
  static String incidentArchive(String incidentId) =>
      "/incidents/$incidentId/archive";
  static String broadcastArchive(String broadcastId) =>
      "/broadcasts/$broadcastId/archive";
  static String notificationDetail(String notificationId) =>
      "/notifications/$notificationId";
  static String notificationRead(String notificationId) =>
      "/notifications/$notificationId/read";
  static const broadcastsNearby = "/broadcasts/nearby";
  static const broadcastsMine = "/broadcasts/mine";
  static const broadcastMediaPresign = "/broadcasts/media/presign";
  static const broadcastMissingPerson = "/broadcasts/missing-person";
  static const broadcastStolenVehicle = "/broadcasts/stolen-vehicle";
  static const policeStations = "/police-stations";
  static const policeStationsNearby = "/police-stations/nearby";
  static const policeStationsNearest = "/police-stations/nearest";
  static const policeStationsSearch = "/police-stations/search";
  static const broadcastsUnreadCount = "/broadcasts/unread-count";
  static String broadcastDetail(String broadcastId) =>
      "/broadcasts/$broadcastId";
  static String broadcastRead(String broadcastId) =>
      "/broadcasts/$broadcastId/read";
  static String broadcastResolve(String broadcastId) =>
      "/broadcasts/$broadcastId/resolve";
  static String broadcastWithdraw(String broadcastId) =>
      "/broadcasts/$broadcastId/withdraw";
  static String broadcastReport(String broadcastId) =>
      "/broadcasts/$broadcastId/report";
  static String broadcastComments(String broadcastId) =>
      "/broadcasts/$broadcastId/comments";
  static String broadcastShare(String broadcastId) =>
      "/broadcasts/$broadcastId/share";
  static String broadcastSightings(String broadcastId) =>
      "/broadcasts/$broadcastId/sightings";
  static String incidentsMediaPresign(String incidentId) =>
      "/incidents/$incidentId/media/presign";
  static String incidentsMediaConfirm(String incidentId) =>
      "/incidents/$incidentId/media/confirm";

  static const neighborhoodWatchContext = "/neighborhood-watch/context";
  static const neighborhoodWatchHomeCommunity =
      "/neighborhood-watch/home-community";
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
  static String neighborhoodWatchPostRestore(String postId) =>
      "/neighborhood-watch/posts/$postId/restore";
  static String neighborhoodWatchPatrolJoin(String scheduleId) =>
      "/neighborhood-watch/patrols/$scheduleId/join";
  static String neighborhoodWatchPatrolObservations(String scheduleId) =>
      "/neighborhood-watch/patrols/$scheduleId/observations";
  static String neighborhoodWatchCommunityOfficialAlerts(String communityId) =>
      "/neighborhood-watch/communities/$communityId/official-alerts";

  static String communityVerification(String requestId) =>
      "/community-verifications/$requestId";
  static String communityVerificationOpened(String requestId) =>
      "/community-verifications/$requestId/opened";
  static String communityVerificationRespond(String requestId) =>
      "/community-verifications/$requestId/respond";
  static String communityVerificationSkip(String requestId) =>
      "/community-verifications/$requestId/skip";
  static const communityVerificationsPending =
      "/community-verifications/pending";
}
