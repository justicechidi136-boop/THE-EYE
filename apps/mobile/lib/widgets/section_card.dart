import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";
import "../theme/the_eye_theme.dart";

class SectionCard extends StatelessWidget {
  const SectionCard({required this.title, required this.child, super.key});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: context.eyeSurface,
        border: Border.all(color: context.eyeBorder),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  color: EyeSemanticColors.of(context).bodyText,
                ),
          ),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}
