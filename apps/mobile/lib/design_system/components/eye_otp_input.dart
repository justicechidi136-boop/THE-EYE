import "package:flutter/material.dart";
import "package:flutter/services.dart";

import "../tokens.dart";
import "../typography.dart";

/// Six-box OTP input aligned to Figma node `133:238`.
class EyeOtpInput extends StatefulWidget {
  const EyeOtpInput({
    required this.controller,
    required this.length,
    this.errorText,
    this.onChanged,
    super.key,
  });

  final TextEditingController controller;
  final int length;
  final String? errorText;
  final ValueChanged<String>? onChanged;

  @override
  State<EyeOtpInput> createState() => _EyeOtpInputState();
}

class _EyeOtpInputState extends State<EyeOtpInput> {
  final _focusNode = FocusNode();

  @override
  void dispose() {
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final code = widget.controller.text;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        GestureDetector(
          onTap: () => _focusNode.requestFocus(),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: List.generate(widget.length, (index) {
              final char = index < code.length ? code[index] : "";
              final hasError = widget.errorText != null;
              return Padding(
                padding: EdgeInsets.only(left: index == 0 ? 0 : 8),
                child: AnimatedContainer(
                  duration: const Duration(milliseconds: 120),
                  width: 40,
                  height: 40,
                  alignment: Alignment.center,
                  decoration: BoxDecoration(
                    color: hasError ? const Color(0xFFFFE8E8) : EyeTokens.gray5,
                    borderRadius: BorderRadius.circular(EyeTokens.radiusSm),
                    border: hasError
                        ? Border.all(color: EyeTokens.danger, width: 1.5)
                        : null,
                  ),
                  child: Text(
                    char,
                    style: EyeTypography.fieldHint.copyWith(
                      color: EyeTokens.black1,
                      fontSize: 18,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              );
            }),
          ),
        ),
        SizedBox(
          height: 0,
          width: 0,
          child: TextField(
            controller: widget.controller,
            focusNode: _focusNode,
            keyboardType: TextInputType.number,
            autofillHints: const [AutofillHints.oneTimeCode],
            maxLength: widget.length,
            inputFormatters: [FilteringTextInputFormatter.digitsOnly],
            onChanged: widget.onChanged,
            decoration: const InputDecoration(
              counterText: "",
              border: InputBorder.none,
            ),
          ),
        ),
        if (widget.errorText != null) ...[
          const SizedBox(height: 8),
          Text(
            widget.errorText!,
            textAlign: TextAlign.center,
            style: const TextStyle(color: EyeTokens.danger, fontSize: 12),
          ),
        ],
      ],
    );
  }
}
