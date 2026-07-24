import 'package:flutter/material.dart';

import '../design_system/eye_tokens.dart';
import 'eye_colors.dart';

@immutable
class EyeSemanticColors extends ThemeExtension<EyeSemanticColors> {
  const EyeSemanticColors({
    required this.primaryAction,
    required this.interactiveText,
    required this.linkText,
    required this.accentText,
    required this.success,
    required this.successText,
    required this.verified,
    required this.warning,
    required this.bodyText,
    required this.mutedText,
    required this.disabledText,
  });

  final Color primaryAction;
  final Color interactiveText;
  final Color linkText;
  final Color accentText;
  final Color success;
  final Color successText;
  final Color verified;
  final Color warning;
  final Color bodyText;
  final Color mutedText;
  final Color disabledText;

  static const watch = EyeSemanticColors(
    primaryAction: EyeColors.green,
    interactiveText: EyeTokens.orange,
    linkText: EyeTokens.orange,
    accentText: EyeTokens.orange,
    success: EyeColors.green,
    successText: EyeColors.white,
    verified: EyeColors.green,
    warning: EyeTokens.orange,
    bodyText: EyeColors.white,
    mutedText: EyeColors.muted,
    disabledText: EyeColors.muted,
  );

  static EyeSemanticColors of(BuildContext context) {
    return Theme.of(context).extension<EyeSemanticColors>() ?? watch;
  }

  @override
  EyeSemanticColors copyWith({
    Color? primaryAction,
    Color? interactiveText,
    Color? linkText,
    Color? accentText,
    Color? success,
    Color? successText,
    Color? verified,
    Color? warning,
    Color? bodyText,
    Color? mutedText,
    Color? disabledText,
  }) {
    return EyeSemanticColors(
      primaryAction: primaryAction ?? this.primaryAction,
      interactiveText: interactiveText ?? this.interactiveText,
      linkText: linkText ?? this.linkText,
      accentText: accentText ?? this.accentText,
      success: success ?? this.success,
      successText: successText ?? this.successText,
      verified: verified ?? this.verified,
      warning: warning ?? this.warning,
      bodyText: bodyText ?? this.bodyText,
      mutedText: mutedText ?? this.mutedText,
      disabledText: disabledText ?? this.disabledText,
    );
  }

  @override
  EyeSemanticColors lerp(ThemeExtension<EyeSemanticColors>? other, double t) {
    if (other is! EyeSemanticColors) return this;
    return copyWith(
      interactiveText: Color.lerp(interactiveText, other.interactiveText, t),
      linkText: Color.lerp(linkText, other.linkText, t),
    );
  }
}
