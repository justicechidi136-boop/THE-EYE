import "package:flutter/material.dart";

import "../brand.dart";

/// Figma-derived design tokens for THE EYE mobile (node `0:1`).
abstract final class EyeTokens {
  // Colors — live Figma CSS vars from Sign In (`133:134`) and Home (`188:180`)
  static const whiteBg = Color(0xFFF1F7F6);
  static const greenMain = Color(0xFF0B7E5D);
  static const black1 = Color(0xFF032221);
  static const ash = Color(0xFF797C7B);
  static const stroke = Color(0xFFAACBC4);
  static const inactive = Color(0xFFDAECE7);
  static const gray5 = Color(0xFFE5E5EA);
  static const notificationCardBg = Color(0xFFE7F2EE);
  static const splashBackground = Color(0xFF443B40);
  static const heroOverlay = Color(0x66000000);

  static const primary = BrandColors.green;
  static const accent = BrandColors.orange;
  static const danger = BrandColors.danger;

  // Radii
  static const radiusSm = 8.0;
  static const radiusMd = 14.0;
  static const radiusLg = 18.0;
  static const radiusXl = 24.0;

  // Layout (iPhone 13 mini reference)
  static const screenWidth = 375.0;
  static const screenHeight = 812.0;
  static const pagePadding = 16.0;
  static const contentBottomClearance = 120.0;
  static const inputHeight = 44.0;
  static const buttonHeight = 51.0;
  static const sosButtonHeight = 64.0;
  static const cardGap = 12.0;
  static const heroHeight = 318.0;
  static const serviceCardHeight = 150.0;
  static const bottomNavHeight = 74.0;
  static const eyeFabSize = 60.0;
}
