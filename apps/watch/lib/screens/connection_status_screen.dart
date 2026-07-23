import 'package:flutter/material.dart';

import '../models/connectivity_mode.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

class ConnectionStatusScreen extends StatelessWidget {
  const ConnectionStatusScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  Widget build(BuildContext context) {
    final mode = services.connectivity.activeMode;
    return WatchScreenShell(
      child: Column(
        children: [
          Icon(_iconForMode(mode), color: _colorForMode(mode), size: 40),
          const SizedBox(height: 8),
          Text(
            _labelForMode(mode),
            style: const TextStyle(
              color: EyeColors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(height: 12),
          _StatusRow(
            label: 'Phone paired',
            value: services.connectivity.pairedPhoneAvailable,
          ),
          _StatusRow(
            label: 'Wi-Fi',
            value: services.connectivity.wifiAvailable,
          ),
          _StatusRow(
            label: 'LTE',
            value: services.connectivity.lteAvailable,
          ),
          _StatusRow(
            label: 'Internet',
            value: services.connectivity.internetAvailable,
          ),
          _StatusRow(
            label: 'Failover',
            value: services.connectivity.failoverEnabled,
          ),
          _StatusRow(
            label: 'Phone relay',
            value: false,
          ),
          const Padding(
            padding: EdgeInsets.symmetric(horizontal: 8),
            child: Text(
              'Paired Wear Data Layer relay is deferred for Sprint 7. '
              'Standalone HTTPS is active for staging.',
              textAlign: TextAlign.center,
              style: TextStyle(color: EyeColors.muted, fontSize: 9),
            ),
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Flush Offline Queue',
            onPressed: () async {
              final count = await services.sos.flushOfflineQueue();
              if (!context.mounted) return;
              ScaffoldMessenger.of(context).showSnackBar(
                SnackBar(content: Text('Uploaded $count queued events')),
              );
            },
          ),
          const SizedBox(height: 8),
        ],
      ),
    );
  }

  static IconData _iconForMode(WatchConnectivityMode mode) {
    return switch (mode) {
      WatchConnectivityMode.pairedPhone => Icons.bluetooth_connected,
      WatchConnectivityMode.standaloneCellular => Icons.signal_cellular_alt,
      WatchConnectivityMode.offline => Icons.cloud_off,
    };
  }

  static Color _colorForMode(WatchConnectivityMode mode) {
    return switch (mode) {
      WatchConnectivityMode.pairedPhone => EyeColors.green,
      WatchConnectivityMode.standaloneCellular => EyeColors.orange,
      WatchConnectivityMode.offline => EyeColors.danger,
    };
  }

  static String _labelForMode(WatchConnectivityMode mode) => mode.apiValue;
}

class _StatusRow extends StatelessWidget {
  const _StatusRow({required this.label, required this.value});

  final String label;
  final bool value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 4),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 11)),
          Icon(
            value ? Icons.check_circle : Icons.cancel,
            color: value ? EyeColors.green : EyeColors.muted,
            size: 16,
          ),
        ],
      ),
    );
  }
}
