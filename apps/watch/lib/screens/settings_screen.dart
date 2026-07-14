import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({
    super.key,
    required this.services,
    required this.launcher,
  });

  final WatchAppServices services;
  final LauncherService launcher;

  @override
  Widget build(BuildContext context) {
    return WatchScreenShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const WatchSectionTitle('Settings'),
          _SettingToggle(
            label: 'Vibration',
            value: true,
            onChanged: services.vibration.setEnabled,
          ),
          _SettingToggle(
            label: 'Failover to LTE',
            value: services.connectivity.failoverEnabled,
            onChanged: (value) {
              services.connectivity.update(failoverEnabled: value);
            },
          ),
          const SizedBox(height: 8),
          WatchOutlineButton(
            label: 'Alert Radius',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.settingsRadius),
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
              onPressed: launcher.openHomeSettings,
            ),
          ],
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'System Settings',
            onPressed: launcher.openSystemSettings,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Re-pair Device',
            color: EyeColors.orange,
            onPressed: () async {
              await services.push.revokeToken();
              await services.pairing.unpair();
              if (!context.mounted) return;
              Navigator.pushNamedAndRemoveUntil(
                context,
                WatchRoutes.pairing,
                (route) => false,
              );
            },
          ),
          const SizedBox(height: 6),
          WatchPrimaryButton(
            label: 'Unpair & Wipe',
            color: EyeColors.danger,
            onPressed: () async {
              await services.push.revokeToken();
              await services.pairing.unpair();
              await services.credentials.wipe();
              if (!context.mounted) return;
              Navigator.pushNamedAndRemoveUntil(
                context,
                WatchRoutes.pairing,
                (route) => false,
              );
            },
          ),
          const SizedBox(height: 8),
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
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(label, style: const TextStyle(fontSize: 12)),
          Switch(
            value: value,
            activeThumbColor: EyeColors.green,
            onChanged: onChanged,
            materialTapTargetSize: MaterialTapTargetSize.shrinkWrap,
          ),
        ],
      ),
    );
  }
}
