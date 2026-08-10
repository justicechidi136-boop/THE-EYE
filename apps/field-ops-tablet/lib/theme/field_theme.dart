import 'package:flutter/material.dart';

abstract final class FieldColors {
  static const orange = Color(0xFFFF9933);
  static const orangeDark = Color(0xFFCC7A29);
  static const dark = Color(0xFF0B0F14);
  static const surface = Color(0xFF151B22);
  static const surfaceElevated = Color(0xFF1E2630);
  static const white = Color(0xFFFFFFFF);
  static const muted = Color(0xFF8A9BA8);
  static const danger = Color(0xFFE53935);
  static const success = Color(0xFF009933);
}

ThemeData buildFieldTheme() {
  const colorScheme = ColorScheme.dark(
    primary: FieldColors.orange,
    secondary: FieldColors.orangeDark,
    surface: FieldColors.surface,
    onPrimary: FieldColors.dark,
    onSecondary: FieldColors.white,
    onSurface: FieldColors.white,
    error: FieldColors.danger,
  );

  return ThemeData(
    useMaterial3: true,
    brightness: Brightness.dark,
    scaffoldBackgroundColor: FieldColors.dark,
    colorScheme: colorScheme,
    navigationRailTheme: const NavigationRailThemeData(
      backgroundColor: FieldColors.surface,
      indicatorColor: FieldColors.orangeDark,
      selectedIconTheme: IconThemeData(color: FieldColors.orange, size: 30),
      unselectedIconTheme: IconThemeData(color: FieldColors.white, size: 28),
      selectedLabelTextStyle: TextStyle(
        color: FieldColors.orange,
        fontWeight: FontWeight.w700,
        fontSize: 15,
      ),
      unselectedLabelTextStyle: TextStyle(
        color: FieldColors.muted,
        fontSize: 14,
      ),
      minWidth: 96,
      minExtendedWidth: 200,
      groupAlignment: 0,
      useIndicator: true,
    ),
    textTheme: const TextTheme(
      headlineLarge: TextStyle(
        color: FieldColors.white,
        fontSize: 28,
        fontWeight: FontWeight.w700,
      ),
      headlineMedium: TextStyle(
        color: FieldColors.white,
        fontSize: 22,
        fontWeight: FontWeight.w600,
      ),
      bodyLarge: TextStyle(color: FieldColors.white, fontSize: 18),
      bodyMedium: TextStyle(color: FieldColors.white, fontSize: 16),
      bodySmall: TextStyle(color: FieldColors.muted, fontSize: 14),
      labelLarge: TextStyle(
        color: FieldColors.white,
        fontSize: 18,
        fontWeight: FontWeight.w600,
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      filled: true,
      fillColor: FieldColors.surfaceElevated,
      contentPadding: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
      border: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: BorderSide.none,
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(12),
        borderSide: const BorderSide(color: FieldColors.orange, width: 2),
      ),
      labelStyle: const TextStyle(color: FieldColors.muted, fontSize: 16),
    ),
    elevatedButtonTheme: ElevatedButtonThemeData(
      style: ElevatedButton.styleFrom(
        backgroundColor: FieldColors.orange,
        foregroundColor: FieldColors.dark,
        // Prefer a finite min width — Size.fromHeight(56) is infinite-width and
        // crashes Outlined/ElevatedButtons placed inside Rows (registration card).
        minimumSize: const Size(64, 56),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w700),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        foregroundColor: FieldColors.orange,
        side: const BorderSide(color: FieldColors.orange, width: 2),
        minimumSize: const Size(64, 56),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 16),
        textStyle: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    cardTheme: CardThemeData(
      color: FieldColors.surface,
      elevation: 0,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
    ),
  );
}
