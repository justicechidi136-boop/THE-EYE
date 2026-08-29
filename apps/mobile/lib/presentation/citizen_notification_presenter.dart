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
      final broadcastType =
          meta["broadcastCategory"]?.toString() ?? normalizedType;
      final fullName = (meta["fullName"] as String?)?.trim();
      final age = (meta["ageOrApproximateAge"] as String?)?.trim();
      final lastSeenRaw = meta["lastSeenAt"];
      final lastSeen = CitizenDateTimeFormatter.tryParse(lastSeenRaw);
      final lastSeenFriendly = lastSeen == null
          ? null
          : CitizenDateTimeFormatter.formatDateTime(lastSeen);
      final missingPerson =
          _normalized(broadcastType).contains("missingperson") ||
              title.trim().toLowerCase().startsWith("missing person:");
      final stolenVehicle =
          _normalized(broadcastType).contains("stolenvehicle");
      final vehicle = _vehicleDescription(meta);
      final plate = _first(meta, ["registrationMasked", "registrationNumber"]);
      final colour = _first(meta, ["colour", "color"]);
      final stolenAt = CitizenDateTimeFormatter.tryParse(meta["stolenAt"]);
      final structuredTitle = missingPerson && fullName?.isNotEmpty == true
          ? "Missing person: $fullName"
          : stolenVehicle && vehicle.isNotEmpty
              ? "Stolen vehicle: $vehicle"
              : _sanitizeTitle(title);
      final preview = missingPerson &&
              fullName != null &&
              age != null &&
              lastSeenFriendly != null
          ? MissingPersonAge.notificationPreview(
              fullName: fullName,
              ageOrRange: age,
              lastSeenFriendly: lastSeenFriendly,
            )
          : stolenVehicle && vehicle.isNotEmpty
              ? _stolenVehiclePreview(
                  vehicle: vehicle,
                  colour: colour,
                  plate: plate,
                  stolenAt: stolenAt,
                )
              : _sanitizePreview(body);
      return CitizenNotificationPresentation(
        category: "Broadcast Alert",
        title: structuredTitle,
        preview: preview,
        timestampLabel: timestamp,
        isUnread: isUnread,
        routeHint: "BROADCAST_DETAILS",
        publicReference: meta["publicReference"]?.toString(),
      );
    }

    if (_isReportSubmitted(normalizedType, title, body)) {
      final incidentLabel = _incidentLabel(meta);
      final noun = incidentLabel.toLowerCase();
      final reference = meta["publicReference"]?.toString() ??
          _extractReference(body) ??
          "your report";
      return CitizenNotificationPresentation(
        category: "Report Submitted",
        title: "Your $noun report has been received",
        preview:
            "Your $noun report $reference has been successfully submitted.",
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
        category: "Verify $incidentLabel",
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

    if (_isSighting(normalizedType, meta)) {
      final subject = _sightingSubject(meta);
      final rawPreview = _sanitizePreview(body);
      return CitizenNotificationPresentation(
        category: "New Sighting",
        title: subject == null
            ? "New sighting reported"
            : "New sighting reported for $subject",
        preview: rawPreview.toLowerCase().contains("sighting")
            ? "Open to view the sighting details."
            : rawPreview,
        timestampLabel: timestamp,
        isUnread: isUnread,
        routeHint: "BROADCAST_DETAILS",
        publicReference: meta["publicReference"]?.toString(),
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

  static bool _isSighting(String type, Map<String, dynamic> metadata) {
    final eventType = metadata["eventType"]?.toString().toLowerCase() ?? "";
    return type.toLowerCase().contains("sighting") ||
        eventType.contains("sighting");
  }

  static String _incidentLabel(Map<String, dynamic> metadata) {
    final value = metadata["incidentCategory"]?.toString() ??
        metadata["reportType"]?.toString() ??
        metadata["category"]?.toString() ??
        "Emergency";
    return citizenIncidentCategoryLabel(value);
  }

  static String? _sightingSubject(Map<String, dynamic> metadata) {
    final broadcastType =
        metadata["broadcastType"]?.toString().trim().toLowerCase().replaceAll(
                  RegExp(r"[^a-z0-9]"),
                  "",
                ) ??
            "";
    final fullName = metadata["fullName"]?.toString().trim() ?? "";
    if (broadcastType == "missingperson" || fullName.isNotEmpty) {
      return fullName.isEmpty ? "missing person" : "missing person: $fullName";
    }
    final make = metadata["make"]?.toString().trim() ?? "";
    final model = metadata["model"]?.toString().trim() ?? "";
    final plate = metadata["registrationNumber"]?.toString().trim() ??
        metadata["registrationMasked"]?.toString().trim() ??
        "";
    final vehicle = [make, model].where((value) => value.isNotEmpty).join(" ");
    if (vehicle.isEmpty && plate.isEmpty) {
      return broadcastType == "stolenvehicle" ? "stolen vehicle" : null;
    }
    return plate.isEmpty
        ? "stolen vehicle: $vehicle"
        : "stolen vehicle: $vehicle ($plate)";
  }

  static String _vehicleDescription(Map<String, dynamic> metadata) {
    return [
      _first(metadata, ["make"]),
      _first(metadata, ["model"]),
    ].where((value) => value != null && value.isNotEmpty).join(" ");
  }

  static String _stolenVehiclePreview({
    required String vehicle,
    String? colour,
    String? plate,
    DateTime? stolenAt,
  }) {
    final description = [
      if (colour?.isNotEmpty == true) colour,
      vehicle,
    ].whereType<String>().join(" ");
    final identified =
        plate?.isNotEmpty == true ? "$description ($plate)" : description;
    final when = stolenAt == null
        ? ""
        : " on ${CitizenDateTimeFormatter.formatDateTime(stolenAt)}";
    return "$identified was reported stolen$when.";
  }

  static String? _first(
    Map<String, dynamic> metadata,
    List<String> keys,
  ) {
    for (final key in keys) {
      final value = metadata[key]?.toString().trim();
      if (value?.isNotEmpty == true) return value;
    }
    return null;
  }

  static String _normalized(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r"[^a-z0-9]"), "");

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
    return trimmed.replaceAllMapped(
      RegExp(
        r"\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z?",
        caseSensitive: false,
      ),
      (match) {
        final parsed = DateTime.tryParse(match.group(0)!);
        return parsed == null
            ? "the reported time"
            : CitizenDateTimeFormatter.formatDateTime(parsed);
      },
    );
  }

  static String? _extractReference(String body) {
    final match = RegExp(
      r"EYE-[A-Z0-9-]+",
      caseSensitive: false,
    ).firstMatch(body);
    return match?.group(0)?.toUpperCase();
  }
}
