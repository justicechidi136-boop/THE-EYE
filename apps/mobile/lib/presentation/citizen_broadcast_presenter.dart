import "../broadcasts/broadcast_feed_service.dart";
import "../l10n/generated/app_localizations.dart";
import "citizen_date_time.dart";
import "missing_person_age.dart";

class CitizenBroadcastPresentation {
  const CitizenBroadcastPresentation({
    required this.title,
    required this.summary,
    required this.statusLabel,
    required this.relativeTime,
    required this.typeLabel,
  });

  final String title;
  final String summary;
  final String statusLabel;
  final String relativeTime;
  final String typeLabel;

  String get metadataLine =>
      relativeTime.isEmpty ? statusLabel : "$statusLabel · $relativeTime";
}

abstract final class CitizenBroadcastPresenter {
  static CitizenBroadcastPresentation present(
    BroadcastFeedItem item,
    AppLocalizations l10n, {
    DateTime? now,
  }) {
    final type = _normalize(item.type);
    final statusLabel = _statusLabel(item, l10n);
    final relativeTime = item.publishedAt == null
        ? ""
        : CitizenDateTimeFormatter.formatRelative(
            item.publishedAt!,
            now: now,
          );

    if (type == "stolenvehicle") {
      return _stolenVehicle(item, l10n, statusLabel, relativeTime);
    }
    if (type == "missingperson") {
      return _missingPerson(item, l10n, statusLabel, relativeTime);
    }

    return CitizenBroadcastPresentation(
      title: _safeFallback(item.title, l10n.broadcastSafetyUpdateLabel),
      summary: _safeFallback(item.body, l10n.broadcastSafetyUpdateSummary),
      statusLabel: statusLabel,
      relativeTime: relativeTime,
      typeLabel: l10n.broadcastSafetyUpdateLabel,
    );
  }

  static CitizenBroadcastPresentation _stolenVehicle(
    BroadcastFeedItem item,
    AppLocalizations l10n,
    String statusLabel,
    String relativeTime,
  ) {
    final make = _meta(item, "make");
    final model = _meta(item, "model");
    final subject = [make, model].where((value) => value.isNotEmpty).join(" ");
    final safeSubject = subject.isEmpty
        ? _subjectFromTitle(item.title, "Stolen vehicle")
        : subject;
    final displaySubject =
        safeSubject.isEmpty ? l10n.broadcastVehicleFallback : safeSubject;
    final maskedPlate = _meta(item, "registrationMasked");
    final title = maskedPlate.isEmpty
        ? l10n.broadcastStolenVehicleTitle(displaySubject)
        : l10n.broadcastStolenVehicleTitleWithPlate(
            maskedPlate, displaySubject);
    final colour = _meta(item, "colour");
    final dated = CitizenDateTimeFormatter.tryParse(_meta(item, "stolenAt"));
    final summarySubject =
        [colour, subject].where((value) => value.isNotEmpty).join(" ");
    final summary = dated == null
        ? _safeFallback(item.body, l10n.broadcastStolenVehicleFallbackSummary)
        : l10n.broadcastStolenVehicleSummary(
            CitizenDateTimeFormatter.formatDate(dated),
            summarySubject.isEmpty ? displaySubject : summarySubject,
          );
    return CitizenBroadcastPresentation(
      title: title,
      summary: summary,
      statusLabel: statusLabel,
      relativeTime: relativeTime,
      typeLabel: l10n.broadcastStolenVehicleLabel,
    );
  }

  static CitizenBroadcastPresentation _missingPerson(
    BroadcastFeedItem item,
    AppLocalizations l10n,
    String statusLabel,
    String relativeTime,
  ) {
    final name = _meta(item, "fullName");
    final titleName = _subjectFromTitle(item.title, "Missing person");
    final safeName = name.isNotEmpty
        ? name
        : titleName.isNotEmpty
            ? titleName
            : l10n.broadcastPersonFallback;
    final age = _meta(item, "ageOrApproximateAge");
    final lastSeen =
        CitizenDateTimeFormatter.tryParse(_meta(item, "lastSeenAt"));
    String summary;
    if (lastSeen != null && MissingPersonAge.isValidAgeOrRange(age)) {
      final normalizedAge = MissingPersonAge.normalizeForApi(age);
      final date = CitizenDateTimeFormatter.formatDateTime(lastSeen);
      summary = MissingPersonAge.isExactAge(normalizedAge)
          ? l10n.broadcastMissingPersonExactSummary(
              normalizedAge,
              date,
              safeName,
            )
          : l10n.broadcastMissingPersonRangeSummary(
              normalizedAge,
              date,
              safeName,
            );
    } else {
      summary = _safeFallback(
        item.body,
        l10n.broadcastMissingPersonFallbackSummary,
      );
    }
    return CitizenBroadcastPresentation(
      title: l10n.broadcastMissingPersonTitle(safeName),
      summary: summary,
      statusLabel: statusLabel,
      relativeTime: relativeTime,
      typeLabel: l10n.broadcastMissingPersonLabel,
    );
  }

  static String _statusLabel(BroadcastFeedItem item, AppLocalizations l10n) {
    if (item.expired) return l10n.broadcastStatusExpired;
    return switch (_normalize(item.status)) {
      "active" || "published" => l10n.broadcastStatusActive,
      "updated" => l10n.broadcastStatusUpdated,
      "resolved" => l10n.broadcastStatusResolved,
      "withdrawn" || "withdrawnbyauthor" => l10n.broadcastStatusWithdrawn,
      "suspended" => l10n.broadcastStatusSuspended,
      "expired" => l10n.broadcastStatusExpired,
      _ => l10n.broadcastStatusUnavailable,
    };
  }

  static String _meta(BroadcastFeedItem item, String key) =>
      item.metadata[key]?.toString().trim() ?? "";

  static String _safeFallback(String value, String fallback) {
    final trimmed = value.trim();
    if (trimmed.isEmpty || _looksTechnical(trimmed)) return fallback;
    return trimmed;
  }

  static bool _looksTechnical(String value) {
    final normalized = _normalize(value);
    return normalized == "citizenbroadcast" ||
        normalized == "missingperson" ||
        normalized == "stolenvehicle" ||
        RegExp(r"^p[1-4][a-z0-9]+$").hasMatch(normalized);
  }

  static String _subjectFromTitle(String title, String prefix) {
    final trimmed = title.trim();
    final marker = "$prefix:";
    if (!trimmed.toLowerCase().startsWith(marker.toLowerCase())) return "";
    return trimmed.substring(marker.length).trim();
  }

  static String _normalize(String value) =>
      value.trim().toLowerCase().replaceAll(RegExp(r"[^a-z0-9]"), "");
}
