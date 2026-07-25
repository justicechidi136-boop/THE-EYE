import "package:flutter/material.dart";

import "../eye_input_theme.dart";
import "../typography.dart";

class EyeTextField extends StatelessWidget {
  const EyeTextField({
    required this.label,
    required this.controller,
    this.hint,
    this.errorText,
    this.obscureText = false,
    this.keyboardType,
    this.textInputAction,
    this.autofillHints,
    this.onChanged,
    this.suffix,
    super.key,
  });

  final String label;
  final TextEditingController controller;
  final String? hint;
  final String? errorText;
  final bool obscureText;
  final TextInputType? keyboardType;
  final TextInputAction? textInputAction;
  final Iterable<String>? autofillHints;
  final ValueChanged<String>? onChanged;
  final Widget? suffix;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Text(label, style: EyeInputTheme.labelStyle(context)),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          onChanged: onChanged,
          style: EyeInputTheme.textStyle(context),
          cursorColor: EyeInputTheme.focusBorderColor(context),
          decoration: EyeInputTheme.decoration(
            context,
            hintText: hint,
            errorText: errorText,
            suffixIcon: suffix,
            radius: 8,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
          ),
        ),
      ],
    );
  }
}
