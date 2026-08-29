import "package:flutter/material.dart";

import "../../design_system/components/eye_page_header.dart";
import "../../design_system/eye_semantic_colors.dart";

/// Active Emergency header built on the canonical secondary-page header.
class ActiveEmergencyHeader extends StatelessWidget {
  const ActiveEmergencyHeader({
    super.key,
    required this.title,
    this.subtitle = "Help is on the way",
    this.onBack,
    this.onRefresh,
    this.refreshEnabled = true,
  });

  final String title;
  final String subtitle;
  final VoidCallback? onBack;
  final VoidCallback? onRefresh;
  final bool refreshEnabled;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        EyePageHeader.secondary(
          title: title,
          onBack: onBack,
          actions: [
            IconButton(
              tooltip: "Refresh",
              onPressed: refreshEnabled ? onRefresh : null,
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        Padding(
          padding: const EdgeInsets.fromLTRB(56, 0, 56, 8),
          child: Text(
            subtitle,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: TextStyle(
              color: colors.mutedText,
              fontSize: 12,
              fontWeight: FontWeight.w500,
            ),
          ),
        ),
      ],
    );
  }
}
