import "package:flutter/material.dart";

import "../brand.dart";

/// Typed semantic colors for THE EYE mobile. Feature widgets should prefer
/// [EyeSemanticColors.of] over direct brand constants for text and actions.
@immutable
class EyeSemanticColors extends ThemeExtension<EyeSemanticColors> {
  const EyeSemanticColors({
    required this.primaryAction,
    required this.primaryActionForeground,
    required this.secondaryAction,
    required this.interactiveText,
    required this.linkText,
    required this.accentText,
    required this.success,
    required this.successText,
    required this.verified,
    required this.warning,
    required this.warningText,
    required this.error,
    required this.errorText,
    required this.information,
    required this.bodyText,
    required this.secondaryText,
    required this.mutedText,
    required this.textOnPrimary,
    required this.textOnDarkSurface,
    required this.surface,
    required this.elevatedSurface,
    required this.cardSurface,
    required this.divider,
    required this.disabledText,
  });

  final Color primaryAction;
  final Color primaryActionForeground;
  final Color secondaryAction;
  final Color interactiveText;
  final Color linkText;
  final Color accentText;
  final Color success;
  final Color successText;
  final Color verified;
  final Color warning;
  final Color warningText;
  final Color error;
  final Color errorText;
  final Color information;
  final Color bodyText;
  final Color secondaryText;
  final Color mutedText;
  final Color textOnPrimary;
  final Color textOnDarkSurface;
  final Color surface;
  final Color elevatedSurface;
  final Color cardSurface;
  final Color divider;
  final Color disabledText;

  static const light = EyeSemanticColors(
    primaryAction: BrandColors.green,
    primaryActionForeground: Colors.white,
    secondaryAction: BrandColors.orange,
    interactiveText: BrandColors.accentHover,
    linkText: BrandColors.accentHover,
    accentText: BrandColors.orange,
    success: BrandColors.success,
    successText: BrandColors.lightText,
    verified: BrandColors.green,
    warning: BrandColors.warning,
    warningText: BrandColors.lightText,
    error: BrandColors.danger,
    errorText: BrandColors.danger,
    information: BrandColors.info,
    bodyText: BrandColors.lightText,
    secondaryText: BrandColors.lightTextMuted,
    mutedText: BrandColors.lightTextMuted,
    textOnPrimary: Colors.white,
    textOnDarkSurface: BrandColors.darkText,
    surface: BrandColors.lightSurface,
    elevatedSurface: BrandColors.lightSurfaceMuted,
    cardSurface: BrandColors.lightSurface,
    divider: BrandColors.lightBorder,
    disabledText: BrandColors.ash,
  );

  static const dark = EyeSemanticColors(
    primaryAction: BrandColors.orange,
    primaryActionForeground: BrandColors.darkBackground,
    secondaryAction: BrandColors.orange,
    interactiveText: BrandColors.orange,
    linkText: BrandColors.orange,
    accentText: BrandColors.orange,
    success: BrandColors.success,
    successText: BrandColors.darkText,
    verified: BrandColors.green,
    warning: BrandColors.orange,
    warningText: BrandColors.darkText,
    error: BrandColors.danger,
    errorText: BrandColors.danger,
    information: BrandColors.info,
    bodyText: BrandColors.darkText,
    secondaryText: BrandColors.darkTextMuted,
    mutedText: BrandColors.darkTextMuted,
    textOnPrimary: BrandColors.darkBackground,
    textOnDarkSurface: BrandColors.darkText,
    surface: BrandColors.darkSurface,
    elevatedSurface: BrandColors.darkSurfaceMuted,
    cardSurface: BrandColors.darkSurface,
    divider: BrandColors.darkBorder,
    disabledText: BrandColors.darkTextMuted,
  );

  static EyeSemanticColors of(BuildContext context) {
    final extension = Theme.of(context).extension<EyeSemanticColors>();
    return extension ??
        (Theme.of(context).brightness == Brightness.dark ? dark : light);
  }

