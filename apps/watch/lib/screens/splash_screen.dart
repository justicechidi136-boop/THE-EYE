import 'package:flutter/material.dart';

import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';
import 'routes.dart';

class SplashScreen extends StatefulWidget {
  const SplashScreen({
    super.key,
    required this.services,
    this.firebaseReady = false,
  });

  final WatchAppServices services;
  final bool firebaseReady;

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
    final destination = widget.services.pairing.state.isPaired
        ? WatchRoutes.home
        : WatchRoutes.pairing;
    Navigator.of(context).pushReplacementNamed(destination);
  }

  @override
  Widget build(BuildContext context) {
    return WatchScreenShell(
      showTopBar: false,
      child: Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const WatchLogomark(size: 70),
            const SizedBox(height: 16),
            const Text(
              'THE EYE',
              style: TextStyle(
                color: EyeColors.white,
                fontSize: 14,
                fontWeight: FontWeight.w600,
              ),
            ),
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
