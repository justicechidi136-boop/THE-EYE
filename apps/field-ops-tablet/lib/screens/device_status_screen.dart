import 'package:flutter/material.dart';

import '../api/field_api_client.dart';
import '../device/field_device_service.dart';
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
  bool _busy = true;

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
    final publicDeviceId = _device?.publicDeviceId ??
        await widget.services.session.readPublicDeviceId();
    if (publicDeviceId == null || publicDeviceId.isEmpty) return;

    await widget.services.auth.restoreApiToken();
    await widget.services.devices.heartbeat(publicDeviceId: publicDeviceId);
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Heartbeat sent')),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Device status'),
        backgroundColor: FieldColors.surface,
      ),
      body: _busy
          ? const Center(
              child: CircularProgressIndicator(color: FieldColors.orange),
            )
          : ListView(
              padding: const EdgeInsets.all(32),
              children: [
                if (_error != null)
                  Text(_error!, style: const TextStyle(color: FieldColors.danger)),
                if (_device != null) ...[
                  _StatusTile(label: 'Public device ID', value: _device!.publicDeviceId),
                  _StatusTile(label: 'Name', value: _device!.deviceName),
                  _StatusTile(
                    label: 'Registration status',
                    value: _device!.registrationStatus,
                  ),
                  _StatusTile(
                    label: 'Requires re-pair',
                    value: _device!.requiresRePair ? 'Yes' : 'No',
                  ),
                  _StatusTile(
                    label: 'Last seen',
                    value: _device!.lastSeenAt ?? 'Unknown',
                  ),
                ],
                const SizedBox(height: 24),
                ElevatedButton(
                  onPressed: _device == null ? null : _sendHeartbeat,
                  child: const Text('Send heartbeat'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: _load,
                  child: const Text('Refresh'),
                ),
                const SizedBox(height: 12),
                OutlinedButton(
                  onPressed: () =>
                      Navigator.of(context).pushReplacementNamed(FieldRoutes.login),
                  child: const Text('Back to sign in'),
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
