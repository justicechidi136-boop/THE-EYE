import 'package:flutter/material.dart';
import 'eye_colors.dart';
import 'eye_semantic_colors.dart';

ThemeData buildEyeWatchTheme() {
  const semantics = EyeSemanticColors.watch;
  const colorScheme = ColorScheme.dark(
    primary: EyeColors.green,
    secondary: EyeColors.orange,
    surface: EyeColors.surface,
    onPrimary: EyeColors.white,
    onSecondary: EyeColors.dark,
    onSurface: EyeColors.white,
    error: EyeColors.danger,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    // True black avoids white flash between native splash → boot → home.
    scaffoldBackgroundColor: const Color(0xFF000000),
    colorScheme: colorScheme,
    extensions: const [semantics],
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: EyeColors.white,
        fontSize: 22,
        fontWeight: FontWeight.w700,
      ),
      headlineMedium: TextStyle(
        color: EyeColors.white,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
      bodyMedium: TextStyle(color: EyeColors.white, fontSize: 14),
      bodySmall: TextStyle(color: EyeColors.muted, fontSize: 12),
      labelLarge: TextStyle(
        color: EyeColors.white,
        fontSize: 16,
        fontWeight: FontWeight.w600,
      ),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: EyeColors.green,
        foregroundColor: EyeColors.white,
        minimumSize: const Size.fromHeight(48),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: semantics.interactiveText,
        side: BorderSide(color: semantics.interactiveText),
        minimumSize: const Size.fromHeight(44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
    ),
  );
}
