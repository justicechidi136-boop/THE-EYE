import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/field_api_client.dart';
import '../auth/field_auth_service.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class DeviceRegistrationScreen extends StatefulWidget {
  const DeviceRegistrationScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<DeviceRegistrationScreen> createState() =>
      _DeviceRegistrationScreenState();
}

class _DeviceRegistrationScreenState extends State<DeviceRegistrationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _deviceNameController =
      TextEditingController(text: 'Field Ops Tablet');
  final _adminTokenController = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _publicKey;
  String? _installationHash;

  @override
  void initState() {
    super.initState();
    _loadIdentity();
  }

  Future<void> _loadIdentity() async {
    await widget.services.keystore.ensureKeyPair();
    final installationId =
        await FieldAuthService.ensureInstallationId(widget.services.session);
    final publicKey = await widget.services.keystore.readPublicKeyBase64();
    final installationHash =
        await FieldAuthService.hashInstallationId(installationId);
    setState(() {
      _publicKey = publicKey;
      _installationHash = installationHash;
    });
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    final adminToken = _adminTokenController.text.trim();
    if (adminToken.isEmpty) {
      setState(() => _error =
          'Supervisor access token required to submit registration.');
      return;
    }

    setState(() {
      _busy = true;
      _error = null;
    });

    final previousToken = widget.services.api.accessToken;
    widget.services.api.accessToken = adminToken;

    try {
      final challenge = await widget.services.devices.createChallenge();
      final device = await widget.services.devices.registerDevice(
        deviceName: _deviceNameController.text,
        signedChallenge: challenge,
      );

      if (!mounted) return;
      if (device.isPendingApproval) {
        Navigator.of(context).pushReplacementNamed(FieldRoutes.approvalPending);
      } else if (device.isActive) {
        Navigator.of(context).pushReplacementNamed(FieldRoutes.login);
      } else {
        Navigator.of(context).pushReplacementNamed(FieldRoutes.unauthorized);
      }
    } on FieldApiException catch (error) {
      setState(() => _error = error.message);
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      widget.services.api.accessToken = previousToken;
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  void dispose() {
    _deviceNameController.dispose();
    _adminTokenController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Device registration'),
        backgroundColor: FieldColors.surface,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 720),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Text(
                    'Register this tablet with your agency. A supervisor token '
                    'with field:device:register permission is required.',
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _deviceNameController,
                    decoration: const InputDecoration(labelText: 'Device name'),
                    validator: (value) =>
                        value == null || value.trim().isEmpty
                            ? 'Device name is required'
                            : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _adminTokenController,
                    decoration: const InputDecoration(
                      labelText: 'Supervisor access token',
                    ),
                    obscureText: true,
                  ),
                  const SizedBox(height: 24),
                  if (_publicKey != null) _IdentityCard(
                    title: 'Public key (base64)',
                    value: _publicKey!,
                  ),
                  if (_installationHash != null) ...[
                    const SizedBox(height: 12),
                    _IdentityCard(
                      title: 'Installation hash',
                      value: _installationHash!,
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(_error!, style: const TextStyle(color: FieldColors.danger)),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _busy ? null : _submit,
                    child: _busy
                        ? const SizedBox(
                            width: 24,
                            height: 24,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Submit registration'),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _IdentityCard extends StatelessWidget {
  const _IdentityCard({required this.title, required this.value});

  final String title;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            SelectableText(value, style: Theme.of(context).textTheme.bodyMedium),
            Align(
              alignment: Alignment.centerRight,
              child: TextButton.icon(
                onPressed: () {
                  Clipboard.setData(ClipboardData(text: value));
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Copied to clipboard')),
                  );
                },
                icon: const Icon(Icons.copy, color: FieldColors.orange),
                label: const Text('Copy'),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
