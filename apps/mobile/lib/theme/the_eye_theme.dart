import "package:flutter/material.dart";

import "../brand.dart";

extension TheEyeTheme on BuildContext {
  bool get isDarkTheme => Theme.of(this).brightness == Brightness.dark;

  Color get eyeMutedText =>
      isDarkTheme ? BrandColors.darkTextMuted : BrandColors.lightTextMuted;

  Color get eyeBorder =>
      isDarkTheme ? BrandColors.darkBorder : BrandColors.lightBorder;

  Color get eyeSurfaceMuted => isDarkTheme
      ? BrandColors.darkSurfaceMuted
      : BrandColors.lightSurfaceMuted;

  Color get eyeSurface =>
      isDarkTheme ? BrandColors.darkSurface : BrandColors.lightSurface;

  Color get eyeWarningSurface => isDarkTheme
      ? BrandColors.warning.withValues(alpha: 0.18)
      : const Color(0xFFFFF8E1);

  Color get eyeDangerSurface => isDarkTheme
      ? BrandColors.danger.withValues(alpha: 0.18)
      : const Color(0xFFFFF1F0);

  Color get eyeCommandSurface =>
      isDarkTheme ? BrandColors.darkSurface : BrandColors.command;
}
