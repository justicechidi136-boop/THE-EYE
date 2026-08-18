import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";

class CommunityVerificationEvidencePreview {
  const CommunityVerificationEvidencePreview({
    required this.id,
    required this.mediaType,
    this.previewUrl,
  });

  final String id;
  final String mediaType;
  final String? previewUrl;

  bool get isImage => mediaType.toLowerCase() == "image";
  bool get isVideo => mediaType.toLowerCase() == "video";
  bool get isAudio => mediaType.toLowerCase() == "audio";

  factory CommunityVerificationEvidencePreview.fromJson(Map<String, dynamic> json) {
    return CommunityVerificationEvidencePreview(
      id: json["id"]?.toString() ?? "",
      mediaType: json["mediaType"]?.toString() ?? "",
      previewUrl: json["previewUrl"]?.toString(),
    );
  }
}

class CommunityVerificationPayload {
  const CommunityVerificationPayload({
    required this.requestId,
    required this.category,
    required this.categoryDisplayLabel,
    required this.approximateArea,
    required this.approximateDistance,
    required this.distanceBand,
    required this.reportTime,
    required this.sanitizedDescription,
    required this.safetyNotice,
    required this.allowedResponses,
    required this.spokenSummaryTemplate,
    required this.expiry,
    required this.alreadyResponded,
    required this.isExpired,
    required this.approvedEvidencePreviews,
  });

  final String requestId;
  final String category;
  final String categoryDisplayLabel;
  final String approximateArea;
  final String approximateDistance;
  final String? distanceBand;
  final String reportTime;
  final String sanitizedDescription;
  final String safetyNotice;
  final List<String> allowedResponses;
  final String spokenSummaryTemplate;
  final String expiry;
  final bool alreadyResponded;
  final bool isExpired;
  final List<CommunityVerificationEvidencePreview> approvedEvidencePreviews;

  factory CommunityVerificationPayload.fromJson(Map<String, dynamic> json) {
    return CommunityVerificationPayload(
      requestId: json["requestId"]?.toString() ?? "",
      category: json["category"]?.toString() ?? "",
      categoryDisplayLabel: json["categoryDisplayLabel"]?.toString() ?? "",
      approximateArea: json["approximateArea"]?.toString() ?? "",
      approximateDistance: json["approximateDistance"]?.toString() ?? "",
      distanceBand: json["distanceBand"]?.toString(),
      reportTime: json["reportTime"]?.toString() ?? "",
      sanitizedDescription: json["sanitizedDescription"]?.toString() ?? "",
      safetyNotice: json["safetyNotice"]?.toString() ?? "",
      allowedResponses: (json["allowedResponses"] as List<dynamic>? ?? const [])
          .map((item) => item.toString())
          .toList(),
      spokenSummaryTemplate: json["spokenSummaryTemplate"]?.toString() ?? "",
      expiry: json["expiry"]?.toString() ?? "",
      alreadyResponded: json["alreadyResponded"] == true,
      isExpired: json["isExpired"] == true,
      approvedEvidencePreviews: (json["approvedEvidencePreviews"] as List<dynamic>? ?? const [])
          .map((item) => CommunityVerificationEvidencePreview.fromJson(Map<String, dynamic>.from(item as Map)))
          .toList(),
    );
  }
}

class CommunityVerificationCompletion {
  const CommunityVerificationCompletion({
    required this.requestId,
    required this.completed,
    required this.responseType,
    required this.message,
    required this.nextRoute,
  });

  final String requestId;
  final bool completed;
  final String responseType;
  final String message;
  final String nextRoute;

  factory CommunityVerificationCompletion.fromJson(Map<String, dynamic> json) {
    return CommunityVerificationCompletion(
      requestId: json["requestId"]?.toString() ?? "",
      completed: json["completed"] == true,
      responseType: json["responseType"]?.toString() ?? "",
      message: json["message"]?.toString() ?? "",
      nextRoute: json["nextRoute"]?.toString() ?? "/home",
    );
  }
}

class CommunityVerificationService {
  CommunityVerificationService(this._client);

  final TheEyeApiClient _client;

  Future<CommunityVerificationPayload> fetchPayload({
    required String requestId,
    required String accessToken,
  }) async {
    final response = await _client.getJson(
      TheEyeApiPaths.communityVerification(requestId),
      accessToken: accessToken,
    );
    if (response.statusCode == 404) {
      throw IncidentApiException.fromResponse(response);
    }
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    return CommunityVerificationPayload.fromJson(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<void> markOpened({
    required String requestId,
    required String accessToken,
  }) async {
    final response = await _client.postJson(
      TheEyeApiPaths.communityVerificationOpened(requestId),
      const {},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<CommunityVerificationCompletion> respond({
    required String requestId,
    required String accessToken,
    required String responseType,
    required String clientActionId,
    String? confidence,
    String? note,
    String? voiceAttachmentId,
  }) async {
    final response = await _client.postJson(
      TheEyeApiPaths.communityVerificationRespond(requestId),
      {
        "responseType": responseType,
        "clientActionId": clientActionId,
        if (confidence != null) "confidence": confidence,
        if (note != null && note.isNotEmpty) "note": note,
        if (voiceAttachmentId != null) "voiceAttachmentId": voiceAttachmentId,
      },
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    return CommunityVerificationCompletion.fromJson(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }

  Future<CommunityVerificationCompletion> skip({
    required String requestId,
    required String accessToken,
    required String clientActionId,
    String? reason,
  }) async {
    final response = await _client.postJson(
      TheEyeApiPaths.communityVerificationSkip(requestId),
      {
        "clientActionId": clientActionId,
        if (reason != null && reason.isNotEmpty) "reason": reason,
      },
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    return CommunityVerificationCompletion.fromJson(
      Map<String, dynamic>.from(jsonDecode(response.body) as Map),
    );
  }
}
