import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";

enum CommunicationThreadTab { all, mine, responders }

class CommunicationTabs extends StatelessWidget {
  const CommunicationTabs({
    super.key,
    required this.value,
    required this.onChanged,
  });

  final CommunicationThreadTab value;
  final ValueChanged<CommunicationThreadTab> onChanged;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    Widget tab(String label, CommunicationThreadTab tabValue) {
      final selected = value == tabValue;
      return Semantics(
        button: true,
        selected: selected,
        label: "$label messages",
        child: InkWell(
          onTap: () => onChanged(tabValue),
          child: Padding(
            padding: const EdgeInsets.only(bottom: 11, right: 4),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  label,
                  style: TextStyle(
                    color: selected ? colors.accentText : colors.mutedText,
                    fontSize: 13,
                    fontWeight: selected ? FontWeight.w700 : FontWeight.w600,
                  ),
                ),
                const SizedBox(height: 8),
                Container(
                  height: 2,
                  width: 28,
                  decoration: BoxDecoration(
                    color: selected ? colors.accentText : Colors.transparent,
                    borderRadius: BorderRadius.circular(2),
                  ),
                ),
              ],
            ),
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        border: Border(bottom: BorderSide(color: colors.border)),
      ),
      child: Row(
        children: [
          tab("All", CommunicationThreadTab.all),
          const SizedBox(width: 20),
          tab("Mine", CommunicationThreadTab.mine),
          const SizedBox(width: 20),
          tab("Responders", CommunicationThreadTab.responders),
        ],
      ),
    );
  }
}
