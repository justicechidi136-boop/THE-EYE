import "package:flutter/material.dart";

import "../eye_semantic_colors.dart";
import "../tokens.dart";

/// High-contrast destructive control for critical stop/cancel actions.
class EyeDestructiveButton extends StatelessWidget {
  const EyeDestructiveButton({
    required this.label,
    required this.onPressed,
    this.icon = Icons.stop_circle_outlined,
    this.loading = false,
    this.enabled = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final IconData icon;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final isEnabled = enabled && !loading && onPressed != null;
    final background = isEnabled ? semantics.error : semantics.elevatedSurface;
    final foreground =
        isEnabled ? Colors.white : semantics.disabledText;
    final border = isEnabled
        ? BorderSide(color: Colors.white.withValues(alpha: 0.85), width: 1.5)
        : BorderSide(color: semantics.border);

    return Semantics(
      button: true,
      enabled: isEnabled,
      label: label,
      child: SizedBox(
        width: double.infinity,
        height: EyeTokens.buttonHeight.clamp(48, 64),
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: background,
            foregroundColor: foreground,
            disabledBackgroundColor: semantics.elevatedSurface,
            disabledForegroundColor: semantics.disabledText,
            side: border,
            minimumSize: const Size.fromHeight(48),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
            ),
          ),
          onPressed: isEnabled ? onPressed : null,
          icon: loading
              ? SizedBox(
                  width: 20,
                  height: 20,
                  child: CircularProgressIndicator(
                    strokeWidth: 2,
                    color: foreground,
                  ),
                )
              : Icon(icon),
          label: Text(
            label,
            style: TextStyle(
              fontWeight: FontWeight.w800,
              color: foreground,
            ),
          ),
        ),
      ),
    );
  }
}
