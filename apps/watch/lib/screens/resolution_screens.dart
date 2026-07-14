import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

/// Prototype Flow G — "Still active?" resolution prompt.
class StillActiveScreen extends StatelessWidget {
  const StillActiveScreen({super.key, this.incidentTitle = 'Armed Robbery'});

  final String incidentTitle;

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        children: [
          const SizedBox(height: EyeTokens.spaceMd),
          const WatchSectionTitle('Is this still active?'),
          const SizedBox(height: EyeTokens.spaceXs),
          Text(
            'You reported $incidentTitle 30 mins ago. Is the area still dangerous?',
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
          ),
          const Spacer(),
          WatchOutlineButton(
            label: 'Still Active',
            color: EyeTokens.danger,
            onPressed: () => Navigator.pop(context),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchPrimaryButton(
            label: "It's Cleared",
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.incidentResolved),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}

/// Prototype Flow G — community vote on incident resolution.
class CommunityVoteScreen extends StatelessWidget {
  const CommunityVoteScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        children: [
          const WatchSectionTitle('Is this area now safe?'),
          const SizedBox(height: EyeTokens.spaceXs),
          const Text(
            '⚠ Armed Robbery',
            textAlign: TextAlign.center,
            style: TextStyle(color: EyeTokens.green, fontSize: 10),
          ),
          const Spacer(),
          WatchOutlineButton(
            label: 'Still Active',
            color: EyeTokens.danger,
            onPressed: () => Navigator.pop(context),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
          WatchPrimaryButton(
            label: 'Mark Cleared',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.incidentResolved),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}

/// Prototype Flow G — resolved incident detail.
class IncidentResolvedScreen extends StatelessWidget {
  const IncidentResolvedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        children: [
          const Spacer(),
          Container(
            width: 56,
            height: 56,
            decoration: BoxDecoration(
              shape: BoxShape.circle,
              color: EyeTokens.green.withValues(alpha: 0.15),
              border: Border.all(color: EyeTokens.green, width: 2),
            ),
            child: const Icon(Icons.check, color: EyeTokens.green, size: 28),
          ),
          const SizedBox(height: EyeTokens.spaceMd),
          const Text('Area Cleared', style: EyeTokens.sectionTitle),
          const SizedBox(height: EyeTokens.spaceXs),
          const Text(
            'Incident resolved by community',
            textAlign: TextAlign.center,
            style: EyeTokens.bodySmall,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Back to Alerts',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.alertHistory),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}
