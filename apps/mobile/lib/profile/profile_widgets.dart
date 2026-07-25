import "package:flutter/material.dart";

import "../design_system/eye_input_theme.dart";
import "../design_system/eye_semantic_colors.dart";

class ProfileRow extends StatelessWidget {
  const ProfileRow(this.label, this.value, {super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(
            child: Text(
              label,
              style: TextStyle(color: semantics.secondaryText),
            ),
          ),
          Flexible(
            child: Text(
              value,
              textAlign: TextAlign.end,
              style: TextStyle(
                fontWeight: FontWeight.w800,
                color: semantics.bodyText,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

InputDecoration profileFieldDecoration({
  required BuildContext context,
  required String hintText,
  String? errorText,
}) {
  return EyeInputTheme.decoration(
    context,
    hintText: hintText,
    errorText: errorText,
  );
}

Widget profileLabeledField({
  required BuildContext context,
  required String label,
  required Widget field,
}) {
  return Column(
    crossAxisAlignment: CrossAxisAlignment.start,
    children: [
      Text(label, style: EyeInputTheme.labelStyle(context)),
      const SizedBox(height: 8),
      field,
      const SizedBox(height: 12),
    ],
  );
}
