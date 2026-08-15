import "package:flutter/material.dart";

import "../design_system/eye_input_theme.dart";

typedef LanguageRegionOptionLabel<T> = String Function(T option);
typedef LanguageRegionOptionSearch<T> = String Function(T option);

class LanguageRegionSelectorField<T> extends StatelessWidget {
  const LanguageRegionSelectorField({
    required this.label,
    required this.valueLabel,
    required this.options,
    required this.optionLabel,
    required this.optionSearchText,
    required this.onChanged,
    this.errorText,
    this.enabled = true,
    this.leading,
    this.semanticHint,
    super.key,
  });

  final String label;
  final String valueLabel;
  final List<T> options;
  final LanguageRegionOptionLabel<T> optionLabel;
  final LanguageRegionOptionSearch<T> optionSearchText;
  final ValueChanged<T> onChanged;
  final String? errorText;
  final bool enabled;
  final Widget? leading;
  final String? semanticHint;

  Future<void> _showPicker(BuildContext context) async {
    if (!enabled) return;
    final selected = await showModalBottomSheet<T>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (context) => _LanguageRegionPickerSheet<T>(
        title: label,
        options: options,
        optionLabel: optionLabel,
        optionSearchText: optionSearchText,
      ),
    );
    if (selected != null) onChanged(selected);
  }

  @override
  Widget build(BuildContext context) {
    return Semantics(
      button: true,
      label: label,
      value: valueLabel,
      hint: semanticHint ?? "Double tap to choose",
      child: InkWell(
        borderRadius: BorderRadius.circular(8),
        onTap: enabled ? () => _showPicker(context) : null,
        child: InputDecorator(
          decoration: EyeInputTheme.decoration(
            context,
            hintText: label,
            errorText: errorText,
          ),
          child: Row(
            children: [
              if (leading != null) ...[
                leading!,
                const SizedBox(width: 10),
              ],
              Expanded(
                child: Text(
                  valueLabel,
                  style: EyeInputTheme.textStyle(context),
                ),
              ),
              const Icon(Icons.expand_more),
            ],
          ),
        ),
      ),
    );
  }
}

class _LanguageRegionPickerSheet<T> extends StatefulWidget {
  const _LanguageRegionPickerSheet({
    required this.title,
    required this.options,
    required this.optionLabel,
    required this.optionSearchText,
  });

  final String title;
  final List<T> options;
  final LanguageRegionOptionLabel<T> optionLabel;
  final LanguageRegionOptionSearch<T> optionSearchText;

  @override
  State<_LanguageRegionPickerSheet<T>> createState() =>
      _LanguageRegionPickerSheetState<T>();
}

class _LanguageRegionPickerSheetState<T>
    extends State<_LanguageRegionPickerSheet<T>> {
  final _searchController = TextEditingController();

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final query = _searchController.text.trim().toLowerCase();
    final filtered = query.isEmpty
        ? widget.options
        : widget.options
            .where((option) =>
                widget.optionSearchText(option).toLowerCase().contains(query))
            .toList(growable: false);

    return SafeArea(
      child: Padding(
        padding: EdgeInsets.only(
          left: 16,
          right: 16,
          bottom: 16 + MediaQuery.of(context).viewInsets.bottom,
        ),
        child: SizedBox(
          height: MediaQuery.of(context).size.height * 0.72,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.title,
                style: Theme.of(context).textTheme.titleLarge,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _searchController,
                autofocus: true,
                decoration: const InputDecoration(
                  prefixIcon: Icon(Icons.search),
                  labelText: "Search",
                ),
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Expanded(
                child: filtered.isEmpty
                    ? const Center(child: Text("No matches"))
                    : ListView.separated(
                        itemCount: filtered.length,
                        separatorBuilder: (_, __) => const Divider(height: 1),
                        itemBuilder: (context, index) {
                          final option = filtered[index];
                          return ListTile(
                            minVerticalPadding: 12,
                            title: Text(widget.optionLabel(option)),
                            trailing: const Icon(Icons.chevron_right),
                            onTap: () => Navigator.of(context).pop(option),
                          );
                        },
                      ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
