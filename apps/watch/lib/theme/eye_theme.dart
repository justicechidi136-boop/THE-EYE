import 'package:flutter/material.dart';
import 'eye_colors.dart';

ThemeData buildEyeWatchTheme() {
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
    scaffoldBackgroundColor: EyeColors.dark,
    colorScheme: colorScheme,
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
        foregroundColor: EyeColors.white,
        side: const BorderSide(color: EyeColors.muted),
        minimumSize: const Size.fromHeight(44),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(22)),
      ),
    ),
  );
}
