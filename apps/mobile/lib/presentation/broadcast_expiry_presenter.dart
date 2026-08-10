import "dart:developer" as developer;

import "citizen_date_time.dart";

/// Citizen-facing broadcast status + expiry lines (never contradictory).
class BroadcastExpiryPresentation {
  const BroadcastExpiryPresentation({
    required this.statusLabel,
    this.detailLine,
    this.isExpired = false,
    this.backendStatusStale = false,
  });

  final String statusLabel;
  final String? detailLine;
  final bool isExpired;
  final bool backendStatusStale;
}

/// Resolves Active + past-expiresAt inconsistencies without mutating backend state.
abstract final class BroadcastExpiryPresenter {
  static BroadcastExpiryPresentation present({
    required String? backendStatus,
    DateTime? expiresAt,
    DateTime? resolvedAt,
    DateTime? now,
    DateTime Function()? clock,
  }) {
    final reference = now ?? clock?.call() ?? DateTime.now();
    final status = (backendStatus ?? "Active").trim();
    final normalized = status.toLowerCase();

    if (normalized == "withdrawn") {
      return const BroadcastExpiryPresentation(
        statusLabel: "Withdrawn",
      );
    }
    if (normalized == "resolved") {
      return BroadcastExpiryPresentation(
        statusLabel: "Resolved",
        detailLine: resolvedAt == null
            ? null
            : "Resolved ${CitizenDateTimeFormatter.formatDate(resolvedAt)}",
      );
    }

    final expiredByTime =
        expiresAt != null && !expiresAt.toUtc().isAfter(reference.toUtc());
    final expiredByStatus = normalized == "expired" || normalized == "inactive";

    if (expiredByTime || expiredByStatus) {
      final staleActive = normalized == "active" && expiredByTime;
      if (staleActive) {
        developer.log(
          "Broadcast status Active while expiresAt is past "
          "(expiresAt=${expiresAt.toUtc().toIso8601String()})",
          name: "BroadcastExpiryPresenter",
        );
      }
      return BroadcastExpiryPresentation(
        statusLabel: "Expired",
        detailLine:
            expiresAt == null ? null : _expiredAgo(expiresAt, reference),
        isExpired: true,
        backendStatusStale: staleActive,
      );
    }

    // Active (or unknown non-terminal) with future expiry
    final detail = expiresAt == null ? null : _expiresIn(expiresAt, reference);
    final label = normalized == "active" || status.isEmpty ? "Active" : status;
    return BroadcastExpiryPresentation(
      statusLabel: label,
      detailLine: detail,
      isExpired: false,
    );
  }

  static String _expiresIn(DateTime expiresAt, DateTime now) {
    final remaining = expiresAt.toUtc().difference(now.toUtc());
    if (remaining.isNegative || remaining.inSeconds == 0) {
      return _expiredAgo(expiresAt, now);
    }
    if (remaining.inMinutes < 1) return "Expires in under a minute";
    if (remaining.inHours < 1) {
      return "Expires in ${remaining.inMinutes} ${remaining.inMinutes == 1 ? "minute" : "minutes"}";
    }
    if (remaining.inDays < 1) {
      return "Expires in ${remaining.inHours} ${remaining.inHours == 1 ? "hour" : "hours"}";
    }
    if (remaining.inDays < 14) {
      return "Expires in ${remaining.inDays} ${remaining.inDays == 1 ? "day" : "days"}";
    }
    return "Expires ${CitizenDateTimeFormatter.formatDateTime(expiresAt, now: now)}";
  }

  static String _expiredAgo(DateTime expiresAt, DateTime now) {
    final elapsed = now.toUtc().difference(expiresAt.toUtc());
    if (elapsed.inMinutes < 1) return "Expired just now";
    if (elapsed.inHours < 1) {
      return "Expired ${elapsed.inMinutes} ${elapsed.inMinutes == 1 ? "minute" : "minutes"} ago";
    }
    if (elapsed.inDays < 1) {
      return "Expired ${elapsed.inHours} ${elapsed.inHours == 1 ? "hour" : "hours"} ago";
    }
    if (elapsed.inDays < 14) {
      return "Expired ${elapsed.inDays} ${elapsed.inDays == 1 ? "day" : "days"} ago";
    }
    return "Expired ${CitizenDateTimeFormatter.formatDate(expiresAt)}";
  }
}
