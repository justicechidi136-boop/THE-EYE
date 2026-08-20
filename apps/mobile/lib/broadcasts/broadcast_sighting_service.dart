import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";

class BroadcastSightingDetail {
  const BroadcastSightingDetail({
    required this.id,
    required this.broadcastId,
    required this.subjectSummary,
    required this.description,
    required this.location,
    required this.attachments,
    this.reportedAt,
    this.observedAt,
  });

  final String id;
  final String broadcastId;
  final String subjectSummary;
  final String description;
  final Map<String, dynamic> location;
  final List<Map<String, dynamic>> attachments;
  final DateTime? reportedAt;
  final DateTime? observedAt;

  factory BroadcastSightingDetail.fromJson(Map<String, dynamic> json) {
    final broadcast = json["broadcast"] is Map
        ? Map<String, dynamic>.from(json["broadcast"] as Map)
        : const <String, dynamic>{};
    return BroadcastSightingDetail(
      id: json["id"]?.toString() ?? "",
      broadcastId:
          json["broadcastId"]?.toString() ?? broadcast["id"]?.toString() ?? "",
      subjectSummary: broadcast["subjectSummary"]?.toString() ??
          broadcast["title"]?.toString() ??
          "Safety broadcast",
      description: json["description"]?.toString() ?? "",
      location: json["location"] is Map
          ? Map<String, dynamic>.from(json["location"] as Map)
          : const {},
      attachments: json["attachments"] is List
          ? (json["attachments"] as List)
              .whereType<Map>()
              .map((item) => Map<String, dynamic>.from(item))
              .toList(growable: false)
          : const [],
      reportedAt: DateTime.tryParse(json["reportedAt"]?.toString() ?? ""),
      observedAt: DateTime.tryParse(json["observedAt"]?.toString() ?? ""),
    );
  }
}

class BroadcastSightingService {
  BroadcastSightingService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;

  Future<BroadcastSightingDetail> getDetail({
    required String accessToken,
    required String broadcastId,
    required String sightingId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.broadcastSighting(broadcastId, sightingId),
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : Map<String, dynamic>.from(decoded as Map);
    return BroadcastSightingDetail.fromJson(data);
  }
}
