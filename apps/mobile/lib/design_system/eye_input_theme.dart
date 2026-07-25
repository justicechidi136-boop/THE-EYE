import "package:flutter/material.dart";

import "eye_semantic_colors.dart";

/// Centralized form field styling for THE EYE mobile.
abstract final class EyeInputTheme {
  static Color fillColor(BuildContext context) =>
      EyeSemanticColors.of(context).inputFill;

  static Color textColor(BuildContext context) =>
      EyeSemanticColors.of(context).inputText;

  static Color hintColor(BuildContext context) =>
      EyeSemanticColors.of(context).inputHint;

  static Color labelColor(BuildContext context) =>
      EyeSemanticColors.of(context).inputLabel;

  static Color borderColor(BuildContext context) =>
      EyeSemanticColors.of(context).border;

  static Color focusBorderColor(BuildContext context) =>
      EyeSemanticColors.of(context).focusBorder;

  static TextStyle textStyle(BuildContext context) => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w400,
        color: textColor(context),
      );

  static TextStyle labelStyle(BuildContext context) => TextStyle(
        fontSize: 16,
        fontWeight: FontWeight.w500,
        color: labelColor(context),
      );

  static TextStyle hintStyle(BuildContext context) => TextStyle(
        fontSize: 14,
        fontWeight: FontWeight.w400,
        color: hintColor(context),
      );

  static InputDecoration decoration(
    BuildContext context, {
    String? hintText,
    String? errorText,
    Widget? suffixIcon,
    EdgeInsetsGeometry? contentPadding,
    double radius = 8,
  }) {
    final borderRadius = BorderRadius.circular(radius);
    final enabled = OutlineInputBorder(
      borderRadius: borderRadius,
      borderSide: BorderSide(color: borderColor(context), width: 1),
    );
    return InputDecoration(
      hintText: hintText,
      hintStyle: hintStyle(context),
      errorText: errorText,
      filled: true,
      fillColor: fillColor(context),
      contentPadding: contentPadding ??
          const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
      suffixIcon: suffixIcon,
      border: enabled,
      enabledBorder: enabled,
      focusedBorder: OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide: BorderSide(color: focusBorderColor(context), width: 2),
      ),
      errorBorder: OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide:
            BorderSide(color: EyeSemanticColors.of(context).error, width: 2),
      ),
      focusedErrorBorder: OutlineInputBorder(
        borderRadius: borderRadius,
        borderSide:
            BorderSide(color: EyeSemanticColors.of(context).error, width: 2),
      ),
    );
  }
}
