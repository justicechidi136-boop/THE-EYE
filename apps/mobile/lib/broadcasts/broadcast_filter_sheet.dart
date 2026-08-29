import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";

enum BroadcastLocationFilter { allLocations, nearMe }

@immutable
class BroadcastFeedFilters {
  const BroadcastFeedFilters({
    this.category,
    this.status,
    this.location = BroadcastLocationFilter.allLocations,
    this.latitude,
    this.longitude,
  });

  final String? category;
  final String? status;
  final BroadcastLocationFilter location;
  final double? latitude;
  final double? longitude;

  bool get isNearMe => location == BroadcastLocationFilter.nearMe;

  int get activeCount =>
      (category == null ? 0 : 1) +
      (status == null ? 0 : 1) +
      (isNearMe ? 1 : 0);

  BroadcastFeedFilters withCoordinates(double latitude, double longitude) =>
      BroadcastFeedFilters(
        category: category,
        status: status,
        location: location,
        latitude: latitude,
        longitude: longitude,
      );
}

Future<BroadcastFeedFilters?> showBroadcastFilterSheet(
  BuildContext context, {
  required BroadcastFeedFilters initial,
}) {
  return showModalBottomSheet<BroadcastFeedFilters>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (_) => _BroadcastFilterSheet(initial: initial),
  );
}

class _BroadcastFilterSheet extends StatefulWidget {
  const _BroadcastFilterSheet({required this.initial});

  final BroadcastFeedFilters initial;

  @override
  State<_BroadcastFilterSheet> createState() => _BroadcastFilterSheetState();
}

class _BroadcastFilterSheetState extends State<_BroadcastFilterSheet> {
  late String? _category = widget.initial.category;
  late String? _status = widget.initial.status;
  late BroadcastLocationFilter _location = widget.initial.location;

  void _reset() {
    setState(() {
      _category = null;
      _status = null;
      _location = BroadcastLocationFilter.allLocations;
    });
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return FractionallySizedBox(
      heightFactor: 0.78,
      child: Column(
        children: [
          const SizedBox(height: 10),
          Container(
            width: 42,
            height: 4,
            decoration: BoxDecoration(
              color: semantics.mutedText.withAlpha(90),
              borderRadius: BorderRadius.circular(4),
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 12, 8, 4),
            child: Row(
              children: [
                Expanded(
                  child: Text(
                    "Filter broadcasts",
                    style: Theme.of(context).textTheme.titleLarge,
                  ),
                ),
                IconButton(
                  tooltip: "Close filters",
                  onPressed: () => Navigator.of(context).pop(),
                  icon: const Icon(Icons.close),
                ),
              ],
            ),
          ),
          Expanded(
            child: ListView(
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
              children: [
                _FilterGroup(
                  title: "Broadcast type",
                  children: [
                    ChoiceChip(
                      label: const Text("All"),
                      selected: _category == null,
                      onSelected: (_) => setState(() => _category = null),
                    ),
                    ChoiceChip(
                      label: const Text("Stolen Vehicle"),
                      selected: _category == "StolenVehicle",
                      onSelected: (_) =>
                          setState(() => _category = "StolenVehicle"),
                    ),
                    ChoiceChip(
                      label: const Text("Missing Person"),
                      selected: _category == "MissingPerson",
                      onSelected: (_) =>
                          setState(() => _category = "MissingPerson"),
                    ),
                  ],
                ),
                const SizedBox(height: 20),
                _FilterGroup(
                  title: "Status",
                  children: [
                    for (final option in const <String?>[
                      null,
                      "Active",
                      "Resolved",
                      "Cancelled",
                      "Expired",
                    ])
                      ChoiceChip(
                        label: Text(option ?? "All"),
                        selected: _status == option,
                        onSelected: (_) => setState(() => _status = option),
                      ),
                  ],
                ),
                const SizedBox(height: 20),
                _FilterGroup(
                  title: "Location",
                  children: [
                    ChoiceChip(
                      label: const Text("All locations"),
                      selected:
                          _location == BroadcastLocationFilter.allLocations,
                      onSelected: (_) => setState(
                        () => _location = BroadcastLocationFilter.allLocations,
                      ),
                    ),
                    ChoiceChip(
                      label: const Text("Near me"),
                      selected: _location == BroadcastLocationFilter.nearMe,
                      onSelected: (_) => setState(
                        () => _location = BroadcastLocationFilter.nearMe,
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 8, 20, 16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                OutlinedButton(
                  onPressed: _reset,
                  child: const Text("Reset all"),
                ),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () => Navigator.of(context).pop(
                    BroadcastFeedFilters(
                      category: _category,
                      status: _status,
                      location: _location,
                    ),
                  ),
                  child: const Text("Show results"),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterGroup extends StatelessWidget {
  const _FilterGroup({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title.toUpperCase(),
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 8),
        Wrap(spacing: 8, runSpacing: 8, children: children),
      ],
    );
  }
}
