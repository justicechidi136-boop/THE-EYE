import "package:flutter/material.dart";

import "../eye_semantic_colors.dart";
import "eye_primary_button.dart";
import "eye_text_field.dart";

class CancellationReasonOption {
  const CancellationReasonOption({
    required this.code,
    required this.label,
  });

  final String code;
  final String label;
}

const kCancellationReasonOptions = <CancellationReasonOption>[
  CancellationReasonOption(code: "EMERGENCY_RESOLVED", label: "Emergency resolved"),
  CancellationReasonOption(code: "REPORTED_BY_MISTAKE", label: "Reported by mistake"),
  CancellationReasonOption(code: "I_AM_SAFE_NOW", label: "I am safe now"),
  CancellationReasonOption(code: "HELP_NO_LONGER_NEEDED", label: "Help is no longer needed"),
  CancellationReasonOption(code: "OTHER", label: "Other"),
];

class CancellationReasonResult {
  const CancellationReasonResult({
    required this.reasonCode,
    this.reasonText,
  });

  final String reasonCode;
  final String? reasonText;

  String get auditedReason {
    final option = kCancellationReasonOptions.firstWhere(
      (item) => item.code == reasonCode,
      orElse: () => const CancellationReasonOption(code: "OTHER", label: "Other"),
    );
    if (reasonCode == "OTHER") {
      return "Other: ${reasonText!.trim()}";
    }
    return option.label;
  }
}

Future<CancellationReasonResult?> showCancellationReasonSheet(
  BuildContext context, {
  required String title,
  required String confirmLabel,
  String? helper,
}) {
  return showModalBottomSheet<CancellationReasonResult>(
    context: context,
    isScrollControlled: true,
    useSafeArea: true,
    builder: (context) => _CancellationReasonSheet(
      title: title,
      confirmLabel: confirmLabel,
      helper: helper,
    ),
  );
}

class _CancellationReasonSheet extends StatefulWidget {
  const _CancellationReasonSheet({
    required this.title,
    required this.confirmLabel,
    this.helper,
  });

  final String title;
  final String confirmLabel;
  final String? helper;

  @override
  State<_CancellationReasonSheet> createState() =>
      _CancellationReasonSheetState();
}

class _CancellationReasonSheetState extends State<_CancellationReasonSheet> {
  String? _selectedCode;
  final _otherController = TextEditingController();
  String? _error;

  @override
  void dispose() {
    _otherController.dispose();
    super.dispose();
  }

  void _submit() {
    if (_selectedCode == null) {
      setState(() =>
          _error = "Select a reason for cancelling this emergency.");
      return;
    }
    if (_selectedCode == "OTHER" && _otherController.text.trim().isEmpty) {
      setState(() => _error = "Please enter a reason.");
      return;
    }
    Navigator.of(context).pop(
      CancellationReasonResult(
        reasonCode: _selectedCode!,
        reasonText:
            _selectedCode == "OTHER" ? _otherController.text.trim() : null,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final bottomInset = MediaQuery.viewInsetsOf(context).bottom;
    final maxHeight = MediaQuery.sizeOf(context).height * 0.92;
    return Padding(
      padding: EdgeInsets.fromLTRB(16, 16, 16, 16 + bottomInset),
      child: ConstrainedBox(
        constraints: BoxConstraints(maxHeight: maxHeight),
        child: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                widget.title,
                style: Theme.of(context).textTheme.titleLarge?.copyWith(
                      fontWeight: FontWeight.w800,
                      color: semantics.bodyText,
                    ),
              ),
              const SizedBox(height: 8),
              Text(
                widget.helper ?? "Why are you cancelling this emergency?",
                style: TextStyle(color: semantics.secondaryText),
              ),
              const SizedBox(height: 16),
              ...kCancellationReasonOptions.map(
                (option) => RadioListTile<String>(
                  value: option.code,
                  groupValue: _selectedCode,
                  onChanged: (value) => setState(() {
                    _selectedCode = value;
                    _error = null;
                  }),
                  title: Text(option.label),
                  contentPadding: EdgeInsets.zero,
                ),
              ),
              if (_selectedCode == "OTHER") ...[
                const SizedBox(height: 8),
                EyeTextField(
                  label: "Please tell us why",
                  controller: _otherController,
                  hint: "Enter a short reason",
                  onChanged: (_) {
                    if (_error != null) setState(() => _error = null);
                  },
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 8),
                Semantics(
                  liveRegion: true,
                  label: _error!,
                  child: Text(
                    _error!,
                    style: TextStyle(
                      color: semantics.error,
                      fontWeight: FontWeight.w700,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 16),
              EyePrimaryButton(
                label: widget.confirmLabel,
                onPressed: _submit,
              ),
              TextButton(
                onPressed: () => Navigator.of(context).pop(),
                child: const Text("Back"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
