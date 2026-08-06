import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";
import "broadcast_feed_service.dart";

class BroadcastSubmissionResult {
  const BroadcastSubmissionResult({
    required this.id,
    required this.status,
    this.duplicate = false,
    this.duplicateWarning,
    this.authorLabel,
  });

  final String id;
  final String status;
  final bool duplicate;
  final Map<String, dynamic>? duplicateWarning;
  final String? authorLabel;

  factory BroadcastSubmissionResult.fromJson(Map<String, dynamic> json) {
    final data = json["data"] is Map
        ? Map<String, dynamic>.from(json["data"] as Map)
        : json;
    return BroadcastSubmissionResult(
      id: (data["id"] as String?) ?? "",
      status: (data["status"] as String?) ?? "Active",
      duplicate: json["duplicate"] == true,
      duplicateWarning: data["metadata"] is Map
          ? (data["metadata"] as Map)["duplicateWarning"]
              as Map<String, dynamic>?
          : json["duplicateWarning"] as Map<String, dynamic>?,
      authorLabel: data["authorLabel"] as String?,
    );
  }
}

class BroadcastSubmissionService {
  BroadcastSubmissionService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;

  Future<BroadcastSubmissionResult> createMissingPerson({
    required String accessToken,
    required Map<String, dynamic> payload,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastMissingPerson,
      payload,
      accessToken: accessToken,
    );
    return _parseResponse(response);
  }

  Future<BroadcastSubmissionResult> createStolenVehicle({
    required String accessToken,
    required Map<String, dynamic> payload,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastStolenVehicle,
      payload,
      accessToken: accessToken,
    );
    return _parseResponse(response);
  }

  Future<void> resolve({
    required String accessToken,
    required String broadcastId,
    String? note,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastResolve(broadcastId),
      {if (note != null && note.isNotEmpty) "note": note},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> withdraw({
    required String accessToken,
    required String broadcastId,
    String? reason,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastWithdraw(broadcastId),
      {if (reason != null && reason.isNotEmpty) "reason": reason},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> report({
    required String accessToken,
    required String broadcastId,
    required String reason,
    String? details,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastReport(broadcastId),
      {
        "reason": reason,
        if (details != null && details.isNotEmpty) "details": details,
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<BroadcastCommentItem> addComment({
    required String accessToken,
    required String broadcastId,
    required String body,
    String? parentId,
    bool isSighting = false,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastComments(broadcastId),
      {
        "body": body,
        if (parentId != null && parentId.isNotEmpty) "parentId": parentId,
        if (isSighting) "isSighting": true,
      },
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final row = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : decoded is Map
            ? Map<String, dynamic>.from(decoded)
            : <String, dynamic>{};
    return BroadcastCommentItem.fromJson(row);
  }

  Future<void> submitSighting({
    required String accessToken,
    required String broadcastId,
    required String description,
    String? observedAt,
    double? latitude,
    double? longitude,
    String? approximateArea,
    String? confidence,
    bool anonymousPublic = false,
    String? directionOfTravel,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastSightings(broadcastId),
      {
        "description": description,
        if (observedAt != null && observedAt.isNotEmpty)
          "observedAt": observedAt,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
        if (approximateArea != null && approximateArea.isNotEmpty)
          "approximateArea": approximateArea,
        if (confidence != null && confidence.isNotEmpty)
          "confidence": confidence,
        "anonymousPublic": anonymousPublic,
        if (directionOfTravel != null && directionOfTravel.isNotEmpty)
          "directionOfTravel": directionOfTravel,
      },
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      await addComment(
        accessToken: accessToken,
        broadcastId: broadcastId,
        body: description,
        isSighting: true,
      );
      return;
    }
  }

  BroadcastSubmissionResult _parseResponse(dynamic response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw StateError("Unexpected broadcast response");
    }
    return BroadcastSubmissionResult.fromJson(
        Map<String, dynamic>.from(decoded));
  }

  void _ensureSuccess(dynamic response) {
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }
}
