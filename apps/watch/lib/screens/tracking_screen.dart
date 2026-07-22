import 'dart:async';

import 'package:flutter/material.dart';

import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

class TrackingScreen extends StatefulWidget {
  const TrackingScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  State<TrackingScreen> createState() => _TrackingScreenState();
}

class _TrackingScreenState extends State<TrackingScreen> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(widget.services.sos.syncEmergencyTracking());
    });
    unawaited(widget.services.sos.syncEmergencyTracking());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder(
      stream: widget.services.sos.states,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final state = widget.services.sos.state;
        return WatchScreenShell(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const WatchSectionTitle('Live Tracking'),
              Container(
                height: 72,
                decoration: BoxDecoration(
                  color: EyeColors.surface,
                  borderRadius: BorderRadius.circular(12),
                  border:
                      Border.all(color: EyeColors.green.withValues(alpha: 0.3)),
                ),
                child: const Center(
                  child: Icon(Icons.map, color: EyeColors.green, size: 36),
                ),
              ),
              const SizedBox(height: 10),
              Text(
                'GPS updates every 5s',
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 8),
              WatchInfoRow(
                label: 'Latitude',
                value: state.latitude?.toStringAsFixed(5) ?? '—',
              ),
              WatchInfoRow(
                label: 'Longitude',
                value: state.longitude?.toStringAsFixed(5) ?? '—',
              ),
              WatchInfoRow(
                label: 'SOS Event',
                value: state.sosEventId ?? 'Pending',
              ),
              WatchInfoRow(
                label: 'Incident',
                value: state.incidentId ?? 'Pending',
              ),
              const Spacer(),
              WatchPrimaryButton(
                label: 'Refresh Location',
                onPressed: () async {
                  await widget.services.sos.syncEmergencyTracking();
                  final position =
                      await widget.services.location.getCurrentPosition();
                  if (position != null && context.mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text(
                          'Lat ${position.latitude.toStringAsFixed(4)}, '
                          'Lng ${position.longitude.toStringAsFixed(4)}',
                        ),
                      ),
                    );
                  }
                },
              ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }
}
