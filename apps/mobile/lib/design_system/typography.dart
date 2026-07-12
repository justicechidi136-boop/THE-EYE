import "package:flutter/material.dart";
import "package:google_fonts/google_fonts.dart";

import "tokens.dart";

/// Montserrat text styles mapped from Figma Biennale scale.
abstract final class EyeTypography {
  static TextTheme montserratTextTheme(TextTheme base) {
    final montserrat = GoogleFonts.montserratTextTheme(base);
    return montserrat.copyWith(
      headlineLarge: montserrat.headlineLarge?.copyWith(
        fontSize: 32,
        fontWeight: FontWeight.w700,
        color: EyeTokens.black1,
      ),
      headlineSmall: montserrat.headlineSmall?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: EyeTokens.black1,
      ),
      titleLarge: montserrat.titleLarge?.copyWith(
        fontSize: 24,
        fontWeight: FontWeight.w600,
        color: EyeTokens.black1,
      ),
      titleMedium: montserrat.titleMedium?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w600,
        color: EyeTokens.black1,
      ),
      bodyLarge: montserrat.bodyLarge?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: EyeTokens.ash,
      ),
      bodyMedium: montserrat.bodyMedium?.copyWith(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: EyeTokens.ash,
      ),
      labelLarge: montserrat.labelLarge?.copyWith(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: EyeTokens.black1,
      ),
      labelSmall: montserrat.labelSmall?.copyWith(
        fontSize: 12,
        fontWeight: FontWeight.w500,
        color: EyeTokens.black1,
      ),
    );
  }

  static String? fontFamily() => GoogleFonts.montserrat().fontFamily;

  static const splashTitle = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  static const splashCaution = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: Colors.white,
    letterSpacing: 0.5,
  );

  static const splashTagline = TextStyle(
    fontSize: 18,
    fontWeight: FontWeight.w500,
    color: Colors.white,
  );

  static const authHeading = TextStyle(
    fontSize: 24,
    fontWeight: FontWeight.w600,
    color: EyeTokens.black1,
  );

  static const authSubheading = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w400,
    color: EyeTokens.ash,
  );

  static const fieldLabel = TextStyle(
    fontSize: 16,
    fontWeight: FontWeight.w500,
    color: EyeTokens.black1,
  );

  static const fieldHint = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: EyeTokens.ash,
  );

  static const link = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w400,
    color: EyeTokens.greenMain,
  );

  static const heroTitle = TextStyle(
    fontSize: 32,
    fontWeight: FontWeight.w700,
    color: Colors.white,
  );

  static const heroSubtitle = TextStyle(
    fontSize: 14,
    fontWeight: FontWeight.w500,
    color: Color(0xFFD9D9D9),
  );

  static const serviceTitle = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w500,
    color: EyeTokens.black1,
  );

  static const serviceDescription = TextStyle(
    fontSize: 10,
    fontWeight: FontWeight.w400,
    color: EyeTokens.ash,
    height: 1.3,
  );

  static const navLabelActive = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: EyeTokens.greenMain,
  );

  static const navLabel = TextStyle(
    fontSize: 12,
    fontWeight: FontWeight.w400,
    color: EyeTokens.black1,
  );
}
