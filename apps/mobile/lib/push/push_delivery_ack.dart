import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "push_safe_log.dart";

typedef PushAccessTokenProvider = String? Function();

class PushDeliveryAckService {
  PushDeliveryAckService({
    required TheEyeApiClient apiClient,
    required PushAccessTokenProvider accessTokenProvider,
  })  : _apiClient = apiClient,
        _accessTokenProvider = accessTokenProvider;

  final TheEyeApiClient _apiClient;
  final PushAccessTokenProvider _accessTokenProvider;
  final Set<String> _acknowledged = <String>{};

  Future<void> acknowledge({
    required String notificationId,
    required String source,
  }) async {
    final trimmed = notificationId.trim();
    if (trimmed.isEmpty || _acknowledged.contains(trimmed)) return;

    final accessToken = _accessTokenProvider();
    if (accessToken == null || accessToken.isEmpty) return;

    try {
      final response = await _apiClient.patchJson(
        TheEyeApiPaths.notificationDeviceReceived(trimmed),
        {"source": source},
        accessToken: accessToken,
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        _acknowledged.add(trimmed);
        logPushEvent("Device delivery ack recorded for $trimmed ($source).");
      }
    } catch (_) {
      logPushEvent("Device delivery ack failed for $trimmed.");
    }
  }

  void reset() => _acknowledged.clear();
}
