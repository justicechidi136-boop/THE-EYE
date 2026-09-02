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
    final mediaQuery = MediaQuery.of(context);
    final bottomSystemInset =
        MediaQueryData.fromView(View.of(context)).viewPadding.bottom;
    return ConstrainedBox(
      constraints: BoxConstraints(maxHeight: mediaQuery.size.height * 0.88),
      child: Column(
        mainAxisSize: MainAxisSize.min,
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
            padding: const EdgeInsets.fromLTRB(20, 12, 8, 8),
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
          Flexible(
            fit: FlexFit.loose,
            child: ListView(
              shrinkWrap: true,
              padding: const EdgeInsets.fromLTRB(20, 8, 20, 20),
              children: [
                _FilterDropdown<String>(
                  key: const Key("broadcast-filter-type"),
                  label: "Broadcast type",
                  value: _category ?? "all",
                  options: const [
                    _FilterOption(value: "all", label: "All"),
                    _FilterOption(
                      value: "StolenVehicle",
                      label: "Stolen Vehicle",
                    ),
                    _FilterOption(
                      value: "MissingPerson",
                      label: "Missing Person",
                    ),
                  ],
                  onChanged: (value) => setState(
                    () => _category = value == "all" ? null : value,
                  ),
                ),
                const SizedBox(height: 16),
                _FilterDropdown<String>(
                  key: const Key("broadcast-filter-status"),
                  label: "Status",
                  value: _status ?? "all",
                  options: const [
                    _FilterOption(value: "all", label: "All"),
                    _FilterOption(value: "Active", label: "Active"),
                    _FilterOption(value: "Resolved", label: "Resolved"),
                    _FilterOption(value: "Cancelled", label: "Cancelled"),
                    _FilterOption(value: "Expired", label: "Expired"),
                  ],
                  onChanged: (value) => setState(
                    () => _status = value == "all" ? null : value,
                  ),
                ),
                const SizedBox(height: 16),
                _FilterDropdown<BroadcastLocationFilter>(
                  key: const Key("broadcast-filter-location"),
                  label: "Location",
                  value: _location,
                  options: const [
                    _FilterOption(
                      value: BroadcastLocationFilter.allLocations,
                      label: "All locations",
                    ),
                    _FilterOption(
                      value: BroadcastLocationFilter.nearMe,
                      label: "Near me",
                    ),
                  ],
                  onChanged: (value) => setState(() => _location = value),
                ),
              ],
            ),
          ),
          DecoratedBox(
            decoration: BoxDecoration(
              border: Border(top: BorderSide(color: semantics.divider)),
            ),
            child: SafeArea(
              top: false,
              minimum: EdgeInsets.fromLTRB(
                20,
                10,
                20,
                10 + bottomSystemInset,
              ),
              child: Row(
                children: [
                  TextButton(
                    key: const Key("broadcast-filter-reset"),
                    onPressed: _reset,
                    child: const Text("Reset all"),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: FilledButton(
                      key: const Key("broadcast-filter-show-results"),
                      onPressed: () => Navigator.of(context).pop(
                        BroadcastFeedFilters(
                          category: _category,
                          status: _status,
                          location: _location,
                        ),
                      ),
                      child: const Text("Show results"),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _FilterOption<T> {
  const _FilterOption({required this.value, required this.label});

  final T value;
  final String label;
}

class _FilterDropdown<T> extends StatelessWidget {
  const _FilterDropdown({
    super.key,
    required this.label,
    required this.value,
    required this.options,
    required this.onChanged,
  });

  final String label;
  final T value;
  final List<_FilterOption<T>> options;
  final ValueChanged<T> onChanged;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return DropdownButtonFormField<T>(
      key: ValueKey("$label-$value"),
      initialValue: value,
      isExpanded: true,
      menuMaxHeight: 320,
      dropdownColor: semantics.surface,
      icon: Icon(Icons.keyboard_arrow_down_rounded,
          color: semantics.primaryAction),
      decoration: InputDecoration(
        labelText: label,
        filled: true,
        fillColor: semantics.surface,
        contentPadding:
            const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: semantics.border),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(8),
          borderSide: BorderSide(color: semantics.primaryAction, width: 1.5),
        ),
      ),
      items: [
        for (final option in options)
          DropdownMenuItem<T>(
            value: option.value,
            child: Text(option.label, overflow: TextOverflow.ellipsis),
          ),
      ],
      onChanged: (next) {
        if (next != null) onChanged(next);
      },
    );
  }
}
