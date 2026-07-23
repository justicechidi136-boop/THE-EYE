import 'dart:async';

import 'package:flutter/material.dart';

import '../design_system/design_system.dart';
import '../models/active_emergency_status.dart';
import '../models/connectivity_mode.dart';
import '../models/emergency_mode.dart';
import '../models/sos_event.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class ActiveEmergencyScreen extends StatefulWidget {
  const ActiveEmergencyScreen({
    super.key,
    required this.services,
    this.incidentId,
  });

  final WatchAppServices services;
  final String? incidentId;

  @override
  State<ActiveEmergencyScreen> createState() => _ActiveEmergencyScreenState();
}

class _ActiveEmergencyScreenState extends State<ActiveEmergencyScreen> {
  Timer? _pollTimer;

  @override
  void initState() {
    super.initState();
    widget.services.heartbeat.start(emergency: true);
    _pollTimer = Timer.periodic(const Duration(seconds: 5), (_) {
      unawaited(widget.services.sos.syncEmergencyTracking());
      unawaited(widget.services.heartbeat.sendHeartbeat());
    });
    unawaited(widget.services.sos.syncEmergencyTracking());
    unawaited(widget.services.heartbeat.sendHeartbeat());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return StreamBuilder<SosEventState>(
      stream: widget.services.sos.states,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final state = snapshot.data!;
        final discreet = state.emergencyMode == WatchEmergencyMode.silentSos;
        final isSending = state.lifecycle == SosLifecycle.submitting;
        final isQueued = state.offlineQueued;
        final statusTitle = isSending
            ? (discreet ? 'Sending…' : 'Sending SOS…')
            : isQueued
                ? 'Queued offline'
                : watchIncidentStatusLabel(state.incidentStatus);
        final statusBody = watchOperationalBody(state);
        final battery = widget.services.heartbeat.latest?.batteryLevel;
        final connectivity = widget.services.connectivity.activeMode;

        return WatchScaffold(
          onBack: () => Navigator.popUntil(
            context,
            ModalRoute.withName(WatchRoutes.home),
          ),
          child: Column(
            children: [
              const SizedBox(height: 8),
              Container(
                width: 52,
                height: 52,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: (discreet ? EyeColors.muted : EyeColors.danger)
                      .withValues(alpha: 0.15),
                  border: Border.all(
                    color: discreet ? EyeColors.muted : EyeColors.danger,
                    width: 2,
                  ),
                ),
                child: Icon(
                  isQueued ? Icons.cloud_queue : Icons.sensors,
                  color: discreet ? EyeColors.muted : EyeColors.danger,
                  size: isQueued ? 28 : 24,
                ),
              ),
              const SizedBox(height: 12),
              Text(
                statusTitle,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: discreet ? EyeColors.muted : EyeColors.danger,
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                statusBody,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  color: EyeColors.muted,
                  fontSize: 10,
                  height: 1.4,
                ),
              ),
              if (state.incidentId != null) ...[
                const SizedBox(height: 8),
                Text(
                  'Incident ${state.incidentId}',
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: EyeColors.muted, fontSize: 9),
                ),
              ],
              const SizedBox(height: 8),
              Text(
                _telemetryLine(battery, connectivity),
                textAlign: TextAlign.center,
                style: const TextStyle(color: EyeColors.muted, fontSize: 9),
              ),
              const Spacer(),
              WatchPrimaryButton(
                label: 'Done',
                color: EyeColors.danger,
                onPressed: () => Navigator.popUntil(
                  context,
                  ModalRoute.withName(WatchRoutes.home),
                ),
              ),
              const SizedBox(height: 6),
              if (state.latitude != null && state.longitude != null)
                WatchOutlineButton(
                  label: 'View Map',
                  onPressed: () =>
                      Navigator.pushNamed(context, WatchRoutes.tracking),
                ),
              const SizedBox(height: 8),
            ],
          ),
        );
      },
    );
  }

  String _telemetryLine(int? battery, WatchConnectivityMode mode) {
    final batteryLabel = battery == null ? 'Battery —' : 'Battery $battery%';
    final networkLabel = switch (mode) {
      WatchConnectivityMode.offline => 'Network offline',
      WatchConnectivityMode.pairedPhone => 'Network paired phone',
      WatchConnectivityMode.standaloneCellular => 'Network LTE',
    };
    return '$batteryLabel · $networkLabel';
  }
}
