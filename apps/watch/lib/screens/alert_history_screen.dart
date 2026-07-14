import 'package:flutter/material.dart';

import '../models/alert.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class AlertHistoryScreen extends StatefulWidget {
  const AlertHistoryScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  State<AlertHistoryScreen> createState() => _AlertHistoryScreenState();
}

class _AlertHistoryScreenState extends State<AlertHistoryScreen> {
  late Future<List<WatchAlert>> _alerts;

  @override
  void initState() {
    super.initState();
    _alerts = widget.services.alerts.loadHistory();
  }

  @override
  Widget build(BuildContext context) {
    return WatchScreenShell(
      child: FutureBuilder<List<WatchAlert>>(
        future: _alerts,
        builder: (context, snapshot) {
          final alerts = snapshot.data ?? [];
          if (alerts.isEmpty) {
            return const Center(
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  WatchNotificationBadge(size: 60),
                  SizedBox(height: 12),
                  Text(
                    'No alerts yet',
                    style: TextStyle(color: EyeColors.muted, fontSize: 12),
                  ),
                ],
              ),
            );
          }

          return Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                '${alerts.length} New Notifications',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EyeColors.white,
                  fontSize: 14,
                ),
              ),
              const SizedBox(height: 4),
              const Text(
                'SEE DETAILS →',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EyeColors.green,
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  letterSpacing: 0.5,
                ),
              ),
              const SizedBox(height: 10),
              Expanded(
                child: ListView.separated(
                  itemCount: alerts.length,
                  separatorBuilder: (_, __) => const SizedBox(height: 6),
                  itemBuilder: (context, index) {
                    final alert = alerts[index];
                    return WatchAlertCard(
                      title: alert.title,
                      subtitle: alert.body,
                      onTap: () => Navigator.pushNamed(
                        context,
                        WatchRoutes.incomingAlert,
                        arguments: alert,
                      ),
                      onLongPress: () => Navigator.pushNamed(
                        context,
                        WatchRoutes.stillActive,
                        arguments: alert.title,
                      ),
                    );
                  },
                ),
              ),
            ],
          );
        },
      ),
    );
  }
}
