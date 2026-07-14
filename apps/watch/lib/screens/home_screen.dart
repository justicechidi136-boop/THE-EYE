import 'dart:async';

import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../design_system/design_system.dart';
import '../models/connectivity_mode.dart';
import '../models/sos_event.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'app_drawer_screen.dart';
import 'launcher_escape_dialog.dart';
import 'routes.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({
    super.key,
    required this.services,
    required this.launcher,
  });

  final WatchAppServices services;
  final LauncherService launcher;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  late final Stream<SosEventState> _sosStream;
  int _alertCount = 0;
  Timer? _clock;
  bool _debugBuild = false;

  @override
  void initState() {
    super.initState();
    _sosStream = widget.services.sos.states;
    _clock = Timer.periodic(const Duration(seconds: 1), (_) {
      if (mounted) setState(() {});
    });
    _loadAlerts();
    _loadDebugFlag();
  }

  Future<void> _loadDebugFlag() async {
    final debug = await widget.launcher.isDebugBuild();
    if (mounted) setState(() => _debugBuild = debug);
  }

  @override
  void dispose() {
    _clock?.cancel();
    super.dispose();
  }

  Future<void> _loadAlerts() async {
    try {
      final alerts = await widget.services.alerts.loadHistory();
      if (mounted) setState(() => _alertCount = alerts.length);
    } catch (_) {
      // Clock-first: never block home on backend/Firebase.
    }
  }

  WatchStatusTone _statusTone() {
    final mode = widget.services.connectivity.activeMode;
    if (mode == WatchConnectivityMode.offline) return WatchStatusTone.danger;
    if (_isDangerFace()) return WatchStatusTone.warning;
    return WatchStatusTone.safe;
  }

  String _statusLabel() {
    final mode = widget.services.connectivity.activeMode;
    if (mode == WatchConnectivityMode.offline) return 'Offline';
    if (mode == WatchConnectivityMode.standaloneCellular) {
      return 'LTE Standalone';
    }
    if (_isDangerFace()) return 'DANGER NEARBY';
    return 'Area: Moderate Risk';
  }

  bool _isDangerFace() {
    final mode = widget.services.connectivity.activeMode;
    return _alertCount > 0 && mode != WatchConnectivityMode.offline;
  }

  String _modeBadge() {
    if (WatchFlavor.isManagedLauncher) return 'Managed';
    return 'Consumer';
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final battery = widget.services.heartbeat.latest?.batteryLevel ?? 100;
    final gpsActive = widget.services.sos.state.latitude != null;
    final gpsLabel = gpsActive ? 'GPS' : '500m';

    return StreamBuilder<SosEventState>(
      stream: _sosStream,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final sosState = snapshot.data!;
        final holdProgress =
            sosState.holdProgressMs / widget.services.sos.holdDurationMs;

        return WatchScaffold(
          enableBack: false,
          leadingLabel: 'Apps',
          onLeadingTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => AppDrawerScreen(launcher: widget.launcher),
            ),
          ),
          backgroundColor: _isDangerFace() ? EyeTokens.surface : EyeTokens.dark,
          child: Column(
            children: [
              GestureDetector(
                onLongPress: () => LauncherEscapeDialog.maybeShow(
                  context,
                  launcher: widget.launcher,
                  debugBuild: _debugBuild,
                ),
                child: const WatchLogomark(size: 36),
              ),
              const SizedBox(height: EyeTokens.spaceXs),
              Text(
                '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
                style: EyeTokens.clockDisplay,
              ),
              Text(formatWatchDate(now), style: EyeTokens.dateLabel),
              const SizedBox(height: EyeTokens.spaceSm),
              WatchStatusChip(label: _statusLabel(), tone: _statusTone()),
              const SizedBox(height: EyeTokens.spaceXs),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _ModeBadge(label: _modeBadge()),
                  const SizedBox(width: 6),
                  _ModeBadge(
                    label: widget.services.connectivity.activeMode.apiValue,
                    color: EyeColors.green,
                  ),
                ],
              ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  WatchMetricColumn(
                    value: '$_alertCount',
                    label: 'Alerts',
                    onTap: () async {
                      if (_alertCount > 0) {
                        await Navigator.pushNamed(
                          context,
                          WatchRoutes.alertSummary,
                          arguments: _alertCount,
                        );
                      } else {
                        await Navigator.pushNamed(
                          context,
                          WatchRoutes.alertHistory,
                        );
                      }
                      _loadAlerts();
                    },
                  ),
                  LargeSosButton(
                    compact: true,
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
              const SizedBox(height: EyeTokens.spaceSm),
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
                      context,
                      WatchRoutes.connectionStatus,
                    ),
                    child: Text(
                      widget.services.connectivity.activeMode.apiValue,
                      style: const TextStyle(
                        color: EyeColors.green,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                  GestureDetector(
                    onTap: () =>
                        Navigator.pushNamed(context, WatchRoutes.settings),
                    child: const Icon(
                      Icons.settings,
                      color: EyeColors.muted,
                      size: 14,
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

class _ModeBadge extends StatelessWidget {
  const _ModeBadge({required this.label, this.color = EyeColors.muted});

  final String label;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        border: Border.all(color: color.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style:
            TextStyle(color: color, fontSize: 7, fontWeight: FontWeight.w700),
      ),
    );
  }
}
