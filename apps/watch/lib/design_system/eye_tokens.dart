import 'package:flutter/material.dart';

/// THE EYE Wear OS design tokens aligned with brand + watch prototype.
abstract final class EyeTokens {
  // Brand palette
  static const green = Color(0xFF009933);
  static const logoGreen = Color(0xFF1A9C2D);
  static const orange = Color(0xFFFF9933);
  static const dark = Color(0xFF0B0F14);
  static const bootBlack = Color(0xFF000000);
  static const white = Color(0xFFFFFFFF);

  // Semantic
  static const muted = Color(0xFF8A9BA8);
  static const danger = Color(0xFFE53935);
  static const surface = Color(0xFF151B22);
  static const dangerGlow = Color(0x59EF4444);

  // Prototype-extracted (watch chrome)
  static const watchBackground = dark;
  static const watchFrameBorder = Color(0x33FFFFFF);
  static const safeAreaInsetRound = 8.0;
  static const safeAreaInsetSquare = 0.0;

  // Typography — Outfit-like scale for round displays
  static const fontFamily = 'Roboto';

  static const clockDisplay = TextStyle(
    color: white,
    fontSize: 32,
    fontWeight: FontWeight.w700,
    letterSpacing: -1,
    height: 1.2,
  );

  static const dateLabel = TextStyle(
    color: white,
    fontSize: 12,
    fontWeight: FontWeight.w500,
  );

  static const sectionTitle = TextStyle(
    color: white,
    fontSize: 14,
    fontWeight: FontWeight.w600,
  );

  static const bodySmall = TextStyle(
    color: muted,
    fontSize: 10,
    fontWeight: FontWeight.w500,
  );

  static const chipLabel = TextStyle(
    fontSize: 8,
    fontWeight: FontWeight.w700,
  );

  static const metricValue = TextStyle(
    color: green,
    fontSize: 14,
    fontWeight: FontWeight.w500,
  );

  static const metricCaption = TextStyle(
    color: white,
    fontSize: 7,
    fontWeight: FontWeight.w700,
    letterSpacing: 0.5,
  );

  static const sosCountdown = TextStyle(
    color: danger,
    fontSize: 40,
    fontWeight: FontWeight.w800,
    height: 0.9,
  );

  static const buttonLabel = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w700,
    letterSpacing: 1.2,
  );

  // Spacing
  static const spaceXs = 4.0;
  static const spaceSm = 8.0;
  static const spaceMd = 12.0;
  static const spaceLg = 16.0;

  // Component sizes
  static const sosButtonHome = 35.0;
  static const sosButtonLarge = 64.0;
  static const holdRingStroke = 3.0;
  static const topBarHeight = 28.0;

  // Motion (from prototype CSS)
  static const screenTransitionMs = 280;
  static const screenTransitionCurve = Cubic(0.22, 1, 0.36, 1);
  static const sosPulseMs = 1000;
  static const holdDurationMs = 3000;
  static const countdownSeconds = 3;

  static BorderRadius get pillRadius => BorderRadius.circular(999);
  static BorderRadius get cardRadius => BorderRadius.circular(8);
  static BorderRadius get panelRadius => BorderRadius.circular(12);
}
