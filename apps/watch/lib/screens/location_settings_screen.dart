import 'dart:async';

import 'package:flutter/material.dart';

import '../location/location_permission_service.dart';
import '../services/launcher_service.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

class LocationSettingsScreen extends StatefulWidget {
  const LocationSettingsScreen({
    super.key,
    required this.services,
    required this.launcher,
  });

  final WatchAppServices services;
  final LauncherService launcher;

  @override
  State<LocationSettingsScreen> createState() => _LocationSettingsScreenState();
}

class _LocationSettingsScreenState extends State<LocationSettingsScreen> {
  WatchLocationAccessResult? _access;
  WatchLocationPermissionState? _permission;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    final permission = await widget.services.location.readPermissionState();
    final access = await widget.services.location.resolveAccess(
      requestIfDenied: false,
      allowCachedFallback: true,
    );
    if (!mounted) return;
    setState(() {
      _permission = permission;
      _access = access;
      _loading = false;
    });
  }

  String _permissionLabel(WatchLocationPermissionState? state) {
    switch (state) {
      case WatchLocationPermissionState.grantedPrecise:
        return 'Precise allowed';
      case WatchLocationPermissionState.grantedApproximate:
        return 'Approximate allowed';
      case WatchLocationPermissionState.denied:
        return 'Denied';
      case WatchLocationPermissionState.deniedPermanently:
        return 'Blocked';
      case WatchLocationPermissionState.serviceDisabled:
        return 'Location off';
      case WatchLocationPermissionState.restricted:
        return 'Restricted';
      case WatchLocationPermissionState.timedOut:
        return 'Timed out';
      case WatchLocationPermissionState.unavailable:
        return 'Unavailable';
      case WatchLocationPermissionState.notRequested:
      case null:
        return 'Not requested';
      case WatchLocationPermissionState.acquiring:
        return 'Acquiring';
      case WatchLocationPermissionState.error:
        return 'Error';
    }
  }

  @override
  Widget build(BuildContext context) {
    final access = _access;
    return WatchScreenShell(
      child: _loading
          ? const Center(
              child: CircularProgressIndicator(
                color: EyeColors.green,
                strokeWidth: 2,
              ),
            )
          : Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const WatchSectionTitle('Location'),
                WatchInfoRow(
                  label: 'Permission',
                  value: _permissionLabel(_permission),
                ),
                WatchInfoRow(
                  label: 'Tracking',
                  value: widget.services.location.isEmergencyActive
                      ? 'Emergency'
                      : 'Idle/off',
                ),
                WatchInfoRow(
                  label: 'Last fix',
                  value: access?.position == null
                      ? 'None'
                      : '${access!.position!.latitude.toStringAsFixed(4)}, ${access.position!.longitude.toStringAsFixed(4)}',
                ),
                WatchInfoRow(
                  label: 'Accuracy',
                  value: access?.position?.accuracy == null
                      ? '—'
                      : '±${access!.position!.accuracy.toStringAsFixed(0)} m',
                ),
                WatchInfoRow(
                  label: 'Fix age',
                  value: access?.ageSeconds == null
                      ? '—'
                      : '${access!.ageSeconds}s',
                ),
                if (access?.message.isNotEmpty == true) ...[
                  const SizedBox(height: 8),
                  Text(
                    access!.message,
                    style: const TextStyle(fontSize: 11),
                  ),
                ],
                const Spacer(),
                WatchOutlineButton(
                  label: 'Retry permission',
                  onPressed: () async {
                    await widget.services.location.requestPermission();
                    await _refresh();
                  },
                ),
                const SizedBox(height: 6),
                WatchOutlineButton(
                  label: 'Test GPS',
                  onPressed: () async {
                    await widget.services.location.resolveAccess(
                      requestIfDenied: true,
                      allowCachedFallback: true,
                    );
                    await _refresh();
                  },
                ),
                const SizedBox(height: 6),
                WatchOutlineButton(
                  label: 'Open Settings',
                  onPressed: () async {
                    await openWatchAppSettings();
                  },
                ),
                const SizedBox(height: 8),
              ],
            ),
    );
  }
}
