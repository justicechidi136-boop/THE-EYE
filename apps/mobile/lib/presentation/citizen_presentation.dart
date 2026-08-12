import "citizen_date_time.dart";
import "public_reference.dart";

export "citizen_date_time.dart";
export "broadcast_expiry_presenter.dart";

/// Compact chip/list labels (UI-007). Prefer [resolveCitizenIncidentStatusLabel]
/// so authoritative server `displayLabel` wins when present.
String citizenIncidentStatusLabel(String status) {
  return switch (status) {
    "Submitted" => "Submitted",
    "Received" => "Received",
    "Verifying" => "Verifying",
    "Verified" => "Verified",
    "Assigned" => "Agency Assigned",
    "Responding" => "Responders En Route",
    "UnderControl" => "Under Control",
    "CancellationRequested" => "Cancellation Requested",
    "Resolved" => "Resolved",
    "Closed" => "Closed",
    "FalseReport" => "Closed / Invalid Report",
    "CancelledByReporter" => "Cancelled",
    "ExpiredAfterReview" => "Closed",
    _ => "Update received",
  };
}

/// Prefer server [displayLabel] when authoritative; otherwise map [status].
String resolveCitizenIncidentStatusLabel({
  String? displayLabel,
  required String status,
}) {
  final trimmed = displayLabel?.trim();
  if (trimmed != null &&
      trimmed.isNotEmpty &&
      !_looksTechnicalStatus(trimmed)) {
    return trimmed;
  }
  return citizenIncidentStatusLabel(status);
}

bool _looksTechnicalStatus(String value) {
  if (RegExp(r"^[0-9a-f-]{36}$", caseSensitive: false).hasMatch(value)) {
    return true;
  }
  // Raw backend enums without spaces — map them instead of showing as-is.
  const rawEnums = {
    "Submitted",
    "Received",
    "Verifying",
    "Verified",
    "Assigned",
    "Responding",
    "UnderControl",
    "CancellationRequested",
    "Resolved",
    "Closed",
    "FalseReport",
    "CancelledByReporter",
    "ExpiredAfterReview",
    "LowConfidence",
  };
  return rawEnums.contains(value);
}

String citizenTimelineMessage({String? eventType, String? message}) {
  final overrides = <String, String>{
    "AutomaticTriageCompleted":
        "Your report has been routed to the appropriate response team",
    "IncidentTriaged": "Your report has been reviewed",
    "EmergencyReportSubmittedThroughFastPath":
        "Your emergency report has been received.",
    "LowConfidence": "Your report is being verified",
  };
  final type = eventType?.trim();
  if (type != null && overrides.containsKey(type)) {
    return overrides[type]!;
  }
  final raw = message?.trim();
  if (raw == null || raw.isEmpty) return "Update received";
  if (RegExp(r"^[0-9a-f-]{36}$", caseSensitive: false).hasMatch(raw)) {
    return "Update received";
  }
  if (raw.contains("LowConfidence")) return "Your report is being verified";
  if (RegExp(r"verification confidence", caseSensitive: false).hasMatch(raw) ||
      (RegExp(r"\b\d{1,3}%\b").hasMatch(raw) &&
          raw.toLowerCase().contains("confidence"))) {
    return "Your report is being verified";
  }
  if (raw.contains("Automatic triage completed")) {
    return "Your report has been routed to the appropriate response team";
  }
  if (raw.contains("Emergency report submitted through fast path")) {
    return "Your emergency report has been received.";
  }
  return raw;
}

String citizenAssignmentStatusLabel(String status) {
  return switch (status) {
    "Pending" => "Awaiting response",
    "Accepted" => "Responder assigned",
    "EnRoute" => "En route",
    "OnScene" => "On scene",
    "Completed" => "Completed",
    "Cancelled" => "Cancelled",
    "Declined" => "Declined",
    "Reassigned" => "Reassigned",
    _ => "Update received",
  };
}

String citizenProgressStageStateLabel(String state) {
  return switch (state) {
    "pending" => "Pending",
    "current" => "In progress",
    "complete" => "Complete",
    "skipped" => "Skipped",
    _ => "Update received",
  };
}

String citizenLocationQualityLabel({
  String? quality,
  String? latitude,
  String? longitude,
}) {
  final normalized = quality?.toLowerCase() ?? "";
  if (normalized.contains("low") || normalized.contains("approx")) {
    return "Approximate location";
  }
  if (latitude != null &&
      longitude != null &&
      latitude.isNotEmpty &&
      longitude.isNotEmpty) {
    return "Location recorded";
  }
  return "Location pending";
}

String citizenIncidentCategoryLabel(String type) {
  final normalizedKey =
      type.trim().toLowerCase().replaceAll(RegExp(r"[^a-z0-9]"), "");
  const canonical = <String, String>{
    "emergency": "Emergency",
    "emergencycase": "Emergency",
    "accident": "Accident",
    "fire": "Fire",
    "suspiciousactivity": "Suspicious Activity",
    "abuse": "Abuse",
    "kidnapping": "Kidnapping",
    "crime": "Crime",
    "liveemergencyvideo": "Live Emergency Video",
    "livevideo": "Live Emergency Video",
  };
  final mapped = canonical[normalizedKey];
  if (mapped != null) return mapped;
  return type
      .replaceAllMapped(
        RegExp(r"([a-z])([A-Z])"),
        (match) => "${match[1]} ${match[2]}",
      )
      .replaceAll("_", " ")
      .trim();
}

String? citizenWitnessSummary({int? witnessCount}) {
  final count = witnessCount ?? 0;
  if (count <= 0) return "Awaiting community verification";
  return "$count community ${count == 1 ? "witness" : "witnesses"}";
}

/// Backward-compatible alias → [CitizenDateTimeFormatter.formatFriendly].
String formatCitizenDateTime(DateTime value, {DateTime? now}) {
  return CitizenDateTimeFormatter.formatFriendly(value, now: now);
}

String resolveIncidentPublicReference({
  required String incidentId,
  required DateTime submittedAt,
  String? apiPublicReference,
}) {
  final trimmed = apiPublicReference?.trim();
  if (trimmed != null && trimmed.isNotEmpty) return trimmed;
  return buildIncidentPublicReference(
    incidentId: incidentId,
    submittedAt: submittedAt,
  );
}
