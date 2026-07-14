import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../services/watch_app_services.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

/// Prototype Flow A — location permission onboarding.
class LocationOnboardingScreen extends StatelessWidget {
  const LocationOnboardingScreen({super.key, required this.services});

  final WatchAppServices services;

  Future<void> _continue(BuildContext context) async {
    final granted = await services.location.requestPermission();
    if (!context.mounted) return;
    if (granted) {
      Navigator.pushReplacementNamed(context, WatchRoutes.home);
    } else {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Location needed for SOS & alerts')),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      enableBack: false,
      leadingLabel: 'THE EYE',
      child: Column(
        children: [
          const Spacer(),
          const WatchLogomark(size: 56),
          const SizedBox(height: EyeTokens.spaceMd),
          const Text('Community Safety', style: EyeTokens.sectionTitle),
          const SizedBox(height: EyeTokens.spaceSm),
          const Text(
            'Enable location for area alerts and emergency GPS.',
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Allow Location',
            onPressed: () => _continue(context),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchOutlineButton(
            label: 'Skip for now',
            onPressed: () =>
                Navigator.pushReplacementNamed(context, WatchRoutes.home),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}
