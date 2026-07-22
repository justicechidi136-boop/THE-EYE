import "package:flutter/material.dart";

abstract final class BrandColors {
  static const green = Color(0xFF009933);
  static const orange = Color(0xFFFF9933);
  static const accentHover = Color(0xFF0B7E5D);

  static const darkBackground = Color(0xFF0B0F14);
  static const darkSurface = Color(0xFF161B22);
  static const darkSurfaceMuted = Color(0xFF1E252D);
  static const darkText = Color(0xFFFFFFFF);
  static const darkTextMuted = Color(0xFFB8C2CC);
  static const darkBorder = Color(0xFF2C3440);

  static const lightBackground = Color(0xFFF1F7F6);
  static const lightSurface = Color(0xFFFFFFFF);
  static const lightSurfaceMuted = Color(0xFFE7EDF0);
  static const lightText = Color(0xFF172026);
  static const lightTextMuted = Color(0xFF5C6670);
  static const lightBorder = Color(0xFFD8DEE4);

  static const danger = Color(0xFFFF4D4F);
  static const success = Color(0xFF00C853);
  static const warning = Color(0xFFFFB300);
  static const info = Color(0xFF29B6F6);

  static const warningSurfaceLight = Color(0xFFFFF8E1);
  static const dangerSurfaceLight = Color(0xFFFFF1F0);
  static const command = Color(0xFF032221);
  static const commandSurface = Color(0xFF111820);
  static const stroke = darkBorder;
  static const field = darkBackground;
  static const authStroke = Color(0xFFAACBC4);
  static const ash = Color(0xFF797C7B);
  static const authInactive = Color(0xFFDAECE7);
}

abstract final class BrandAssets {
  static const logomark =
      "assets/images/brand/the-eye-logomark-transparent.png";
  static const lockupDarkBg =
      "assets/images/brand/the-eye-logo-lockup-dark-bg.png";
  static const officialIcon = "assets/images/brand/the-eye-official-icon.png";
  static const appIconWhite = "assets/images/brand/the-eye-app-icon-white.png";
  static const appIconDarkGreen =
      "assets/images/brand/the-eye-app-icon-dark-green.png";
  static const otpEmailSent = "assets/images/figma/otp-email-sent.png";
}
