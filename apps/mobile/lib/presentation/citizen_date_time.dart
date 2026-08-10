/// Central citizen-facing date/time presentation.
///
/// Never throw parsing exceptions to the UI. Preserve original timestamps
/// at the call site; only format for display.
abstract final class CitizenDateTimeFormatter {
  static const _months = [
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

  static DateTime? tryParse(Object? value) {
    if (value == null) return null;
    if (value is DateTime) return value;
    if (value is String) {
      final trimmed = value.trim();
      if (trimmed.isEmpty) return null;
      return DateTime.tryParse(trimmed);
    }
    return null;
  }

  static String _formatTime(DateTime local) {
    final hour = local.hour;
    final minute = local.minute.toString().padLeft(2, "0");
    final hour12 = hour % 12 == 0 ? 12 : hour % 12;
    final suffix = hour >= 12 ? "PM" : "AM";
    return "$hour12:$minute $suffix";
  }

  /// Absolute local date+time: `10 Aug 2026 · 9:42 PM`
  static String formatReportedAt(DateTime value, {DateTime? now}) {
    final local = value.toLocal();
    return "${local.day} ${_months[local.month - 1]} ${local.year} · ${_formatTime(local)}";
  }

  /// Absolute local date+time with comma: `8 Aug 2026, 5:53 PM`
  static String formatDateTime(DateTime value, {DateTime? now}) {
    final local = value.toLocal();
    return "${local.day} ${_months[local.month - 1]} ${local.year}, ${_formatTime(local)}";
  }

  /// Same-day → `Today, 9:42 PM`; otherwise [formatDateTime].
  static String formatFriendly(DateTime value, {DateTime? now}) {
    final reference = (now ?? DateTime.now()).toLocal();
    final local = value.toLocal();
    final sameDay = reference.year == local.year &&
        reference.month == local.month &&
        reference.day == local.day;
    if (sameDay) return "Today, ${_formatTime(local)}";
    return formatDateTime(local, now: reference);
  }

  static String formatDate(DateTime value) {
    final local = value.toLocal();
    return "${local.day} ${_months[local.month - 1]} ${local.year}";
  }

  static String formatTime(DateTime value) => _formatTime(value.toLocal());

  static String formatRelative(DateTime value, {DateTime? now}) {
    final reference = now ?? DateTime.now();
    final diff = reference.difference(value);
    if (diff.isNegative) {
      final ahead = value.difference(reference);
      if (ahead.inMinutes < 1) return "In under a minute";
      if (ahead.inHours < 1) return "In ${ahead.inMinutes}m";
      if (ahead.inDays < 1) return "In ${ahead.inHours}h";
      if (ahead.inDays < 7) return "In ${ahead.inDays}d";
      return formatDateTime(value, now: reference);
    }
    if (diff.inMinutes < 1) return "Just now";
    if (diff.inHours < 1) return "${diff.inMinutes}m ago";
    if (diff.inDays < 1) return "${diff.inHours}h ago";
    if (diff.inDays < 7) return "${diff.inDays}d ago";
    return formatDateTime(value, now: reference);
  }

  /// Parses ISO/string safely and formats; returns [fallback] on failure.
  static String formatDateTimeOr(
    Object? value, {
    String fallback = "Time unavailable",
    DateTime? now,
  }) {
    final parsed = tryParse(value);
    if (parsed == null) return fallback;
    return formatDateTime(parsed, now: now);
  }

  static String formatReportedAtOr(
    Object? value, {
    String fallback = "Time unavailable",
    DateTime? now,
  }) {
    final parsed = tryParse(value);
    if (parsed == null) return fallback;
    return formatReportedAt(parsed, now: now);
  }
}
