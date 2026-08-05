/// Why a LiveKit room or session was torn down.
enum LiveVideoDisconnectReason {
  userStop("user_stop"),
  userCancel("user_cancel"),
  retryReplacement("retry_replacement"),
  widgetDispose("widget_dispose"),
  appBackground("app_background"),
  routeChange("route_change"),
  permissionLoss("permission_loss"),
  networkOffline("network_offline"),
  startupTimeout("startup_timeout"),
  terminalIncident("terminal_incident"),
  staleAttemptCleanup("stale_attempt_cleanup"),
  unexpectedError("unexpected_error"),
  connectFailed("connect_failed"),
  publishFailed("publish_failed"),
  safeReconnect("safe_reconnect"),
  sdkDisconnected("sdk_disconnected"),
  clientRequestLeave("client_request_leave");

  const LiveVideoDisconnectReason(this.code);

  final String code;

  /// Maps LiveKit SDK disconnect reasons for CLIENT_REQUEST_LEAVE tracing.
  static LiveVideoDisconnectReason? fromLiveKitReason(
    Object? liveKitReason, {
    required String caller,
  }) {
    if (liveKitReason == null) return null;
    final name = liveKitReason.toString();
    if (name.contains("clientRequestLeave") ||
        name.contains("CLIENT_REQUEST_LEAVE")) {
      return LiveVideoDisconnectReason.clientRequestLeave;
    }
    return LiveVideoDisconnectReason.sdkDisconnected;
  }
}
