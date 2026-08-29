class CitizenLocationPresentation {
  const CitizenLocationPresentation({
    this.streetAddress,
    this.subLocality,
    this.cityTown,
    this.lga,
    this.state,
    this.country,
  });

  final String? streetAddress;
  final String? subLocality;
  final String? cityTown;
  final String? lga;
  final String? state;
  final String? country;

  String get specificLine {
    final cleanedStreet = _clean(streetAddress);
    final cleanedSubLocality = _clean(subLocality);
    final preferStreet = cleanedStreet != null &&
        (!_looksLikePlusCode(cleanedStreet) || cleanedSubLocality == null);
    return _unique([
      if (preferStreet) cleanedStreet,
      cleanedSubLocality,
    ]).join(", ");
  }

  String get administrativeLine => _unique([cityTown, lga, state]).join(", ");

  List<String> get lines {
    final result = <String>[
      if (specificLine.isNotEmpty) specificLine,
      if (administrativeLine.isNotEmpty) administrativeLine,
    ];
    final countryLabel = _clean(country);
    if (result.isEmpty && countryLabel != null) {
      result.add(countryLabel);
    }
    return result;
  }

  String get label => lines.isEmpty ? "Location unavailable" : lines.join("\n");

  static List<String> _unique(Iterable<String?> values) {
    final seen = <String>{};
    return values
        .map(_clean)
        .whereType<String>()
        .where((value) => seen.add(value.toLowerCase()))
        .toList(growable: false);
  }

  static String? _clean(String? value) {
    final trimmed = value?.trim();
    return trimmed == null || trimmed.isEmpty ? null : trimmed;
  }

  static bool _looksLikePlusCode(String value) => RegExp(
        r"\b[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,}\b",
        caseSensitive: false,
      ).hasMatch(value);
}
