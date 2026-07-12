import "package:flutter/material.dart";

import "../tokens.dart";
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
        Text(label, style: EyeTypography.fieldLabel),
        const SizedBox(height: 8),
        TextField(
          controller: controller,
          obscureText: obscureText,
          keyboardType: keyboardType,
          textInputAction: textInputAction,
          autofillHints: autofillHints,
          onChanged: onChanged,
          style: EyeTypography.fieldHint.copyWith(color: EyeTokens.black1),
          decoration: InputDecoration(
            hintText: hint,
            hintStyle: EyeTypography.fieldHint,
            errorText: errorText,
            filled: true,
            fillColor: Colors.white,
            contentPadding:
                const EdgeInsets.symmetric(horizontal: 8, vertical: 12),
            suffixIcon: suffix,
            enabledBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
              borderSide: const BorderSide(color: EyeTokens.stroke),
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
              borderSide: const BorderSide(color: EyeTokens.greenMain, width: 2),
            ),
            errorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
              borderSide: const BorderSide(color: EyeTokens.danger, width: 2),
            ),
            focusedErrorBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
              borderSide: const BorderSide(color: EyeTokens.danger, width: 2),
            ),
          ),
        ),
      ],
    );
  }
}
