import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../api/field_api_paths.dart';
import '../../config/app_flavor.dart';
import '../../launcher/field_launcher_platform.dart';
import '../../launcher/launcher_policy.dart';
import '../../services/field_app_services.dart';

Future<void> showMaintenanceEscapeSheet(
  BuildContext context, {
  required FieldAppServices services,
  required FieldLauncherPlatform platform,
  required LauncherPolicy policy,
}) {
  return showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    backgroundColor: const Color(0xFF121C2A),
    builder: (_) => MaintenanceEscapeSheet(
      services: services,
      platform: platform,
      policy: policy,
    ),
  );
}

/// Supervisor-only staging/production maintenance escape (audited).
class MaintenanceEscapeSheet extends StatefulWidget {
  const MaintenanceEscapeSheet({
    super.key,
    required this.services,
    required this.platform,
    required this.policy,
  });

  final FieldAppServices services;
  final FieldLauncherPlatform platform;
  final LauncherPolicy policy;

  @override
  State<MaintenanceEscapeSheet> createState() => _MaintenanceEscapeSheetState();
}

class _MaintenanceEscapeSheetState extends State<MaintenanceEscapeSheet> {
  final _pin = TextEditingController();
  bool _busy = false;
  String? _error;

  @override
  void dispose() {
    _pin.dispose();
    super.dispose();
  }

  Future<void> _confirm() async {
    if (!widget.policy.maintenanceModeAllowed) {
      setState(() => _error = 'Maintenance escape is disabled by agency policy.');
      return;
    }
    if (_pin.text.trim().length < 4) {
      setState(() => _error = 'Enter supervisor PIN / reauthentication code.');
      return;
    }
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      await widget.services.api.post(
        FieldApiPaths.deviceLauncherAudit,
        body: {
          'action': 'field.launcher.maintenance_escape',
          'ok': true,
          'environment': AppFlavor.envName,
          'clientAt': DateTime.now().toUtc().toIso8601String(),
          'supervisorChallenge': 'pin_presented',
        },
      );
      await widget.platform.stopLockTask();
      await widget.platform.setHomeAliasEnabled(false);
      await widget.platform.openHomeSettings();
      if (!mounted) return;
      Navigator.of(context).pop();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Maintenance mode: choose another Android launcher if needed. Event audited.',
          ),
        ),
      );
    } on FieldApiException catch (error) {
      setState(() => _error = error.message);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 20,
        right: 20,
        top: 20,
        bottom: MediaQuery.viewInsetsOf(context).bottom + 20,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            AppFlavor.isStaging
                ? 'Staging maintenance escape'
                : 'Supervisor maintenance mode',
            style: const TextStyle(
              color: Colors.white,
              fontWeight: FontWeight.w800,
              fontSize: 20,
            ),
          ),
          const SizedBox(height: 8),
          const Text(
            'Requires an authorized supervisor session and PIN. '
            'This opens Android home/launcher settings and is fully audited. '
            'There is no hidden bypass.',
            style: TextStyle(color: Colors.white70),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _pin,
            obscureText: true,
            keyboardType: TextInputType.number,
            decoration: const InputDecoration(
              labelText: 'Supervisor PIN',
              labelStyle: TextStyle(color: Colors.white70),
            ),
            style: const TextStyle(color: Colors.white),
          ),
          if (_error != null) ...[
            const SizedBox(height: 8),
            Text(_error!, style: const TextStyle(color: Colors.redAccent)),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _busy ? null : _confirm,
            child: Text(_busy ? 'Verifying…' : 'Exit launcher / open Home settings'),
          ),
        ],
      ),
    );
  }
}
