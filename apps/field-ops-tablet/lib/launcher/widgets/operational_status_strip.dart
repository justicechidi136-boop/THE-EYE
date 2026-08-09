import 'package:flutter/material.dart';

/// Large vehicle-mount friendly status strip (does not overlap system bars).
class OperationalStatusStrip extends StatelessWidget {
  const OperationalStatusStrip({
    super.key,
    required this.gpsLabel,
    required this.networkLabel,
    required this.batteryLabel,
    required this.syncLabel,
    required this.shiftLabel,
    required this.modeLabel,
    required this.assignmentLabel,
    required this.unreadAlerts,
  });

  final String gpsLabel;
  final String networkLabel;
  final String batteryLabel;
  final String syncLabel;
  final String shiftLabel;
  final String modeLabel;
  final String assignmentLabel;
  final int unreadAlerts;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Material(
      color: const Color(0xFF0F1B2D),
      child: SafeArea(
        bottom: false,
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          child: Wrap(
            spacing: 12,
            runSpacing: 8,
            crossAxisAlignment: WrapCrossAlignment.center,
            children: [
              _chip(Icons.gps_fixed, 'GPS', gpsLabel, theme),
              _chip(Icons.network_cell, 'NET', networkLabel, theme),
              _chip(Icons.battery_full, 'BAT', batteryLabel, theme),
              _chip(Icons.sync, 'SYNC', syncLabel, theme),
              _chip(Icons.schedule, 'SHIFT', shiftLabel, theme),
              _chip(Icons.badge, 'MODE', modeLabel, theme),
              _chip(Icons.assignment, 'TASK', assignmentLabel, theme),
              _chip(
                Icons.notifications_active,
                'ALERTS',
                unreadAlerts > 0 ? '$unreadAlerts' : '0',
                theme,
                emphasize: unreadAlerts > 0,
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _chip(
    IconData icon,
    String title,
    String value,
    ThemeData theme, {
    bool emphasize = false,
  }) {
    return Container(
      constraints: const BoxConstraints(minWidth: 110, minHeight: 56),
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: emphasize ? const Color(0xFF7A1F1F) : const Color(0xFF1A2A40),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: const Color(0xFF314861)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 22, color: emphasize ? Colors.amber : Colors.white70),
          const SizedBox(width: 8),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisSize: MainAxisSize.min,
            children: [
              Text(
                title,
                style: theme.textTheme.labelSmall?.copyWith(
                  color: Colors.white54,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 0.6,
                ),
              ),
              Text(
                value,
                style: theme.textTheme.titleSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
