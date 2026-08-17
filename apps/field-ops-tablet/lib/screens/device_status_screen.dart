import 'package:flutter/material.dart';

import '../api/field_api_client.dart';
import '../device/field_device_service.dart';
import '../l10n/generated/field_localizations.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class DeviceStatusScreen extends StatefulWidget {
  const DeviceStatusScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<DeviceStatusScreen> createState() => _DeviceStatusScreenState();
}

class _DeviceStatusScreenState extends State<DeviceStatusScreen> {
  FieldDeviceRecord? _device;
  String? _error;
  FieldActivationCode? _activationCode;
  bool _busy = true;
  bool _regenerating = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final device = await widget.services.devices.registrationStatus();
      setState(() {
        _device = device;
        _busy = false;
      });
    } on FieldApiException catch (error) {
      setState(() {
        _error = error.message;
        _busy = false;
      });
    }
  }

  Future<void> _sendHeartbeat() async {
    final publicDeviceId =
        _device?.publicDeviceId ??
        await widget.services.session.readPublicDeviceId();
    if (publicDeviceId == null || publicDeviceId.isEmpty) return;

    await widget.services.auth.restoreApiToken();
    await widget.services.devices.heartbeat(publicDeviceId: publicDeviceId);
    if (!mounted) return;
    final l10n = FieldLocalizations.of(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.heartbeatSent)));
  }

  Future<void> _regenerateActivationCode() async {
    final device = _device;
    if (device == null) return;
    if (device.isSecurityDeactivated) {
      setState(() {
        _error = 'Device deactivated. Security verification required.';
      });
      return;
    }
    final confirmed = await showDialog<bool>(
      context: context,
      builder:
          (context) => AlertDialog(
            title: const Text('Regenerate Activation Code'),
            content: const Text(
              'Generate a new activation code for this device? The previous unused activation code will stop working.',
            ),
            actions: [
              TextButton(
                onPressed: () => Navigator.pop(context, false),
                child: const Text('Cancel'),
              ),
              FilledButton(
                onPressed: () => Navigator.pop(context, true),
                child: const Text('Regenerate'),
              ),
            ],
          ),
    );
    if (confirmed != true || !mounted) return;
    setState(() {
      _regenerating = true;
      _error = null;
    });
    try {
      final code = await widget.services.devices.regenerateActivationCode();
      if (!mounted) return;
      setState(() {
        _activationCode = code;
        _regenerating = false;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _regenerating = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            'Internet connection is required to generate a new device code.';
        _regenerating = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.deviceStatus),
        backgroundColor: FieldColors.surface,
      ),
      body:
          _busy
              ? const Center(
                child: CircularProgressIndicator(color: FieldColors.orange),
              )
              : ListView(
                padding: const EdgeInsets.all(32),
                children: [
                  if (_error != null)
                    Text(
                      _error!,
                      style: const TextStyle(color: FieldColors.danger),
                    ),
                  if (_device != null) ...[
                    Text(
                      'Device Management',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 12),
                    _StatusTile(
                      label: l10n.publicDeviceId,
                      value: _device!.publicDeviceId,
                    ),
                    _StatusTile(label: l10n.name, value: _device!.deviceName),
                    _StatusTile(
                      label: l10n.registrationStatus,
                      value: _device!.registrationStatus,
                    ),
                    _StatusTile(
                      label: l10n.requiresRepair,
                      value: _device!.requiresRePair ? l10n.yes : l10n.no,
                    ),
                    _StatusTile(
                      label: l10n.lastSeen,
                      value: _device!.lastSeenAt ?? l10n.unknown,
                    ),
                    if (_device!.isSecurityDeactivated)
                      const Card(
                        child: ListTile(
                          title: Text('Device deactivated'),
                          subtitle: Text('Security verification required'),
                        ),
                      ),
                    if (_activationCode != null)
                      Card(
                        child: ListTile(
                          title: const Text('Activation Code'),
                          subtitle: Text(
                            '${_activationCode!.code}\nExpires ${TimeOfDay.fromDateTime(_activationCode!.expiresAt).format(context)}',
                          ),
                        ),
                      ),
                  ],
                  const SizedBox(height: 24),
                  OutlinedButton.icon(
                    onPressed:
                        () => Navigator.of(
                          context,
                        ).pushNamed(FieldRoutes.languageRegion),
                    icon: const Icon(Icons.language),
                    label: Text(l10n.languageRegion),
                  ),
                  const SizedBox(height: 12),
                  ElevatedButton(
                    onPressed: _device == null ? null : _sendHeartbeat,
                    child: Text(l10n.sendHeartbeat),
                  ),
                  const SizedBox(height: 12),
                  FilledButton.icon(
                    onPressed:
                        _device == null ||
                                _device!.isSecurityDeactivated ||
                                _regenerating
                            ? null
                            : _regenerateActivationCode,
                    icon: const Icon(Icons.password),
                    label: Text(
                      _regenerating
                          ? 'Generating...'
                          : 'Regenerate Activation Code',
                    ),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(onPressed: _load, child: Text(l10n.refresh)),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed:
                        () => Navigator.of(
                          context,
                        ).pushReplacementNamed(FieldRoutes.login),
                    child: Text(l10n.backToSignIn),
                  ),
                ],
              ),
    );
  }
}

class _StatusTile extends StatelessWidget {
  const _StatusTile({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: ListTile(
        title: Text(label, style: Theme.of(context).textTheme.bodySmall),
        subtitle: Text(value, style: Theme.of(context).textTheme.bodyLarge),
      ),
    );
  }
}
