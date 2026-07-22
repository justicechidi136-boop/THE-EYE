import "package:flutter/material.dart";

import "../tokens.dart";
import "../typography.dart";

/// Back-arrow header used on Figma sub-pages (`719:3366`, `286:188`).
class EyePageBackHeader extends StatelessWidget {
  const EyePageBackHeader({
    this.title,
    this.onBack,
    super.key,
  });

  final String? title;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          IconButton(
            tooltip: "Back",
            onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            icon: const Icon(Icons.arrow_back,
                color: EyeTokens.greenMain, size: 24),
            padding: EdgeInsets.zero,
            constraints: const BoxConstraints(minWidth: 40, minHeight: 40),
          ),
          if (title != null) ...[
            const SizedBox(height: 2),
            Padding(
              padding: const EdgeInsets.only(left: 8),
              child: Text(title!, style: EyeTypography.authHeading),
            ),
          ],
        ],
      ),
    );
  }
}
