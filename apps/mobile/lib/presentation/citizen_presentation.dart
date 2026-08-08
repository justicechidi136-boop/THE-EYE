import "public_reference.dart";

String citizenIncidentStatusLabel(String status) {
  return switch (status) {
    "Submitted" => "Report submitted",
    "Received" => "Report received",
    "Verifying" => "Verification in progress",
    "Verified" => "Report verified",
    "Assigned" => "Agency assigned",
    "Responding" => "Responders en route",
    "UnderControl" => "Situation under control",
    "CancellationRequested" => "Cancellation under review",
    "Resolved" => "Resolved",
    "Closed" => "Closed",
    "FalseReport" => "Marked as invalid",
    "CancelledByReporter" => "Cancelled",
    "ExpiredAfterReview" => "Expired after review",
    _ => "Update received",
  };
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
  return type
      .replaceAllMapped(RegExp(r"([a-z])([A-Z])"), (match) => "${match[1]} ${match[2]}")
      .replaceAll("_", " ")
      .trim();
}

String? citizenWitnessSummary({int? witnessCount}) {
  final count = witnessCount ?? 0;
  if (count <= 0) return "Awaiting community verification";
  return "$count community ${count == 1 ? "witness" : "witnesses"}";
}

String formatCitizenDateTime(DateTime value, {DateTime? now}) {
  final reference = (now ?? DateTime.now()).toLocal();
  final local = value.toLocal();
  final sameDay = reference.year == local.year &&
      reference.month == local.month &&
      reference.day == local.day;
  final hour = local.hour;
  final minute = local.minute.toString().padLeft(2, "0");
  final hour12 = hour % 12 == 0 ? 12 : hour % 12;
  final suffix = hour >= 12 ? "PM" : "AM";
  final time = "$hour12:$minute $suffix";
  if (sameDay) return "Today, $time";
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  return "${local.day} ${months[local.month - 1]} ${local.year}, $time";
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
