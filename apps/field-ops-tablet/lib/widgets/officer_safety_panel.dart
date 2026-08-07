import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../api/field_api_client.dart';
import '../services/field_app_services.dart';
import '../services/field_offline_queue.dart';
import '../theme/field_theme.dart';

/// Panic / officer-down / distress controls with offline-safe queueing.
class OfficerSafetyPanel extends StatefulWidget {
  const OfficerSafetyPanel({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<OfficerSafetyPanel> createState() => _OfficerSafetyPanelState();
}

class _OfficerSafetyPanelState extends State<OfficerSafetyPanel> {
  bool _busy = false;
  String? _lastAlertId;

  Future<void> _trigger(String endpoint, String alertType) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.services.restoreSession();
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition();
      } on Object {
        // Best-known GPS optional.
      }
      final clientActionId = widget.services.offlineQueue.newClientActionId();
      final body = {
        'alertType': alertType,
        'clientActionId': clientActionId,
        if (position != null) ...{
          'latitude': position.latitude,
          'longitude': position.longitude,
        },
      };

      try {
        Map<String, dynamic> result;
        switch (endpoint) {
          case 'panic':
            result = await widget.services.workflows.triggerPanic(body);
            break;
          case 'officer-down':
            result = await widget.services.workflows.triggerOfficerDown(body);
            break;
          default:
            result = await widget.services.workflows.triggerDistress(body);
        }
        if (!mounted) return;
        setState(() => _lastAlertId = result['id']?.toString());
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Safety alert sent (${result['alertType']})')),
        );
      } on FieldApiException {
        await widget.services.offlineQueue.enqueue(
          type: FieldOfflineActionType.safety,
          clientActionId: clientActionId,
          payload: body,
        );
        if (!mounted) return;
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Safety alert queued — will sync when online')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Card(
      color: FieldColors.surfaceElevated,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'Officer safety',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            if (_lastAlertId != null) ...[
              const SizedBox(height: 8),
              Text('Last alert: $_lastAlertId'),
            ],
            const SizedBox(height: 12),
            ElevatedButton.icon(
              style: ElevatedButton.styleFrom(
                minimumSize: const Size.fromHeight(56),
                backgroundColor: FieldColors.danger,
                foregroundColor: FieldColors.white,
              ),
              onPressed: _busy
                  ? null
                  : () => _trigger('panic', 'Panic'),
              icon: const Icon(Icons.emergency),
              label: const Text('PANIC'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: _busy
                  ? null
                  : () => _trigger('officer-down', 'OfficerDown'),
              icon: const Icon(Icons.sos),
              label: const Text('Officer down'),
            ),
            const SizedBox(height: 8),
            OutlinedButton.icon(
              style: OutlinedButton.styleFrom(minimumSize: const Size.fromHeight(48)),
              onPressed: _busy
                  ? null
                  : () => _trigger('distress', 'DistressSignal'),
              icon: const Icon(Icons.warning_amber),
              label: const Text('Manual distress'),
            ),
          ],
        ),
      ),
    );
  }
}
