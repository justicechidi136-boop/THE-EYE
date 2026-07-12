import "package:flutter/material.dart";

import "../tokens.dart";
import "../typography.dart";

class EyePrimaryButton extends StatelessWidget {
  const EyePrimaryButton({
    required this.label,
    required this.onPressed,
    this.loading = false,
    this.enabled = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final active = enabled && !loading && onPressed != null;
    return SizedBox(
      width: double.infinity,
      height: EyeTokens.buttonHeight,
      child: FilledButton(
        style: FilledButton.styleFrom(
          backgroundColor: active ? EyeTokens.greenMain : EyeTokens.inactive,
          foregroundColor: Colors.white,
          disabledBackgroundColor: EyeTokens.inactive,
          disabledForegroundColor: Colors.white,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
          ),
          elevation: 0,
        ),
        onPressed: active ? onPressed : null,
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(
                  strokeWidth: 2,
                  color: Colors.white,
                ),
              )
            : Text(
                label,
                style: EyeTypography.fieldHint.copyWith(color: Colors.white),
              ),
      ),
    );
  }
}

class EyeOutlinedButton extends StatelessWidget {
  const EyeOutlinedButton({
    required this.label,
    required this.onPressed,
    this.icon,
    this.loading = false,
    this.enabled = true,
    super.key,
  });

  final String label;
  final VoidCallback? onPressed;
  final Widget? icon;
  final bool loading;
  final bool enabled;

  @override
  Widget build(BuildContext context) {
    final active = enabled && !loading && onPressed != null;
    return SizedBox(
      width: double.infinity,
      height: 54,
      child: OutlinedButton(
        style: OutlinedButton.styleFrom(
          foregroundColor: EyeTokens.greenMain,
          side: const BorderSide(color: EyeTokens.greenMain),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
          ),
        ),
        onPressed: active ? onPressed : null,
        child: loading
            ? const SizedBox(
                width: 22,
                height: 22,
                child: CircularProgressIndicator(strokeWidth: 2),
              )
            : Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  if (icon != null) ...[icon!, const SizedBox(width: 8)],
                  Text(
                    label,
                    style: EyeTypography.fieldHint
                        .copyWith(color: EyeTokens.greenMain),
                  ),
                ],
              ),
      ),
    );
  }
}
