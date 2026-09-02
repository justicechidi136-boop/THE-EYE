import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";

/// Open page section that uses spacing and a divider instead of a card shell.
class FlatSection extends StatelessWidget {
  const FlatSection({
    required this.title,
    required this.child,
    this.showDivider = true,
    super.key,
  });

  final String title;
  final Widget child;
  final bool showDivider;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: colors.bodyText,
                fontWeight: FontWeight.w700,
              ),
        ),
        const SizedBox(height: 8),
        child,
        if (showDivider) ...[
          const SizedBox(height: 8),
          Divider(color: colors.divider, height: 1),
        ],
      ],
    );
  }
}
