/// Approved missing-person age presentation for citizen UX.
abstract final class MissingPersonAge {
  static const exactMode = "exact";
  static const rangeMode = "range";

  static const approvedRanges = <String>[
    "0–5",
    "6–9",
    "10–15",
    "16–17",
    "18–25",
    "26–40",
    "41–60",
    "60+",
  ];

  static bool isExactAge(String value) {
    final trimmed = value.trim();
    if (trimmed.isEmpty) return false;
    final age = int.tryParse(trimmed);
    return age != null && age >= 0 && age <= 120;
  }

  static bool isApprovedRange(String value) {
    final normalized = value.trim().replaceAll("-", "–");
    return approvedRanges.contains(normalized);
  }

  static bool isValidAgeOrRange(String value) {
    return isExactAge(value) || isApprovedRange(value);
  }

  static String normalizeForApi(String value) {
    final trimmed = value.trim();
    if (isExactAge(trimmed)) return trimmed;
    return trimmed.replaceAll("-", "–");
  }

  static String displayLabel(String value) {
    final normalized = normalizeForApi(value);
    if (isExactAge(normalized)) return "Age $normalized";
    return "Approx. age $normalized";
  }

  static String notificationPreview({
    required String fullName,
    required String ageOrRange,
    required String lastSeenFriendly,
  }) {
    final name = fullName.trim();
    final age = normalizeForApi(ageOrRange);
    if (isExactAge(age)) {
      return "$age-year-old $name was last seen on $lastSeenFriendly.";
    }
    return "$name, approximately $age years old, was last seen on $lastSeenFriendly.";
  }
}
