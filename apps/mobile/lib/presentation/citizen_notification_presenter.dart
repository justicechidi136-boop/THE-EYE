import "citizen_date_time.dart";
import "citizen_presentation.dart";
import "missing_person_age.dart";

class CitizenNotificationPresentation {
  const CitizenNotificationPresentation({
    required this.category,
    required this.title,
    required this.preview,
    required this.timestampLabel,
    required this.isUnread,
    this.routeHint,
    this.publicReference,
  });

  final String category;
  final String title;
  final String preview;
  final String timestampLabel;
  final bool isUnread;
  final String? routeHint;
  final String? publicReference;
}

/// Maps raw inbox notifications into citizen-safe presentation.
abstract final class CitizenNotificationPresenter {
  static CitizenNotificationPresentation present({
    required String type,
    required String title,
    required String body,
    required DateTime createdAt,
    required bool isUnread,
    Map<String, dynamic>? metadata,
    DateTime? now,
  }) {
    final normalizedType = type.trim();
    final meta = metadata ?? const <String, dynamic>{};
    final timestamp = CitizenDateTimeFormatter.formatRelative(
      createdAt,
      now: now,
    );

    if (_isBroadcast(normalizedType, title)) {
      final fullName = (meta["fullName"] as String?)?.trim();
      final age = (meta["ageOrApproximateAge"] as String?)?.trim();
      final lastSeenRaw = meta["lastSeenAt"];
      final lastSeen = CitizenDateTimeFormatter.tryParse(lastSeenRaw);
      final lastSeenFriendly = lastSeen == null
          ? null
          : CitizenDateTimeFormatter.formatDateTime(lastSeen);
      final preview =
          (fullName != null && age != null && lastSeenFriendly != null)
              ? MissingPersonAge.notificationPreview(
                  fullName: fullName,
                  ageOrRange: age,
                  lastSeenFriendly: lastSeenFriendly,
                )
              : _sanitizePreview(body);
      return CitizenNotificationPresentation(
        category: "Broadcast Alert",
        title: title.trim().isEmpty ? "Broadcast Alert" : title.trim(),
        preview: preview,
        timestampLabel: timestamp,
        isUnread: isUnread,
        routeHint: "BROADCAST_DETAILS",
        publicReference: meta["publicReference"]?.toString(),
      );
    }

    if (_isReportSubmitted(normalizedType, title, body)) {
      final reference = meta["publicReference"]?.toString() ??
          _extractReference(body) ??
          "your report";
      return CitizenNotificationPresentation(
        category: "Report Submitted",
        title: "Your emergency report has been received",
        preview: "Your report $reference has been successfully submitted.",
        timestampLabel: timestamp,
        isUnread: isUnread,
        routeHint: "OWN_ACTIVE_INCIDENT",
        publicReference: reference,
      );
    }

    if (_isVerifyIncident(normalizedType, title)) {
      final categoryHint = meta["incidentCategory"]?.toString() ??
          meta["category"]?.toString() ??
          "Emergency";
      final incidentLabel = citizenIncidentCategoryLabel(categoryHint);
      final defaultTitle = incidentLabel == "Emergency"
          ? "Can you confirm this emergency?"
          : "Can you confirm this ${incidentLabel.toLowerCase()}?";
      final defaultPreview = incidentLabel == "Emergency"
          ? "An emergency has been reported near your location. Tap to review the incident and confirm whether it is still active."
          : "A ${incidentLabel.toLowerCase()} has been reported near your location. Tap to review the incident and confirm whether it is still active.";
      return CitizenNotificationPresentation(
        category: "Verify Active Incident",
        title: _sanitizeTitle(title).toLowerCase().contains("confirm")
            ? _sanitizeTitle(title)
            : defaultTitle,
        preview: _sanitizePreview(body) == "Open for details."
            ? defaultPreview
            : _sanitizePreview(body),
        timestampLabel: timestamp,
        isUnread: isUnread,
        routeHint: "COMMUNITY_VERIFICATION",
      );
    }

    return CitizenNotificationPresentation(
      category: _friendlyCategory(normalizedType),
      title: _sanitizeTitle(title),
      preview: _sanitizePreview(body),
      timestampLabel: timestamp,
      isUnread: isUnread,
      routeHint: meta["route"]?.toString(),
      publicReference: meta["publicReference"]?.toString(),
    );
  }

  static bool _isBroadcast(String type, String title) {
    return type == "BroadcastAlert" ||
        type == "MissingPersonAlert" ||
        type == "StolenVehicleAlert" ||
        title.toLowerCase().startsWith("missing person:");
  }

  static bool _isReportSubmitted(String type, String title, String body) {
    final lowered = "$title $body".toLowerCase();
    if (type == "ReportSubmitted") return true;
    return type == "IncidentStatusUpdate" &&
        (lowered.contains("submitted") ||
            lowered.contains("has been received"));
  }

  static bool _isVerifyIncident(String type, String title) {
    final lowered = title.toLowerCase();
    return type == "NearbyIncidentVerification" ||
        type == "VerifyActiveIncident" ||
        (lowered.contains("nearby") && lowered.contains("reported"));
  }

  static String _friendlyCategory(String type) {
    switch (type) {
      case "EmergencyAlert":
        return "Emergency Alert";
      case "IncidentMessageReceived":
        return "Message";
      case "IncidentInformationRequest":
        return "Information Request";
      case "SupportChatReply":
        return "Support";
      default:
        return "Update";
    }
  }

  static String _sanitizeTitle(String title) {
    final trimmed = title.trim();
    if (trimmed.isEmpty) return "THE EYE update";
    if (RegExp(r"^[A-Z][A-Za-z]+([._][A-Za-z]+)+$").hasMatch(trimmed)) {
      return "THE EYE update";
    }
    return trimmed;
  }

  static String _sanitizePreview(String body) {
    final trimmed = body.trim();
    if (trimmed.isEmpty) return "Open for details.";
    if (trimmed.contains("confidence") ||
        trimmed.contains("UUID") ||
        trimmed.contains("statusVersion")) {
      return "Open for details.";
    }
    return trimmed;
  }

  static String? _extractReference(String body) {
    final match =
        RegExp(r"EYE-[A-Z0-9-]+", caseSensitive: false).firstMatch(body);
    return match?.group(0)?.toUpperCase();
  }
}
