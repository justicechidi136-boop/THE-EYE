/// Canonical Family Circle / emergency contact relationship values.
abstract final class EmergencyContactRelationships {
  static const values = <String>[
    "Parent",
    "Spouse",
    "Sibling",
    "Child",
    "Guardian",
    "Relative",
    "Friend",
    "Neighbour",
    "Colleague",
    "Other",
  ];

  static String normalize(String? raw) {
    final trimmed = raw?.trim() ?? "";
    if (trimmed.isEmpty) return "Other";
    for (final value in values) {
      if (trimmed.toLowerCase() == value.toLowerCase()) return value;
    }
    return "Other";
  }

  static bool isValid(String? raw) {
    final trimmed = raw?.trim() ?? "";
    if (trimmed.isEmpty) return false;
    return values.any((value) => value.toLowerCase() == trimmed.toLowerCase());
  }
}
