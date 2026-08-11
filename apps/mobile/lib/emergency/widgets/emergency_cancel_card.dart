import "package:flutter/material.dart";

import "../../design_system/eye_semantic_colors.dart";

class EmergencyCancelCard extends StatelessWidget {
  const EmergencyCancelCard({
    super.key,
    required this.canCancel,
    required this.canRequestCancellation,
    this.busy = false,
    this.onCancel,
    this.onRequestCancellation,
  });

  final bool canCancel;
  final bool canRequestCancellation;
  final bool busy;
  final VoidCallback? onCancel;
  final VoidCallback? onRequestCancellation;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    if (!canCancel && !canRequestCancellation) {
      return const SizedBox.shrink();
    }

    final label = canCancel ? "Cancel report" : "Request cancellation";
    final action = canCancel ? onCancel : onRequestCancellation;

    return Semantics(
      button: true,
      label: label,
      child: Padding(
        padding: const EdgeInsets.fromLTRB(4, 4, 4, 8),
        child: Row(
          children: [
            Expanded(
              child: Text(
                "No longer an emergency?",
                style: TextStyle(
                  color: colors.mutedText,
                  fontSize: 12,
                ),
              ),
            ),
            TextButton(
              onPressed: busy ? null : action,
              style: TextButton.styleFrom(
                foregroundColor: colors.error,
                minimumSize: const Size(48, 48),
              ),
              child: Text(
                label,
                style: TextStyle(
                  color: colors.error,
                  fontSize: 12,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
