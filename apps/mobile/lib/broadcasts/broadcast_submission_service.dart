import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_draft_factory.dart";
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

class SightingSubmissionResult {
  const SightingSubmissionResult({
    required this.id,
    this.duplicate = false,
  });

  final String id;
  final bool duplicate;
}

class BroadcastSightingUnavailableException extends IncidentApiException {
  BroadcastSightingUnavailableException({
    required int statusCode,
    String? message,
    String? apiCode,
    String? requestId,
  }) : super(
          statusCode,
          message ?? temporaryUnavailableMessage,
          apiCode: apiCode,
          requestId: requestId,
        );

  static const temporaryUnavailableMessage =
      "Sighting submission is temporarily unavailable. Your draft has been saved securely. Please try again shortly.";

  static bool isTemporaryAvailability(int statusCode) {
    return statusCode == 404 ||
        statusCode == 408 ||
        statusCode == 501 ||
        statusCode == 502 ||
        statusCode == 503 ||
        statusCode >= 500;
  }
}

class BroadcastReportReasonOption {
  const BroadcastReportReasonOption({
    required this.code,
    required this.label,
  });

  final String code;
  final String label;
}

class BroadcastReportContent {
  const BroadcastReportContent({
    required this.heading,
    required this.reasons,
  });

  final String heading;
  final List<BroadcastReportReasonOption> reasons;
}

BroadcastReportContent broadcastReportContentForType(String? broadcastType) {
  final normalized =
      broadcastType?.toLowerCase().replaceAll(RegExp(r"[^a-z]"), "") ?? "";
  if (normalized.contains("stolenvehicle")) {
    return const BroadcastReportContent(
      heading: "Why are you reporting this stolen vehicle broadcast?",
      reasons: [
        BroadcastReportReasonOption(
            code: "FalseOrMisleading", label: "False or misleading"),
        BroadcastReportReasonOption(
            code: "VehicleInformationIncorrect",
            label: "Vehicle information is incorrect"),
        BroadcastReportReasonOption(
            code: "VehicleAlreadyRecovered",
            label: "Vehicle already recovered"),
        BroadcastReportReasonOption(code: "Duplicate", label: "Duplicate"),
        BroadcastReportReasonOption(
            code: "Impersonation", label: "Impersonation"),
        BroadcastReportReasonOption(
            code: "PrivacyViolation", label: "Privacy violation"),
        BroadcastReportReasonOption(code: "Spam", label: "Spam"),
        BroadcastReportReasonOption(code: "Other", label: "Other"),
      ],
    );
  }
  if (normalized.contains("missingperson")) {
    return const BroadcastReportContent(
      heading: "Why are you reporting this missing person broadcast?",
      reasons: [
        BroadcastReportReasonOption(
            code: "FalseOrMisleading", label: "False or misleading"),
        BroadcastReportReasonOption(
            code: "PersonInformationIncorrect",
            label: "Person information is incorrect"),
        BroadcastReportReasonOption(
            code: "PersonAlreadyFound", label: "Person already found"),
        BroadcastReportReasonOption(code: "Duplicate", label: "Duplicate"),
        BroadcastReportReasonOption(
            code: "Impersonation", label: "Impersonation"),
        BroadcastReportReasonOption(
            code: "PrivacyViolation", label: "Privacy violation"),
        BroadcastReportReasonOption(code: "Spam", label: "Spam"),
        BroadcastReportReasonOption(code: "Other", label: "Other"),
      ],
    );
  }
  return const BroadcastReportContent(
    heading: "Why are you reporting this broadcast?",
    reasons: [
      BroadcastReportReasonOption(
          code: "FalseOrMisleading", label: "False or misleading"),
      BroadcastReportReasonOption(code: "Duplicate", label: "Duplicate"),
      BroadcastReportReasonOption(
          code: "Impersonation", label: "Impersonation"),
      BroadcastReportReasonOption(
          code: "PrivacyViolation", label: "Privacy violation"),
      BroadcastReportReasonOption(code: "Spam", label: "Spam"),
      BroadcastReportReasonOption(code: "Other", label: "Other"),
    ],
  );
}

