import 'dart:async';

import 'package:flutter/material.dart';

import '../api/field_api_client.dart';
import '../device/field_device_service.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class ApprovalPendingScreen extends StatefulWidget {
  const ApprovalPendingScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<ApprovalPendingScreen> createState() => _ApprovalPendingScreenState();
}

class _ApprovalPendingScreenState extends State<ApprovalPendingScreen> {
  Timer? _pollTimer;
  FieldDeviceRecord? _device;
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _refresh();
    _pollTimer = Timer.periodic(const Duration(seconds: 15), (_) => _refresh());
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final device = await widget.services.devices.registrationStatus();
      if (!mounted) return;
      setState(() {
        _device = device;
        _error = null;
        _busy = false;
      });

      if (device.isActive) {
        if (device.requiresRePair) {
          final challenge = await widget.services.devices.createChallenge();
          await widget.services.devices.completePairing(
            publicDeviceId: device.publicDeviceId,
            signedChallenge: challenge,
          );
        }
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed(FieldRoutes.login);
      } else if (device.isBlocked) {
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed(FieldRoutes.unauthorized);
      }
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _busy = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Approval pending'),
        backgroundColor: FieldColors.surface,
      ),
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 560),
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(Icons.hourglass_top, size: 72, color: FieldColors.orange),
                const SizedBox(height: 24),
                Text(
                  'Waiting for supervisor approval',
                  style: Theme.of(context).textTheme.headlineMedium,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 12),
                Text(
                  _device?.publicDeviceId ?? 'Checking registration…',
                  style: Theme.of(context).textTheme.bodySmall,
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 24),
                if (_busy)
                  const CircularProgressIndicator(color: FieldColors.orange)
                else
                  OutlinedButton(
                    onPressed: _refresh,
                    child: const Text('Refresh now'),
                  ),
                if (_error != null) ...[
                  const SizedBox(height: 16),
                  Text(
                    _error!,
                    style: const TextStyle(color: FieldColors.danger),
                    textAlign: TextAlign.center,
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
