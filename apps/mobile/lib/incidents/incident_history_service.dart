import "dart:convert";

import "../presentation/citizen_presentation.dart";
import "../presentation/public_reference.dart";
import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "incident_submission_service.dart";

class IncidentSummary {
  const IncidentSummary({
    required this.id,
    required this.type,
    required this.status,
    required this.agency,
    required this.confidence,
    required this.verificationStatus,
    this.submittedAt,
    this.description,
    this.address,
    this.publicReference,
    this.displayStatus,
    this.locationAccuracyMeters,
    this.locationCapturedAt,
  });

  final String id;
  final String type;
  final String status;
  final String agency;
  final int confidence;
  final String verificationStatus;
  final DateTime? submittedAt;
  final String? description;
  final String? address;
  final String? publicReference;
  final String? displayStatus;
  final double? locationAccuracyMeters;
  final DateTime? locationCapturedAt;
}

class IncidentDetailEvidence {
  const IncidentDetailEvidence({
    required this.id,
    required this.mediaType,
    this.capturedAt,
    this.durationSeconds,
  });

  final String id;
  final String mediaType;
  final DateTime? capturedAt;
  final int? durationSeconds;
}

class IncidentDetail extends IncidentSummary {
  const IncidentDetail({
    required super.id,
    required super.type,
    required super.status,
    required super.agency,
    required super.confidence,
    required super.verificationStatus,
    super.submittedAt,
    super.description,
    super.address,
    super.publicReference,
    super.displayStatus,
    super.locationAccuracyMeters,
    super.locationCapturedAt,
    required this.timeline,
    required this.statusHistory,
    required this.evidenceCount,
    required this.evidence,
  });

  final List<Map<String, String>> timeline;
  final List<Map<String, String>> statusHistory;
  final int evidenceCount;
  final List<IncidentDetailEvidence> evidence;
}

class IncidentHistoryService {
  IncidentHistoryService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;

  Future<List<IncidentSummary>> listIncidents({
    required String accessToken,
    int maxPages = 5,
  }) async {
    final summaries = <IncidentSummary>[];
    String? cursor;
    for (var page = 0; page < maxPages; page++) {
      final query = <String, String>{"limit": "25"};
      if (cursor != null) query["cursor"] = cursor;
      final response = await _apiClient.getJson(
        TheEyeApiPaths.incidents,
        accessToken: accessToken,
        query: query,
      );
      if (response.statusCode < 200 || response.statusCode >= 300) {
        throw IncidentApiException.fromResponse(response);
      }
      final decoded = jsonDecode(response.body);
      if (decoded is! Map) {
        throw IncidentApiException(
            response.statusCode, "Unexpected incident list response.");
      }
      final map = Map<String, dynamic>.from(decoded);
      final rows = map["data"];
      if (rows is List) {
        for (final row in rows) {
          if (row is Map) {
            summaries.add(_summaryFromJson(Map<String, dynamic>.from(row)));
          }
        }
      }
      final hasMore = map["hasMore"] == true;
      final nextCursor = map["nextCursor"]?.toString();
      if (!hasMore || nextCursor == null || nextCursor.isEmpty) break;
      cursor = nextCursor;
    }
    return summaries;
  }

