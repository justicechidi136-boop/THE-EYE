import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

/// Prototype Flow C — notification summary before list.
class NotificationSummaryScreen extends StatelessWidget {
  const NotificationSummaryScreen({
    super.key,
    required this.alertCount,
    this.onOpenList,
  });

  final int alertCount;
  final VoidCallback? onOpenList;

  @override
  Widget build(BuildContext context) {
    return WatchScaffold(
      child: Column(
        children: [
          const Spacer(),
          const WatchNotificationBadge(),
          const SizedBox(height: EyeTokens.spaceLg),
          Text(
            '$alertCount New Notifications',
            style: EyeTokens.sectionTitle,
          ),
          const SizedBox(height: EyeTokens.spaceXs),
          const Text(
            'SEE DETAILS',
            style: TextStyle(
              color: EyeTokens.green,
              fontSize: 12,
              fontWeight: FontWeight.w600,
              letterSpacing: 0.5,
            ),
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'View Alerts',
            onPressed: onOpenList ??
                () => Navigator.pushNamed(context, WatchRoutes.alertHistory),
          ),
          const SizedBox(height: EyeTokens.spaceSm),
        ],
      ),
    );
  }
}