class BroadcastSubmissionService {
  BroadcastSubmissionService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;
  String? _lastCommentFingerprint;
  DateTime? _lastCommentSubmittedAt;

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
    String? clientResolutionId,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastResolve(broadcastId),
      {
        if (note != null && note.isNotEmpty) "note": note,
        "clientResolutionId": clientResolutionId ?? createClientSubmissionId(),
      },
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<void> withdraw({
    required String accessToken,
    required String broadcastId,
    String? reason,
    String? clientResolutionId,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastWithdraw(broadcastId),
      {
        if (reason != null && reason.isNotEmpty) "reason": reason,
        "clientResolutionId": clientResolutionId ?? createClientSubmissionId(),
      },
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
  }) async {
    final fingerprint = "$broadcastId::$body";
    final now = DateTime.now().toUtc();
    if (_lastCommentFingerprint == fingerprint &&
        _lastCommentSubmittedAt != null &&
        now.difference(_lastCommentSubmittedAt!) < const Duration(seconds: 5)) {
      throw IncidentApiException(
        409,
        "This comment was just posted. Please wait before posting again.",
      );
    }

    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastComments(broadcastId),
      {
        "body": body,
        if (parentId != null && parentId.isNotEmpty) "parentId": parentId,
      },
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    _lastCommentFingerprint = fingerprint;
    _lastCommentSubmittedAt = now;
    final decoded = jsonDecode(response.body);
    final row = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : decoded is Map
            ? Map<String, dynamic>.from(decoded)
            : <String, dynamic>{};
    return BroadcastCommentItem.fromJson(row);
  }

  Future<SightingSubmissionResult> submitSighting({
    required String accessToken,
    required String broadcastId,
    required String clientActionId,
    required String description,
    required String locationMode,
    String? observedAt,
    double? latitude,
    double? longitude,
    String? approximateArea,
    String? countryCode,
    String? state,
    String? cityTown,
    String? streetAddress,
    String? displayAddress,
    String? capturedAt,
    String? confidence,
    bool anonymousToReviewers = false,
    String? directionOfTravel,
    List<Map<String, Object?>> attachments = const [],
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.broadcastSightings(broadcastId),
      {
        "clientSightingId": clientActionId,
        "description": description,
        "locationMode": locationMode,
        if (observedAt != null && observedAt.isNotEmpty)
          "observedAt": observedAt,
        if (latitude != null) "latitude": latitude,
        if (longitude != null) "longitude": longitude,
        if (approximateArea != null && approximateArea.isNotEmpty)
          "approximateArea": approximateArea,
        if (countryCode != null && countryCode.isNotEmpty)
          "countryCode": countryCode,
        if (state != null && state.isNotEmpty) "state": state,
        if (cityTown != null && cityTown.isNotEmpty) "cityTown": cityTown,
        if (streetAddress != null && streetAddress.isNotEmpty)
          "streetAddress": streetAddress,
        if (displayAddress != null && displayAddress.isNotEmpty)
          "displayAddress": displayAddress,
        if (capturedAt != null && capturedAt.isNotEmpty)
          "capturedAt": capturedAt,
        if (confidence != null && confidence.isNotEmpty)
          "confidence": confidence,
        "anonymousPublic": anonymousToReviewers,
        if (directionOfTravel != null && directionOfTravel.isNotEmpty)
          "directionOfTravel": directionOfTravel,
        if (attachments.isNotEmpty) "attachments": attachments,
      },
      accessToken: accessToken,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final data = decoded is Map && decoded["data"] is Map
          ? Map<String, dynamic>.from(decoded["data"] as Map)
          : decoded is Map
              ? Map<String, dynamic>.from(decoded)
              : <String, dynamic>{};
      return SightingSubmissionResult(
        id: (data["id"] as String?) ?? clientActionId,
        duplicate: decoded is Map && decoded["duplicate"] == true,
      );
    }

    final apiError = IncidentApiException.fromResponse(response);
    if (BroadcastSightingUnavailableException.isTemporaryAvailability(
      response.statusCode,
    )) {
      throw BroadcastSightingUnavailableException(
        statusCode: response.statusCode,
        message:
            BroadcastSightingUnavailableException.temporaryUnavailableMessage,
        apiCode: apiError.apiCode,
        requestId: apiError.requestId,
      );
    }
    throw apiError;
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
