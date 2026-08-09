import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../api/field_api_client.dart';
import '../auth/field_auth_service.dart';
import '../config/app_flavor.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  String _status = 'Starting field tablet…';

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
      setState(() => _status = 'Preparing secure device identity…');
      await widget.services.keystore.ensureKeyPair();
      await FieldAuthService.ensureInstallationId(widget.services.session);

      if (await widget.services.session.isLocked()) {
        _go(FieldRoutes.locked);
        return;
      }

      final accessToken = await widget.services.session.readAccessToken();
      if (accessToken != null && accessToken.isNotEmpty) {
        setState(() => _status = 'Restoring officer session…');
        widget.services.api.accessToken = accessToken;
        try {
          await widget.services.auth.refreshSession();
          setState(() => _status = 'Applying device policy…');
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
          _go(FieldRoutes.login);
          return;
        }
      } on FieldApiException catch (error) {
        if (error.statusCode != 404) {
          _go(FieldRoutes.deviceRegistration, arguments: error.message);
          return;
        }
      }

      _go(FieldRoutes.deviceRegistration);
    } catch (error) {
      if (!mounted) return;
      setState(() => _status = error.toString());
      await Future<void>.delayed(const Duration(seconds: 2));
      _go(FieldRoutes.deviceRegistration, arguments: error.toString());
    }
  }

  void _go(String route, {Object? arguments}) {
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(route, arguments: arguments);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Center(
        child: ConstrainedBox(
          constraints: const BoxConstraints(maxWidth: 480),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(Icons.shield_outlined, size: 72, color: FieldColors.orange),
              const SizedBox(height: 24),
              Text(
                'THE EYE Field Ops',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 8),
              Text(
                AppFlavor.envName.toUpperCase(),
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 32),
              const SizedBox(
                width: 36,
                height: 36,
                child: CircularProgressIndicator(color: FieldColors.orange),
              ),
              const SizedBox(height: 16),
              Text(
                _status,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
