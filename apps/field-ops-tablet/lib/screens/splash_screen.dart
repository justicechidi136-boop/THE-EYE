import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/field_api_client.dart';
import '../auth/field_auth_service.dart';
import '../config/app_flavor.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_branding.dart';
import '../theme/field_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  String _status = 'Initializing…';

  @override
  void initState() {
    super.initState();
    SystemChrome.setPreferredOrientations([
      DeviceOrientation.landscapeLeft,
      DeviceOrientation.landscapeRight,
    ]);
    _boot();
  }

  Future<void> _boot() async {
    try {
      setState(() => _status = 'Initializing secure device…');
      await widget.services.keystore.ensureKeyPair();
      await FieldAuthService.ensureInstallationId(widget.services.session);

      if (await widget.services.session.isLocked()) {
        _go(FieldRoutes.locked);
        return;
      }

      final accessToken = await widget.services.session.readAccessToken();
      if (accessToken != null && accessToken.isNotEmpty) {
        setState(() => _status = 'Restoring field session…');
        widget.services.api.accessToken = accessToken;
        try {
          await widget.services.auth.refreshSession();
          setState(() => _status = 'Loading field policy…');
          try {
            final policy = await widget.services.launcherPolicy.bootstrap();
            if (policy.locked) {
              _go(
                FieldRoutes.deviceLock,
                arguments: {
                  'reason': policy.lockReason ?? 'Device locked',
                  'deviceReference': policy.deviceReference ?? 'unknown',
                },
              );
              return;
            }
          } catch (_) {
            // Degraded: continue to home gate which uses cached/default policy.
          }
          setState(() => _status = 'Ready');
          _go(FieldRoutes.home);
          return;
        } on FieldApiException {
          await widget.services.session.clearSession();
        }
      }

      setState(() => _status = 'Checking device registration…');
      try {
        final device = await widget.services.devices.registrationStatus();
        if (device.isBlocked) {
          _go(FieldRoutes.unauthorized);
          return;
        }
        if (device.isPendingApproval) {
          _go(FieldRoutes.approvalPending);
          return;
        }
        if (device.isActive) {
          if (device.requiresRePair) {
            setState(() => _status = 'Completing device pairing…');
            final challenge = await widget.services.devices.createChallenge();
            await widget.services.devices.completePairing(
              publicDeviceId: device.publicDeviceId,
              signedChallenge: challenge,
            );
          }
          setState(() => _status = 'Ready');
          _go(FieldRoutes.login);
          return;
        }
      } on FieldApiException catch (error) {
        if (error.statusCode != 404) {
          _go(FieldRoutes.deviceRegistration, arguments: error.message);
          return;
        }
      }

      setState(() => _status = 'Ready');
      _go(FieldRoutes.deviceRegistration);
    } catch (_) {
      if (!mounted) return;
      setState(() => _status = 'Unable to finish startup. Continuing…');
      await Future<void>.delayed(const Duration(seconds: 2));
      _go(FieldRoutes.deviceRegistration);
    }
  }

  void _go(String route, {Object? arguments}) {
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(route, arguments: arguments);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FieldColors.dark,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 24),
            child: ConstrainedBox(
              constraints: const BoxConstraints(maxWidth: 520),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  FieldOpsBrandHeader(logoSize: 148, status: _status),
                  const SizedBox(height: 12),
                  Text(
                    AppFlavor.envName.toUpperCase(),
                    style: Theme.of(context).textTheme.bodySmall,
                  ),
                  const SizedBox(height: 28),
                  const SizedBox(
                    width: 36,
                    height: 36,
                    child: CircularProgressIndicator(color: FieldColors.orange),
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
