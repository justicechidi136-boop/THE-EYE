import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../services/launcher_service.dart';
import '../widgets/watch_ui.dart';

/// Consumer onboarding — prompts user to set THE EYE as default home app.
class DefaultHomeOnboardingScreen extends StatefulWidget {
  const DefaultHomeOnboardingScreen({
    super.key,
    required this.launcher,
    required this.onComplete,
    this.onDismiss,
  });

  final LauncherService launcher;
  final VoidCallback onComplete;
  final Future<void> Function()? onDismiss;

  @override
  State<DefaultHomeOnboardingScreen> createState() =>
      _DefaultHomeOnboardingScreenState();
}

class _DefaultHomeOnboardingScreenState
    extends State<DefaultHomeOnboardingScreen> {
  bool _checking = true;
  bool _isDefault = false;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    final isDefault = await widget.launcher.isDefaultHome();
    if (!mounted) return;
    setState(() {
      _checking = false;
      _isDefault = isDefault;
    });
    if (isDefault) widget.onComplete();
  }

  @override
  Widget build(BuildContext context) {
    if (_checking) {
      return const WatchScaffold(
        enableBack: false,
        leadingLabel: 'THE EYE',
        child: Center(
          child: SizedBox(
            width: 24,
            height: 24,
            child: CircularProgressIndicator(
              color: EyeTokens.green,
              strokeWidth: 2,
            ),
          ),
        ),
      );
    }

    if (_isDefault) {
      return const SizedBox.shrink();
    }

    return WatchScaffold(
      enableBack: false,
      leadingLabel: 'THE EYE',
      child: Column(
        children: [
          const Spacer(),
          const WatchLogomark(size: 56),
          const SizedBox(height: EyeTokens.spaceMd),
          const WatchSectionTitle('Set as default home'),
          const SizedBox(height: EyeTokens.spaceSm),
          const Text(
            'Choose THE EYE as your watch face home app. You can switch back anytime in Settings.',
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Set as default home',
            onPressed: () async {
              await widget.launcher.requestDefaultHome();
              await _refresh();
            },
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchOutlineButton(
            label: 'Not now',
            onPressed: () async {
              await widget.onDismiss?.call();
              widget.onComplete();
            },
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchOutlineButton(
            label: 'Open home settings',
            onPressed: widget.launcher.openHomeSettings,
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}
