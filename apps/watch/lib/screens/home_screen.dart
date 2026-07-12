import 'dart:async';

import 'package:flutter/material.dart';

import '../models/connectivity_mode.dart';
import '../models/sos_event.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Stream<SosEventState> _sosStream;
  int _alertCount = 0;
  Timer? _clock;

  @override
  void initState() {
    super.initState();
    _sosStream = widget.services.sos.states;
    _loadAlerts();
    _clock = Timer.periodic(const Duration(seconds: 30), (_) {
      if (mounted) setState(() {});
    });
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  Future<void> _loadAlerts() async {
    final alerts = await widget.services.alerts.loadHistory();
    if (mounted) setState(() => _alertCount = alerts.length);
  }

  WatchStatusTone _statusTone() {
    final mode = widget.services.connectivity.activeMode;
    return switch (mode) {
      WatchConnectivityMode.offline => WatchStatusTone.danger,
      WatchConnectivityMode.standaloneCellular => WatchStatusTone.warning,
      WatchConnectivityMode.pairedPhone => WatchStatusTone.safe,
    };
  }

  String _statusLabel() {
    final mode = widget.services.connectivity.activeMode;
    return switch (mode) {
      WatchConnectivityMode.offline => 'Offline',
      WatchConnectivityMode.standaloneCellular => 'LTE Standalone',
      WatchConnectivityMode.pairedPhone => 'Area: Moderate Risk',
    };
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final battery = widget.services.heartbeat.latest?.batteryLevel ?? 100;
    final gpsLabel =
        widget.services.sos.state.latitude != null ? 'GPS' : '500m';

    return StreamBuilder<SosEventState>(
      stream: _sosStream,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final sosState = snapshot.data!;
        final holdProgress =
            sosState.holdProgressMs / widget.services.sos.holdDurationMs;

        return WatchScreenShell(
          enableBack: false,
          leadingLabel: 'THE EYE',
          onLeadingTap: () =>
              Navigator.pushNamed(context, WatchRoutes.settings),
          child: Column(
            children: [
              const SizedBox(height: 4),
              Text(
                '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
                style: const TextStyle(
                  color: EyeColors.white,
                  fontSize: 32,
                  fontWeight: FontWeight.w700,
                  letterSpacing: -1,
                  height: 1.2,
                ),
              ),
              Text(
                formatWatchDate(now),
                style: const TextStyle(
                  color: EyeColors.white,
                  fontSize: 12,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 12),
              WatchStatusChip(label: _statusLabel(), tone: _statusTone()),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  WatchMetricColumn(
                    value: '$_alertCount',
                    label: 'Alerts',
                    onTap: () async {
                      await Navigator.pushNamed(
                        context,
                        WatchRoutes.alertHistory,
                      );
                      _loadAlerts();
                    },
                  ),
                  WatchHomeSosButton(
                    progress: sosState.lifecycle == SosLifecycle.holding
                        ? holdProgress.clamp(0.0, 1.0)
                        : 0,
                    onHoldStart: () {
                      widget.services.sos.beginHold();
                      Navigator.pushNamed(context, WatchRoutes.sosConfirm);
                    },
                    onHoldEnd: widget.services.sos.cancelHold,
                  ),
                  WatchMetricColumn(
                    value: gpsLabel,
                    label: 'Radius',
                    onTap: () =>
                        Navigator.pushNamed(context, WatchRoutes.deviceStatus),
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  Text(
                    'Bat $battery%',
                    style:
                        const TextStyle(color: EyeColors.muted, fontSize: 10),
                  ),
                  GestureDetector(
                    onTap: () => Navigator.pushNamed(
                        context, WatchRoutes.connectionStatus),
                    child: Text(
                      widget.services.connectivity.activeMode.apiValue,
                      style: const TextStyle(
                        color: EyeColors.green,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        );
      },
    );
  }
}
