import "broadcast_feed_service.dart";

/// Public-safe share payload. Never include private contact, exact coordinates,
/// internal media URLs, full VIN/chassis, moderation metadata, or sightings.
class BroadcastPublicSharePayload {
  const BroadcastPublicSharePayload({
    required this.id,
    required this.type,
    required this.status,
    required this.title,
    required this.summary,
    required this.shareText,
    this.authorLabel,
    this.adminVerified = false,
    this.country,
    this.state,
    this.approximateArea,
    this.publishedAt,
    this.statusBanner,
    this.shareUrl,
    this.deepLink,
    this.locallyGenerated = false,
  });

  final String id;
  final String type;
  final String status;
  final String title;
  final String summary;
  final String shareText;
  final String? authorLabel;
  final bool adminVerified;
  final String? country;
  final String? state;
  final String? approximateArea;
  final DateTime? publishedAt;
  final String? statusBanner;
  final String? shareUrl;
  final String? deepLink;
  final bool locallyGenerated;

  factory BroadcastPublicSharePayload.fromApiJson(Map<String, dynamic> json) {
    final data = json["data"] is Map
        ? Map<String, dynamic>.from(json["data"] as Map)
        : Map<String, dynamic>.from(json);
    final id = (data["id"] as String?) ?? "";
    final title = (data["title"] as String?) ?? "Safety broadcast";
    final summary = (data["summary"] as String?) ?? title;
    final deepLink = (data["deepLink"] as String?) ?? "/broadcasts/$id";
    final shareUrl = data["shareUrl"] as String?;
    final shareText = (data["shareText"] as String?) ??
        BroadcastPublicShareMapper.buildShareText(
          title: title,
          summary: summary,
          deepLink: deepLink,
          shareUrl: shareUrl,
          statusBanner: data["statusBanner"] as String?,
          locallyGenerated: false,
        );
    return BroadcastPublicSharePayload(
      id: id,
      type: (data["type"] as String?) ?? "Emergency",
      status: (data["status"] as String?) ?? "Active",
      title: title,
      summary: summary,
      shareText: shareText,
      authorLabel: data["authorLabel"] as String?,
      adminVerified: data["adminVerified"] == true,
      country: data["country"] as String?,
      state: data["state"] as String?,
      approximateArea: data["approximateArea"] as String?,
      publishedAt: DateTime.tryParse((data["publishedAt"] as String?) ?? ""),
      statusBanner: data["statusBanner"] as String?,
      shareUrl: shareUrl,
      deepLink: deepLink,
      locallyGenerated: false,
    );
  }
}

abstract final class BroadcastPublicShareMapper {
  static const sensitiveFieldKeys = {
    "authorPhone",
    "authorEmail",
    "contactMethod",
    "creatorUserId",
    "creatorEmail",
    "latitude",
    "longitude",
    "lastSeenLatitude",
    "lastSeenLongitude",
    "lastKnownLatitude",
    "lastKnownLongitude",
    "registrationNumber",
    "vin",
    "vinLastFour",
    "chassisNumber",
    "internalMediaUrl",
    "storageKey",
    "suspendedReason",
    "moderationNotes",
    "witnessName",
    "witnessIdentity",
    "sightings",
    "metadata",
    "body",
  };

  static BroadcastPublicSharePayload fromPartialSource(
    Map<String, dynamic> source, {
    required bool locallyGenerated,
  }) {
    final sanitized = Map<String, dynamic>.from(source)
      ..removeWhere((key, _) => sensitiveFieldKeys.contains(key));

    final id = (sanitized["id"] as String?) ?? "";
    final type = (sanitized["type"] as String?) ?? "Emergency";
    final status = (sanitized["status"] as String?) ?? "Active";
    final title = (sanitized["title"] as String?) ?? "Safety broadcast";
    final summary = buildSafeSummary(type: type, title: title);
    final deepLink = sanitized["deepLink"] as String? ??
        (id.isEmpty ? null : "/broadcasts/$id");
    final shareText = buildShareText(
      title: title,
      summary: summary,
      deepLink: deepLink,
      statusBanner: statusBannerFor(status),
      locallyGenerated: locallyGenerated,
    );

    return BroadcastPublicSharePayload(
      id: id,
      type: type,
      status: status,
      title: title,
      summary: summary,
      shareText: shareText,
      authorLabel: sanitized["authorLabel"] as String?,
      adminVerified: sanitized["adminVerified"] == true,
      country: sanitized["country"] as String?,
      state: sanitized["state"] as String?,
      approximateArea: sanitized["approximateArea"] as String?,
      publishedAt:
          DateTime.tryParse((sanitized["publishedAt"] as String?) ?? ""),
      statusBanner: statusBannerFor(status),
      deepLink: deepLink,
      locallyGenerated: locallyGenerated,
    );
  }

  static BroadcastPublicSharePayload fromFeedItemFallback(
      BroadcastFeedItem item) {
    return fromPartialSource(
      {
        "id": item.id,
        "type": item.type,
        "status": item.status,
        "title": item.title,
        "authorLabel": item.authorLabel,
        "adminVerified": item.adminVerified,
        "country": item.country,
        "state": item.state,
        "publishedAt": item.publishedAt?.toIso8601String(),
        "deepLink": item.deepLink ?? "/broadcasts/${item.id}",
      },
      locallyGenerated: true,
    );
  }

  static String buildSafeSummary({
    required String type,
    required String title,
  }) {
    if (type == "MissingPerson") {
      return title.startsWith("Missing person")
          ? title
          : "Missing person alert: $title";
    }
    if (type == "StolenVehicle") {
      return title.startsWith("Stolen vehicle")
          ? title
          : "Stolen vehicle alert: $title";
    }
    return title;
  }

  static String? statusBannerFor(String status) {
    switch (status) {
      case "Resolved":
        return "Resolved";
      case "Suspended":
        return "Suspended";
      case "WithdrawnByAuthor":
        return "Withdrawn";
      case "Expired":
        return "Expired";
      default:
        return "Active";
    }
  }

  static String buildShareText({
    required String title,
    required String summary,
    String? deepLink,
    String? shareUrl,
    String? statusBanner,
    required bool locallyGenerated,
  }) {
    final parts = <String>[
      if (statusBanner != null && statusBanner.isNotEmpty) statusBanner,
      title,
      summary,
      if (shareUrl != null && shareUrl.isNotEmpty)
        shareUrl
      else if (deepLink != null)
        deepLink,
      if (locallyGenerated)
        "Preview generated on this device. Open THE EYE for the latest public-safe status.",
    ];
    return parts.where((part) => part.trim().isNotEmpty).join("\n\n");
  }

  static bool containsSensitiveShareData(Map<String, dynamic> payload) {
    for (final key in sensitiveFieldKeys) {
      if (payload.containsKey(key) && payload[key] != null) return true;
    }
    return false;
  }
}
