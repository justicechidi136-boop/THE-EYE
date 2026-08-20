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

  List<String> get lines {
    final first = _unique([streetAddress, subLocality]).join(", ");
    final second = _unique([cityTown, lga, state]).join(", ");
    final result = <String>[
      if (first.isNotEmpty) first,
      if (second.isNotEmpty) second
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
}
