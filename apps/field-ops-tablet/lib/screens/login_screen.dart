import 'package:flutter/material.dart';

import '../api/field_api_client.dart';
import '../config/app_flavor.dart';
import '../l10n/generated/field_localizations.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_branding.dart';
import '../theme/field_theme.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  bool _busy = false;
  String? _error;
  String? _deviceLabel;

  @override
  void initState() {
    super.initState();
    _loadDeviceLabel();
  }

  Future<void> _loadDeviceLabel() async {
    final publicDeviceId = await widget.services.session.readPublicDeviceId();
    if (!mounted || publicDeviceId == null || publicDeviceId.isEmpty) return;
    setState(() => _deviceLabel = publicDeviceId);
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() {
      _busy = true;
      _error = null;
    });

    try {
      final publicDeviceId = await widget.services.session.readPublicDeviceId();
      if (publicDeviceId == null || publicDeviceId.isEmpty) {
        throw StateError('Device is not registered yet');
      }

      await widget.services.auth.login(
        email: _emailController.text,
        password: _passwordController.text,
        publicDeviceId: publicDeviceId,
      );

      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed(FieldRoutes.home);
    } on FieldApiException catch (error) {
      setState(() => _error = error.message);
      if (error.code == 'DEVICE_APPROVAL_PENDING') {
        Navigator.of(context).pushReplacementNamed(FieldRoutes.approvalPending);
      } else if (error.statusCode == 401 || error.statusCode == 403) {
        Navigator.of(context).pushReplacementNamed(FieldRoutes.unauthorized);
      }
    } catch (error) {
      setState(() => _error = error.toString());
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      backgroundColor: FieldColors.dark,
      appBar: AppBar(
        title: Text(l10n.officerSignIn),
        backgroundColor: FieldColors.surface,
      ),
      body: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(32),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 520),
            child: Form(
              key: _formKey,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  const FieldOpsBrandHeader(logoSize: 96, compact: true),
                  const SizedBox(height: 8),
                  Text(
                    l10n.fieldOperations,
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      letterSpacing: 1.2,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                  if (_deviceLabel != null) ...[
                    const SizedBox(height: 8),
                    Text(
                      '${l10n.device} - $_deviceLabel',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
                  if (AppFlavor.isStaging) ...[
                    const SizedBox(height: 4),
                    Text(
                      'STAGING',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: FieldColors.orange,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                  const SizedBox(height: 24),
                  Text(
                    l10n.signInWithCredentials,
                    style: Theme.of(context).textTheme.bodyLarge,
                  ),
                  const SizedBox(height: 24),
                  TextFormField(
                    controller: _emailController,
                    keyboardType: TextInputType.emailAddress,
                    autofillHints: const [AutofillHints.username],
                    decoration: InputDecoration(labelText: l10n.email),
                    validator:
                        (value) =>
                            value == null || value.trim().isEmpty
                                ? l10n.emailRequired
                                : null,
                  ),
                  const SizedBox(height: 16),
                  TextFormField(
                    controller: _passwordController,
                    obscureText: true,
                    autofillHints: const [AutofillHints.password],
                    decoration: InputDecoration(labelText: l10n.password),
                    validator:
                        (value) =>
                            value == null || value.isEmpty
                                ? l10n.passwordRequired
                                : null,
                  ),
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      style: const TextStyle(color: FieldColors.danger),
                    ),
                  ],
                  const SizedBox(height: 24),
                  ElevatedButton(
                    onPressed: _busy ? null : _submit,
                    child:
                        _busy
                            ? const SizedBox(
                              width: 24,
                              height: 24,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                            : Text(l10n.signIn),
                  ),
                  const SizedBox(height: 12),
                  OutlinedButton(
                    onPressed:
                        _busy
                            ? null
                            : () => Navigator.of(
                              context,
                            ).pushReplacementNamed(FieldRoutes.deviceStatus),
                    child: Text(l10n.deviceStatus),
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