  /// Interactive navigation labels and tappable text.
  static Color interactive(BuildContext context) => of(context).interactiveText;

  /// Auth links, "Forgot password?", pairing labels, etc.
  static Color link(BuildContext context) => of(context).linkText;

  /// Icons/borders for positive status; readable label text in dark mode.
  static Color statusLabel(
    BuildContext context, {
    required bool positive,
  }) {
    final semantics = of(context);
    if (!positive) {
      return semantics.warning;
    }
    return Theme.of(context).brightness == Brightness.dark
        ? semantics.successText
        : semantics.success;
  }

  /// Badge/chip foreground for verification states.
  static Color verificationLabel(BuildContext context, String status) {
    final semantics = of(context);
    switch (status) {
      case "Verified":
        return Theme.of(context).brightness == Brightness.dark
            ? semantics.successText
            : semantics.verified;
      case "Disputed":
        return semantics.warning;
      case "False Information":
        return semantics.error;
      default:
        return semantics.mutedText;
    }
  }

  static Color verificationTint(BuildContext context, String status) {
    final semantics = of(context);
    switch (status) {
      case "Verified":
        return semantics.verified;
      case "Disputed":
        return semantics.warning;
      case "False Information":
        return semantics.error;
      default:
        return semantics.mutedText;
    }
  }

  /// Selected pairing-mode accent (green in light, orange in dark).
  static Color pairingModeAccent(
    BuildContext context, {
    required bool standalone,
  }) {
    final semantics = of(context);
    if (Theme.of(context).brightness == Brightness.dark) {
      return semantics.interactiveText;
    }
    return standalone ? semantics.accentText : semantics.verified;
  }

  @override
  EyeSemanticColors copyWith({
    Color? primaryAction,
    Color? primaryActionForeground,
    Color? secondaryAction,
    Color? interactiveText,
    Color? linkText,
    Color? accentText,
    Color? success,
    Color? successText,
    Color? verified,
    Color? warning,
    Color? warningText,
    Color? error,
    Color? errorText,
    Color? information,
    Color? bodyText,
    Color? secondaryText,
    Color? mutedText,
    Color? textOnPrimary,
    Color? textOnDarkSurface,
    Color? surface,
    Color? elevatedSurface,
    Color? cardSurface,
    Color? divider,
    Color? disabledText,
  }) {
    return EyeSemanticColors(
      primaryAction: primaryAction ?? this.primaryAction,
      primaryActionForeground:
          primaryActionForeground ?? this.primaryActionForeground,
      secondaryAction: secondaryAction ?? this.secondaryAction,
      interactiveText: interactiveText ?? this.interactiveText,
      linkText: linkText ?? this.linkText,
      accentText: accentText ?? this.accentText,
      success: success ?? this.success,
      successText: successText ?? this.successText,
      verified: verified ?? this.verified,
      warning: warning ?? this.warning,
      warningText: warningText ?? this.warningText,
      error: error ?? this.error,
      errorText: errorText ?? this.errorText,
      information: information ?? this.information,
      bodyText: bodyText ?? this.bodyText,
      secondaryText: secondaryText ?? this.secondaryText,
      mutedText: mutedText ?? this.mutedText,
      textOnPrimary: textOnPrimary ?? this.textOnPrimary,
      textOnDarkSurface: textOnDarkSurface ?? this.textOnDarkSurface,
      surface: surface ?? this.surface,
      elevatedSurface: elevatedSurface ?? this.elevatedSurface,
      cardSurface: cardSurface ?? this.cardSurface,
      divider: divider ?? this.divider,
      disabledText: disabledText ?? this.disabledText,
    );
  }

  @override
  EyeSemanticColors lerp(ThemeExtension<EyeSemanticColors>? other, double t) {
    if (other is! EyeSemanticColors) return this;
    return copyWith(
      primaryAction: Color.lerp(primaryAction, other.primaryAction, t)!,
      interactiveText: Color.lerp(interactiveText, other.interactiveText, t)!,
      linkText: Color.lerp(linkText, other.linkText, t)!,
    );
  }
}
