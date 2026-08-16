import 'dart:async';

import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../design_system/design_system.dart';
import '../l10n/generated/watch_localizations.dart';
import '../models/emergency_mode.dart';
import '../models/sos_event.dart';
import '../models/watch_safety_status.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../theme/eye_semantic_colors.dart';
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

  Color _safetyColor(WatchSafetyStatus status) {
    return switch (status.level) {
      WatchSafetyLevel.danger => EyeColors.danger,
      WatchSafetyLevel.highAlert => EyeColors.orange,
      WatchSafetyLevel.safe => EyeColors.green,
    };
  }

  IconData _safetyIcon(WatchSafetyStatus status) {
    return switch (status.level) {
      WatchSafetyLevel.danger => Icons.warning_amber_rounded,
      WatchSafetyLevel.highAlert => Icons.report_problem_outlined,
      WatchSafetyLevel.safe => Icons.check_circle_outline,
    };
  }

  String _safetyTitle(WatchLocalizations l10n, WatchSafetyStatus status) {
    return switch (status.level) {
      WatchSafetyLevel.danger => l10n.danger,
      WatchSafetyLevel.highAlert => l10n.highAlert,
      WatchSafetyLevel.safe => l10n.areaSafe,
    };
  }

  String _safetyMessage(WatchLocalizations l10n, WatchSafetyStatus status) {
    return switch (status.level) {
      WatchSafetyLevel.danger =>
        WatchDangerLabels.nearbyLabel(l10n, status.dangerCode),
      WatchSafetyLevel.highAlert => l10n.beCarefulStayAlert,
      WatchSafetyLevel.safe => l10n.stayAlertSuspiciousActivity,
    };
  }

  String? _safetyMeta(WatchSafetyStatus status) {
    final parts = <String>[];
    final area = status.areaName?.trim();
    if (area != null && area.isNotEmpty) parts.add(area);
    final distance = status.distanceMeters;
    if (distance != null && distance > 0) {
      parts.add(distance >= 1000
          ? '${(distance / 1000).toStringAsFixed(1)} km'
          : '$distance m');
    }
    return parts.isEmpty ? null : parts.join(' - ');
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
    final l10n = WatchLocalizations.of(context);

    return StreamBuilder<SosEventState>(
      stream: _sosStream,
      initialData: widget.services.sos.state,
      builder: (context, snapshot) {
        final sosState = snapshot.data!;
        final holdProgress =
            sosState.holdProgressMs / widget.services.sos.holdDurationMs;

        return WatchScaffold(
          enableBack: false,
          leadingLabel: l10n.apps,
          onLeadingTap: () => Navigator.push(
            context,
            MaterialPageRoute<void>(
              builder: (_) => AppDrawerScreen(launcher: widget.launcher),
            ),
          ),
          backgroundColor: EyeTokens.dark,
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
              ValueListenableBuilder<WatchSafetyStatus>(
                valueListenable: widget.services.dangerAlerts.safetyStatus,
                builder: (context, safety, _) => _SafetyStatusCard(
                  icon: _safetyIcon(safety),
                  color: _safetyColor(safety),
                  title: _safetyTitle(l10n, safety),
                  message: _safetyMessage(l10n, safety),
                  meta: _safetyMeta(safety),
                ),
              ),
              const SizedBox(height: EyeTokens.spaceXs),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  _ModeBadge(label: _modeBadge()),
                  const SizedBox(width: 6),
                  _ModeBadge(
                    label: widget.services.connectivity.activeMode.apiValue,
                    color: EyeSemanticColors.of(context).interactiveText,
                  ),
                ],
              ),
              const Spacer(),
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  WatchMetricColumn(
                    value: '$_alertCount',
                    label: l10n.alerts,
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
                    label: l10n.radius,
                    onTap: () =>
                        Navigator.pushNamed(context, WatchRoutes.deviceStatus),
                  ),
                ],
              ),
              const SizedBox(height: EyeTokens.spaceXs),
              WatchOutlineButton(
                label: l10n.silentAlert,
                onPressed: () {
                  widget.services.sos
                      .beginHold(emergencyMode: WatchEmergencyMode.silentSos);
                  Navigator.pushNamed(
                    context,
                    WatchRoutes.sosConfirm,
                    arguments: WatchEmergencyMode.silentSos,
                  );
                },
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
                      style: TextStyle(
                        color: EyeSemanticColors.of(context).linkText,
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

class _SafetyStatusCard extends StatelessWidget {
  const _SafetyStatusCard({
    required this.icon,
    required this.color,
    required this.title,
    required this.message,
    this.meta,
  });

  final IconData icon;
  final Color color;
  final String title;
  final String message;
  final String? meta;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        border: Border.all(color: color.withValues(alpha: 0.55)),
        borderRadius: BorderRadius.circular(14),
      ),
      child: Row(
        children: [
          Icon(icon, color: color, size: 18),
          const SizedBox(width: 7),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  title.toUpperCase(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    color: color,
                    fontSize: 10,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                Text(
                  message,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    color: EyeColors.white,
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                  ),
                ),
                if (meta != null)
                  Text(
                    meta!,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      color: EyeColors.muted,
                      fontSize: 9,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
