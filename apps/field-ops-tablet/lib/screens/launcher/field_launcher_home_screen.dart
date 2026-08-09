import 'package:flutter/material.dart';

import '../../config/app_flavor.dart';
import '../../config/field_device_mode.dart';
import '../../launcher/approved_app_launcher.dart';
import '../../launcher/field_launcher_platform.dart';
import '../../launcher/launcher_modules.dart';
import '../../launcher/launcher_policy.dart';
import '../../launcher/widgets/emergency_quick_actions.dart';
import '../../launcher/widgets/operational_status_strip.dart';
import '../../services/field_app_services.dart';
import '../routes.dart';
import 'approved_apps_screen.dart';
import 'maintenance_escape_sheet.dart';

/// Tablet-first FIELD_LAUNCHER / MANAGED_KIOSK home shell.
class FieldLauncherHomeScreen extends StatefulWidget {
  const FieldLauncherHomeScreen({
    super.key,
    required this.services,
    required this.policy,
    required this.onRefreshPolicy,
  });

  final FieldAppServices services;
  final LauncherPolicy policy;
  final Future<LauncherPolicy> Function() onRefreshPolicy;

  @override
  State<FieldLauncherHomeScreen> createState() =>
      _FieldLauncherHomeScreenState();
}

class _FieldLauncherHomeScreenState extends State<FieldLauncherHomeScreen> {
  late LauncherPolicy _policy;
  final _platform = FieldLauncherPlatform();
  late final ApprovedAppLauncher _appLauncher;
  String _gps = '—';
  String _network = '—';
  String _battery = '—';
  String _sync = 'Idle';
  String _shift = '—';
  String _mode = 'Idle';
  String _assignment = 'None';
  int _unread = 0;
  String? _officer;
  String? _agency;
  String? _unit;

  @override
  void initState() {
    super.initState();
    _policy = widget.policy;
    _appLauncher = ApprovedAppLauncher(
      platform: _platform,
      api: widget.services.api,
    );
    _hydrate();
  }

  Future<void> _hydrate() async {
    final officer = await widget.services.session.readOfficerName();
    final deviceId = await widget.services.session.readPublicDeviceId();
    try {
      await widget.services.restoreSession();
      final dash = await widget.services.workflows.getDashboard();
      if (!mounted) return;
      setState(() {
        _officer = officer ?? dash['officerName']?.toString();
        _agency = dash['agencyName']?.toString() ?? _policy.agencyId;
        _unit = dash['unitName']?.toString();
        _shift = dash['shiftStatus']?.toString() ?? 'Off duty';
        _mode = dash['operationalMode']?.toString() ?? 'Idle';
        _assignment = dash['activeAssignmentLabel']?.toString() ?? 'None';
        _unread = (dash['unreadAlerts'] as num?)?.toInt() ?? 0;
        _gps = dash['gpsLabel']?.toString() ?? 'Acquiring';
        _network = dash['networkType']?.toString() ?? 'Unknown';
        _battery = dash['batteryLevel'] != null
            ? '${dash['batteryLevel']}%'
            : '—';
        _sync = dash['syncState']?.toString() ?? 'OK';
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _officer = officer;
        _agency = _policy.agencyId;
        _unit = deviceId;
      });
    }
  }

  Future<void> _openModule(LauncherModule module) async {
    if (module.id == 'backup') {
      // Handled by emergency strip; keep tile as shortcut to home ops.
    }
    if (module.route == FieldRoutes.home && module.id == 'dashboard') {
      // Already on launcher home — optional nested dashboard.
      return;
    }
    await Navigator.of(context).pushNamed(module.route);
  }

  Future<void> _refresh() async {
    final next = await widget.onRefreshPolicy();
    if (!mounted) return;
    setState(() => _policy = next);
    await _hydrate();
  }

  @override
  Widget build(BuildContext context) {
    final modules = LauncherModules.visibleFor(_policy);
    final theme = Theme.of(context);

    return PopScope(
      canPop: false,
      child: Scaffold(
        backgroundColor: const Color(0xFF0B1420),
        body: Column(
          children: [
            OperationalStatusStrip(
              gpsLabel: _gps,
              networkLabel: _network,
              batteryLabel: _battery,
              syncLabel: _sync,
              shiftLabel: _shift,
              modeLabel: _mode,
              assignmentLabel: _assignment,
              unreadAlerts: _unread,
            ),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(20, 12, 20, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                'THE EYE Field Launcher',
                                style: theme.textTheme.headlineSmall?.copyWith(
                                  color: Colors.white,
                                  fontWeight: FontWeight.w800,
                                ),
                              ),
                              const SizedBox(height: 4),
                              Text(
                                [
                                  _officer ?? 'Officer',
                                  _agency ?? 'Agency',
                                  _unit ?? 'Unit',
                                  FieldDeviceModeConfig.apiValue(_policy.deviceMode),
                                  if (AppFlavor.isStaging) 'STAGING',
                                ].join(' · '),
                                style: theme.textTheme.bodyMedium?.copyWith(
                                  color: Colors.white70,
                                ),
                              ),
                            ],
                          ),
                        ),
                        IconButton(
                          tooltip: 'Refresh policy',
                          onPressed: _refresh,
                          icon: const Icon(Icons.refresh, color: Colors.white70),
                        ),
                        if (_policy.maintenanceModeAllowed)
                          TextButton(
                            onPressed: () => showMaintenanceEscapeSheet(
                              context,
                              services: widget.services,
                              platform: _platform,
                              policy: _policy,
                            ),
                            child: const Text('Maintenance'),
                          ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    EmergencyQuickActions(
                      services: widget.services,
                      policy: _policy,
                      platform: _platform,
                    ),
                    const SizedBox(height: 16),
                    Expanded(
                      child: GridView.builder(
                        gridDelegate:
                            const SliverGridDelegateWithMaxCrossAxisExtent(
                          maxCrossAxisExtent: 220,
                          mainAxisSpacing: 12,
                          crossAxisSpacing: 12,
                          childAspectRatio: 1.35,
                        ),
                        itemCount: modules.length + 1,
                        itemBuilder: (context, index) {
                          if (index == modules.length) {
                            return _tile(
                              icon: Icons.apps,
                              label: 'Approved Apps',
                              onTap: () {
                                Navigator.of(context).push(
                                  MaterialPageRoute<void>(
                                    builder: (_) => ApprovedAppsScreen(
                                      policy: _policy,
                                      launcher: _appLauncher,
                                    ),
                                  ),
                                );
                              },
                            );
                          }
                          final module = modules[index];
                          return _tile(
                            icon: module.icon,
                            label: module.label,
                            onTap: () => _openModule(module),
                          );
                        },
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _tile({
    required IconData icon,
    required String label,
    required VoidCallback onTap,
  }) {
    return Material(
      color: const Color(0xFF152437),
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icon, size: 32, color: const Color(0xFF7EB6FF)),
              const Spacer(),
              Text(
                label,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.w700,
                  fontSize: 16,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
