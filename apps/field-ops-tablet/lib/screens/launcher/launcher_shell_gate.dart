import 'package:flutter/material.dart';

import '../../config/field_device_mode.dart';
import '../../launcher/launcher_policy.dart';
import '../../services/field_app_services.dart';
import '../home_screen.dart';
import '../routes.dart';
import 'device_lock_screen.dart';
import 'field_launcher_home_screen.dart';

/// Chooses STANDARD_APP home vs FIELD_LAUNCHER shell after auth.
class LauncherShellGate extends StatefulWidget {
  const LauncherShellGate({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<LauncherShellGate> createState() => _LauncherShellGateState();
}

class _LauncherShellGateState extends State<LauncherShellGate> {
  LauncherPolicy? _policy;
  Object? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    try {
      await widget.services.restoreSession();
      final policy = await widget.services.launcherPolicy.bootstrap();
      if (!mounted) return;
      setState(() {
        _policy = policy;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error;
        _loading = false;
      });
    }
  }

  Future<LauncherPolicy> _refresh() =>
      widget.services.launcherPolicy.fetchRemote();

  @override
  Widget build(BuildContext context) {
    if (_loading) {
      return const Scaffold(
        body: Center(child: CircularProgressIndicator()),
      );
    }
    if (_error != null && _policy == null) {
      return HomeScreen(services: widget.services);
    }

    final policy = _policy!;
    if (policy.locked) {
      return DeviceLockScreen(
        reason: policy.lockReason ?? 'Device locked',
        deviceReference: policy.deviceReference ?? 'unknown',
        policy: policy,
      );
    }

    if (FieldDeviceModeConfig.isLauncherShell(policy.deviceMode) ||
        policy.launcherEnabled) {
      return FieldLauncherHomeScreen(
        services: widget.services,
        policy: policy,
        onRefreshPolicy: () async {
          final next = await _refresh();
          if (mounted) setState(() => _policy = next);
          return next;
        },
      );
    }

    return HomeScreen(services: widget.services);
  }
}

String homeRouteForPolicy(LauncherPolicy? policy) {
  if (policy == null) return FieldRoutes.home;
  if (policy.locked) return FieldRoutes.deviceLock;
  if (FieldDeviceModeConfig.isLauncherShell(policy.deviceMode) ||
      policy.launcherEnabled) {
    return FieldRoutes.launcherHome;
  }
  return FieldRoutes.home;
}
