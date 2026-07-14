import 'package:flutter/material.dart';

import '../config/watch_flavor.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({
    super.key,
    required this.services,
    required this.launcher,
    this.firebaseReady = false,
    this.firebaseError,
  });

  final WatchAppServices services;
  final LauncherService launcher;
  final bool firebaseReady;
  final String? firebaseError;

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    _boot();
  }

  Future<void> _boot() async {
    await widget.services.initialize(firebaseReady: widget.firebaseReady);
    if (!mounted) return;

    if (!WatchFlavor.isManagedLauncher) {
      final dismissed =
          await widget.services.preferences.isLauncherOnboardingDismissed();
      final isDefault = await widget.launcher.isDefaultHome();
      if (!dismissed && !isDefault) {
        if (!mounted) return;
        Navigator.of(context).pushReplacementNamed(
          WatchRoutes.defaultHomeOnboarding,
        );
        return;
      }
    }

    if (!mounted) return;
    final destination = widget.services.pairing.state.isPaired
        ? WatchRoutes.locationOnboarding
        : WatchRoutes.pairing;
    Navigator.of(context).pushReplacementNamed(destination);
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    return WatchScreenShell(
      showTopBar: false,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Text(
              '${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}',
              style: const TextStyle(
                color: EyeColors.white,
                fontSize: 28,
                fontWeight: FontWeight.w700,
              ),
            ),
            const SizedBox(height: 8),
            const WatchLogomark(size: 70),
            const SizedBox(height: 16),
            const Text(
              'Community Safety',
              style: TextStyle(color: EyeColors.muted, fontSize: 11),
            ),
            if (widget.firebaseError != null) ...[
              const SizedBox(height: 8),
              Text(
                'Sync pending',
                style: TextStyle(
                  color: EyeColors.muted.withValues(alpha: 0.7),
                  fontSize: 9,
                ),
              ),
            ],
            const SizedBox(height: 20),
            const SizedBox(
              width: 24,
              height: 24,
              child: CircularProgressIndicator(
                color: EyeColors.green,
                strokeWidth: 2,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
