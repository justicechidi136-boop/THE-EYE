import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";
import "active_emergency_tokens.dart";

/// Secondary-page header matching the Claude Active Emergency top bar.
///
/// Uses THE EYE semantic colors and circular icon buttons (reference layout)
/// while remaining a SafeArea secondary header (not a Material AppBar).
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
    return SafeArea(
      bottom: false,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(12, 10, 12, 4),
        child: Row(
          children: [
            ActiveEmergencyIconButton(
              icon: Icons.chevron_left,
              tooltip: "Back",
              onPressed: onBack ?? () => Navigator.of(context).maybePop(),
            ),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Semantics(
                    header: true,
                    child: Text(
                      title,
                      style: TextStyle(
                        color: colors.bodyText,
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        letterSpacing: -0.2,
                      ),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: TextStyle(
                      color: colors.mutedText,
                      fontSize: 12,
                      fontWeight: FontWeight.w500,
                    ),
                  ),
                ],
              ),
            ),
            ActiveEmergencyIconButton(
              icon: Icons.schedule,
              tooltip: "Refresh",
              onPressed: refreshEnabled ? onRefresh : null,
            ),
          ],
        ),
      ),
    );
  }
}
