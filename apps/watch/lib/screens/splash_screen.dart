import 'package:flutter/material.dart';

import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../startup/watch_boot_screen.dart';

/// Entry splash — branded [WatchBootScreen] shown after the native Android splash.
class SplashScreen extends StatelessWidget {
  const SplashScreen({
    super.key,
    required this.services,
    required this.launcher,
    this.firebaseReady = false,
    this.firebaseError,
  });

  final WatchAppServices services;
  final LauncherService launcher;

  /// Retained for call-site compatibility; boot screen owns Firebase init.
  final bool firebaseReady;
  final String? firebaseError;

  @override
  Widget build(BuildContext context) {
    return WatchBootScreen(
      services: services,
      launcher: launcher,
    );
  }
}
