/// Canonical volunteer category contract aligned with API `VolunteerType` enum.
class VolunteerCategory {
  const VolunteerCategory({
    required this.label,
    required this.apiType,
  });

  final String label;
  final String apiType;
}

const canonicalVolunteerCategories = <VolunteerCategory>[
  VolunteerCategory(label: "Doctor", apiType: "Doctor"),
  VolunteerCategory(label: "Nurse", apiType: "Nurse"),
  VolunteerCategory(label: "First Aid", apiType: "FirstAid"),
  VolunteerCategory(label: "Lawyer", apiType: "Lawyer"),
  VolunteerCategory(label: "Security Volunteer", apiType: "SecurityVolunteer"),
  VolunteerCategory(label: "Fire Volunteer", apiType: "FireVolunteer"),
  VolunteerCategory(label: "Search and Rescue", apiType: "SearchAndRescue"),
  VolunteerCategory(label: "Blood Donor", apiType: "BloodDonor"),
];

const canonicalVolunteerApiTypes = <String>{
  "Doctor",
  "Nurse",
  "FirstAid",
  "Lawyer",
  "SecurityVolunteer",
  "FireVolunteer",
  "SearchAndRescue",
  "BloodDonor",
};

class VolunteerCategorySelection {
  VolunteerCategorySelection([Iterable<String>? initial])
      : _selected = {...?initial};

  final Set<String> _selected;

  Set<String> get selected => Set.unmodifiable(_selected);

  bool get isEmpty => _selected.isEmpty;

  bool isSelected(String apiType) => _selected.contains(apiType);

  void toggle(String apiType) {
    if (_selected.contains(apiType)) {
      _selected.remove(apiType);
    } else {
      _selected.add(apiType);
    }
  }

  List<String> toPayload() => _selected.toList()..sort();

  String? validationError() {
    if (_selected.isEmpty) {
      return "Select at least one volunteer category";
    }
    for (final type in _selected) {
      if (!canonicalVolunteerApiTypes.contains(type)) {
        return "Unsupported volunteer category: $type";
      }
    }
    return null;
  }
}
