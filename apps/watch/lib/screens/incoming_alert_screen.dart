import 'package:flutter/material.dart';

import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

class IncomingAlertScreen extends StatelessWidget {
  const IncomingAlertScreen({
    super.key,
    required this.services,
    this.title = 'Emergency Alert',
    this.body = 'A critical alert was sent to your watch.',
    this.alertId,
  });

  final WatchAppServices services;
  final String title;
  final String body;
  final String? alertId;

  @override
  Widget build(BuildContext context) {
    return WatchScreenShell(
      child: Column(
        children: [
          const Spacer(),
          const WatchNotificationBadge(),
          const SizedBox(height: 16),
          Text(
            title,
            textAlign: TextAlign.center,
            style: const TextStyle(
              color: EyeColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 6),
          Text(
            body,
            textAlign: TextAlign.center,
            style: const TextStyle(color: EyeColors.muted, fontSize: 11),
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Acknowledge',
            onPressed: () async {
              if (alertId != null) {
                await services.alerts.acknowledge(alertId!);
              }
              if (context.mounted) Navigator.pop(context);
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }
}
