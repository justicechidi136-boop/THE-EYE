import 'package:flutter/foundation.dart';
import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../services/launcher_service.dart';
import '../widgets/watch_ui.dart';

/// Debug-only escape hatch — long-press logomark + PIN to reach system launcher.
class LauncherEscapeDialog extends StatefulWidget {
  const LauncherEscapeDialog({super.key, required this.launcher});

  final LauncherService launcher;

  static Future<void> maybeShow(
    BuildContext context, {
    required LauncherService launcher,
    required bool debugBuild,
  }) async {
    if (!debugBuild) return;
    await showDialog<void>(
      context: context,
      builder: (_) => LauncherEscapeDialog(launcher: launcher),
    );
  }

  @override
  State<LauncherEscapeDialog> createState() => _LauncherEscapeDialogState();
}

class _LauncherEscapeDialogState extends State<LauncherEscapeDialog> {
  final _pinController = TextEditingController();
  String? _error;

  /// Debug-only PIN — never compiled into release (guarded by isDebugBuild).
  static const _debugPin = '4242';

  @override
  void dispose() {
    _pinController.dispose();
    super.dispose();
  }

  void _verifyPin() {
    if (!kDebugMode) {
      Navigator.pop(context);
      return;
    }
    if (_pinController.text == _debugPin) {
      Navigator.pop(context);
      widget.launcher.openHomeSettings();
    } else {
      setState(() => _error = 'Incorrect PIN');
    }
  }

  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: EyeTokens.surface,
      title: const Text(
        'Developer escape',
        style: TextStyle(color: EyeTokens.white, fontSize: 14),
      ),
      content: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Enter dev PIN to open home app settings.',
            style: EyeTokens.bodySmall,
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          TextField(
            controller: _pinController,
            obscureText: true,
            keyboardType: TextInputType.number,
            style: const TextStyle(color: EyeTokens.white),
            decoration: InputDecoration(
              hintText: 'PIN',
              errorText: _error,
            ),
          ),
        ],
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context),
          child: const Text('Cancel'),
        ),
        WatchPrimaryButton(
          label: 'Unlock',
          onPressed: _verifyPin,
        ),
      ],
    );
  }
}
