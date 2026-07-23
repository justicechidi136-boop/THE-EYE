import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../models/connectivity_mode.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../storage/watch_settings_store.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class SettingsScreen extends StatefulWidget {
  const SettingsScreen({
    super.key,
    required this.services,
    required this.launcher,
  });

  final WatchAppServices services;
  final LauncherService launcher;

  @override
  State<SettingsScreen> createState() => _SettingsScreenState();
}

class _SettingsScreenState extends State<SettingsScreen> {
  WatchSettings? _settings;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    final settings = await widget.services.settings.load();
    if (!mounted) return;
    setState(() => _settings = settings);
    widget.services.vibration.setEnabled(settings.vibrationEnabled);
    widget.services.connectivity.update(
      failoverEnabled: settings.failoverEnabled,
      preferredMode: settings.preferredConnectionMode == 'standaloneCellular'
          ? WatchConnectivityMode.standaloneCellular
          : WatchConnectivityMode.pairedPhone,
    );
  }

  Future<void> _save(WatchSettings next) async {
    await widget.services.settings.save(next);
    setState(() => _settings = next);
  }

  @override
  Widget build(BuildContext context) {
    final settings = _settings;
    return WatchScreenShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('Settings'),
          if (settings == null)
            const Padding(
              padding: EdgeInsets.all(12),
              child: Text('Loading settings…', style: TextStyle(color: EyeColors.muted)),
            )
          else ...[
            _SettingToggle(
              label: 'Vibration',
              value: settings.vibrationEnabled,
              onChanged: (value) => _save(settings.copyWith(vibrationEnabled: value)),
            ),
            _SettingToggle(
              label: 'Failover to LTE',
              value: settings.failoverEnabled,
              onChanged: (value) =>
                  _save(settings.copyWith(failoverEnabled: value)),
            ),
            _SettingToggle(
              label: 'Diagnostic display',
              value: settings.diagnosticDisplay,
              onChanged: (value) =>
                  _save(settings.copyWith(diagnosticDisplay: value)),
            ),
          ],
          const SizedBox(height: 8),
          WatchOutlineButton(
            label: 'Alert Radius (${settings?.alertRadiusMeters ?? 500}m)',
            onPressed: () async {
              final radius = await Navigator.pushNamed<int>(
                context,
                WatchRoutes.settingsRadius,
                arguments: settings?.alertRadiusMeters ?? 500,
              );
              if (radius != null && settings != null) {
                await _save(settings.copyWith(alertRadiusMeters: radius));
              }
            },
          ),
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'SOS Contacts',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.settingsContacts),
          ),
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'Connection',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.connectionStatus),
          ),
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'Device Status',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.deviceStatus),
          ),
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'App Drawer',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.appDrawer),
          ),
          if (!WatchFlavor.isManagedLauncher) ...[
            const SizedBox(height: 6),
            WatchOutlineButton(
              label: 'Change Default Home',
              onPressed: widget.launcher.openHomeSettings,
            ),
          ],
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'System Settings',
            onPressed: widget.launcher.openSystemSettings,
          ),
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'Reset settings',
            onPressed: () async {
              await widget.services.settings.resetToDefaults();
              await _load();
            },
          ),
        ],
      ),
    );
  }
}

class _SettingToggle extends StatelessWidget {
  const _SettingToggle({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final bool value;
  final ValueChanged<bool> onChanged;

  @override
  Widget build(BuildContext context) {
    return SwitchListTile(
      title: Text(label, style: const TextStyle(color: EyeColors.white, fontSize: 13)),
      value: value,
      activeThumbColor: EyeColors.green,
      onChanged: onChanged,
    );
  }
}
