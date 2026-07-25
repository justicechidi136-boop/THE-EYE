import "package:flutter/material.dart";

import "../design_system/eye_semantic_colors.dart";

/// Shared [ThemeData] extensions for THE EYE mobile light/dark themes.
abstract final class EyeThemeBuilder {
  static InputDecorationTheme inputDecoration(EyeSemanticColors semantics) {
    return InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      enabledBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: semantics.border),
      ),
      focusedBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: semantics.focusBorder, width: 2),
      ),
      filled: true,
      fillColor: semantics.inputFill,
      hintStyle: TextStyle(color: semantics.inputHint),
      labelStyle: TextStyle(color: semantics.inputLabel),
      errorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: semantics.error, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: BorderRadius.circular(14),
        borderSide: BorderSide(color: semantics.error, width: 2),
      ),
    );
  }

  static TextSelectionThemeData textSelection(EyeSemanticColors semantics) {
    return TextSelectionThemeData(
      cursorColor: semantics.focusBorder,
      selectionColor: semantics.focusBorder.withValues(alpha: 0.28),
      selectionHandleColor: semantics.focusBorder,
    );
  }

  static DialogThemeData dialog(EyeSemanticColors semantics) {
    return DialogThemeData(
      backgroundColor: semantics.surface,
      surfaceTintColor: Colors.transparent,
    );
  }

  static BottomSheetThemeData bottomSheet(EyeSemanticColors semantics) {
    return BottomSheetThemeData(
      backgroundColor: semantics.elevatedSurface,
      surfaceTintColor: Colors.transparent,
    );
  }

  static NavigationBarThemeData navigationBar(EyeSemanticColors semantics) {
    return NavigationBarThemeData(
      backgroundColor: semantics.surface,
      indicatorColor: semantics.focusBorder.withValues(alpha: 0.18),
      labelTextStyle: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return TextStyle(
          fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
          color: selected ? semantics.interactiveText : semantics.secondaryText,
        );
      }),
      iconTheme: WidgetStateProperty.resolveWith((states) {
        final selected = states.contains(WidgetState.selected);
        return IconThemeData(
          color: selected ? semantics.interactiveText : semantics.secondaryText,
        );
      }),
    );
  }
}
