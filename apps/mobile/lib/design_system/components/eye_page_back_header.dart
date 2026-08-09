import "package:flutter/material.dart";

import "../eye_semantic_colors.dart";
import "../typography.dart";

/// Back-arrow header used on Figma sub-pages (`719:3366`, `286:188`).
/// Set [showBack] to false for primary tab pages (Services / Broadcast / Settings).
class EyePageBackHeader extends StatelessWidget {
  const EyePageBackHeader({
    this.title,
    this.onBack,
    this.showBack = true,
    super.key,
  });

  final String? title;
  final VoidCallback? onBack;
  final bool showBack;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: EdgeInsets.fromLTRB(showBack ? 8 : 16, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (showBack)
            IconButton(
              tooltip: "Back",
              onPressed: onBack ?? () => Navigator.of(context).maybePop(),
              icon: Icon(Icons.arrow_back,
                  color: semantics.interactiveText, size: 24),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
            ),
          if (title != null) ...[
            if (showBack) const SizedBox(height: 2),
            Padding(
              padding: EdgeInsets.only(left: showBack ? 8 : 0),
              child: Text(
                title!,
                style: EyeTypography.authHeading.copyWith(
                  color: semantics.bodyText,
                ),
              ),
            ),
          ],
        ],
      ),
    );
  }
}
