import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../l10n/generated/watch_localizations.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
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
  String? _activationCode;
  DateTime? _activationExpiresAt;
  String? _activationError;
  bool _regenerating = false;

  @override
  Widget build(BuildContext context) {
    final l10n = WatchLocalizations.of(context);
    return WatchScreenShell(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          WatchSectionTitle(l10n.settings),
          _SettingToggle(
            label: 'Vibration',
            value: true,
            onChanged: widget.services.vibration.setEnabled,
          ),
          _SettingToggle(
            label: 'Failover to LTE',
            value: widget.services.connectivity.failoverEnabled,
            onChanged: (value) {
              widget.services.connectivity.update(failoverEnabled: value);
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
            label: l10n.language,
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.settingsLanguage),
          ),
          const SizedBox(height: 6),
          WatchOutlineButton(
            label: 'Location',
            onPressed: () =>
                Navigator.pushNamed(context, WatchRoutes.settingsLocation),
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
          const SizedBox(height: 8),
          _DeviceCodePanel(
            code: _activationCode,
            expiresAt: _activationExpiresAt,
            error: _activationError,
            busy: _regenerating,
            onRegenerate: _confirmRegenerate,
          ),
          const Spacer(),
          WatchPrimaryButton(
            label: 'Re-pair Device',
            color: EyeColors.orange,
            onPressed: () async {
              await widget.services.push.revokeToken();
              await widget.services.pairing.unpair();
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
              await widget.services.push.revokeToken();
              await widget.services.pairing.unpair();
              await widget.services.credentials.wipe();
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

  Future<void> _confirmRegenerate() async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Regenerate Device Code'),
        content: const Text(
          'Use this if THE EYE was reinstalled or this watch needs to be paired again. Generating a new code will invalidate the previous activation code.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text('Regenerate Code'),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _regenerating = true;
      _activationError = null;
    });
    try {
      final result = await widget.services.pairing.regenerateActivationCode();
      if (!mounted) return;
      setState(() {
        _activationCode = result.code;
        _activationExpiresAt = result.expiresAt;
        _regenerating = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _activationError =
            'Internet connection is required to generate a new device code.';
        _regenerating = false;
      });
    }
  }
}

class _DeviceCodePanel extends StatelessWidget {
  const _DeviceCodePanel({
    required this.code,
    required this.expiresAt,
    required this.error,
    required this.busy,
    required this.onRegenerate,
  });

  final String? code;
  final DateTime? expiresAt;
  final String? error;
  final bool busy;
  final VoidCallback onRegenerate;

  @override
  Widget build(BuildContext context) {
    final displayCode = code == null || code!.length != 6
        ? code
        : '${code!.substring(0, 3)} ${code!.substring(3)}';
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border.all(color: EyeColors.green.withValues(alpha: 0.5)),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text('Device & Pairing', style: TextStyle(fontSize: 12)),
          const SizedBox(height: 4),
          if (displayCode != null) ...[
            Text(
              displayCode,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 22, fontWeight: FontWeight.w700),
            ),
            if (expiresAt != null)
              Text(
                'Expires ${TimeOfDay.fromDateTime(expiresAt!).format(context)}',
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 10),
              ),
            const SizedBox(height: 4),
          ],
          if (error != null)
            Text(error!,
                style: const TextStyle(color: EyeColors.danger, fontSize: 10)),
          WatchOutlineButton(
            label: busy ? 'Generating...' : 'Regenerate Device Code',
            onPressed: busy ? null : onRegenerate,
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