  Future<IncidentDetail> getIncident({
    required String accessToken,
    required String incidentId,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.incidentDetail(incidentId),
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    if (decoded is! Map) {
      throw IncidentApiException(
          response.statusCode, "Unexpected incident detail response.");
    }
    return _detailFromJson(Map<String, dynamic>.from(decoded));
  }

  IncidentSummary _summaryFromJson(Map<String, dynamic> json) {
    final verifications = json["verifications"];
    final latestVerification = verifications is List && verifications.isNotEmpty
        ? Map<String, dynamic>.from(verifications.last as Map)
        : null;
    final confidence = latestVerification?["confidence"] is num
        ? (latestVerification!["confidence"] as num).round()
        : json["status"] == "Verified"
            ? 85
            : 55;
    final verificationStatus = _verificationLabel(
        json["status"]?.toString(), latestVerification?["result"]?.toString());
    final assignedAgency = json["assignedAgencyId"]?.toString();
    final submittedAt = _parseDate(json["submittedAt"]);
    final id = json["id"]?.toString() ?? "";
    final status = json["status"]?.toString() ?? "Submitted";
    final metadata = json["metadata"] is Map
        ? Map<String, dynamic>.from(json["metadata"] as Map)
        : const <String, dynamic>{};
    return IncidentSummary(
      id: id,
      type: json["type"]?.toString() ?? "Incident",
      status: status,
      agency: assignedAgency == null || assignedAgency.isEmpty
          ? "Awaiting assignment"
          : assignedAgency,
      confidence: confidence,
      verificationStatus: verificationStatus,
      submittedAt: submittedAt,
      description: json["description"]?.toString(),
      address: json["address"]?.toString(),
      publicReference: json["publicReference"]?.toString() ??
          (submittedAt == null
              ? null
              : buildIncidentPublicReference(
                  incidentId: id,
                  submittedAt: submittedAt,
                )),
      displayStatus: json["displayLabel"]?.toString() ??
          citizenIncidentStatusLabel(status),
      locationAccuracyMeters:
          (metadata["locationAccuracyMeters"] as num?)?.toDouble(),
      locationCapturedAt: _parseDate(
        metadata["locationCapturedAt"] ?? json["submittedAt"],
      ),
    );
  }

  IncidentDetail _detailFromJson(Map<String, dynamic> json) {
    final summary = _summaryFromJson(json);
    final timeline = <Map<String, String>>[];
    final rawTimeline = json["timeline"];
    if (rawTimeline is List) {
      for (final entry in rawTimeline) {
        if (entry is Map) {
          final item = Map<String, dynamic>.from(entry);
          timeline.add({
            "time": item["createdAt"]?.toString() ?? "",
            "event": item["message"]?.toString() ??
                item["eventType"]?.toString() ??
                "Update",
            "actor": item["actorType"]?.toString() ?? "system",
          });
        }
      }
    }
    final statusHistory = <Map<String, String>>[];
    final rawHistory = json["statusHistory"];
    if (rawHistory is List) {
      for (final entry in rawHistory) {
        if (entry is Map) {
          final item = Map<String, dynamic>.from(entry);
          statusHistory.add({
            "from": item["fromStatus"]?.toString() ?? "",
            "to": item["toStatus"]?.toString() ?? "",
            "note": item["note"]?.toString() ?? "",
            "time": item["createdAt"]?.toString() ?? "",
          });
        }
      }
    }
    final media = json["media"];
    final evidence = media is List
        ? media
            .whereType<Map>()
            .map((row) {
              final item = Map<String, dynamic>.from(row);
              return IncidentDetailEvidence(
                id: item["id"]?.toString() ?? "",
                mediaType: item["mediaType"]?.toString() ?? "evidence",
                capturedAt: _parseDate(
                  item["capturedAt"] ?? item["uploadedAt"],
                ),
                durationSeconds: item["durationSeconds"] is num
                    ? (item["durationSeconds"] as num).round()
                    : null,
              );
            })
            .where((item) => item.id.isNotEmpty)
            .toList(growable: false)
        : const <IncidentDetailEvidence>[];
    return IncidentDetail(
      id: summary.id,
      type: summary.type,
      status: summary.status,
      agency: summary.agency,
      confidence: summary.confidence,
      verificationStatus: summary.verificationStatus,
      submittedAt: summary.submittedAt,
      description: summary.description,
      address: summary.address,
      publicReference: summary.publicReference,
      displayStatus: summary.displayStatus,
      locationAccuracyMeters: summary.locationAccuracyMeters,
      locationCapturedAt: summary.locationCapturedAt,
      timeline: timeline,
      statusHistory: statusHistory,
      evidenceCount: evidence.length,
      evidence: evidence,
    );
  }

  String _verificationLabel(String? status, String? verificationResult) {
    if (verificationResult == "reject" || status == "FalseReport")
      return "False Information";
    if (verificationResult == "confirm" || status == "Verified")
      return "Verified";
    if (status == "Verifying") return "Pending";
    return "Pending";
  }

  DateTime? _parseDate(Object? value) {
    if (value == null) return null;
    return DateTime.tryParse(value.toString());
  }
}
