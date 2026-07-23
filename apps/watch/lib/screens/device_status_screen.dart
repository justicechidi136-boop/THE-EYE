import 'package:flutter/material.dart';

import '../location/location_permission_service.dart';
import '../services/watch_app_services.dart';
import '../theme/eye_colors.dart';
import '../widgets/watch_ui.dart';

class DeviceStatusScreen extends StatefulWidget {
  const DeviceStatusScreen({super.key, required this.services});

  final WatchAppServices services;

  @override
  State<DeviceStatusScreen> createState() => _DeviceStatusScreenState();
}

class _DeviceStatusScreenState extends State<DeviceStatusScreen> {
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _refresh();
  }

  Future<void> _refresh() async {
    setState(() => _loading = true);
    await widget.services.heartbeat.sendHeartbeat();
    await widget.services.location.readPermissionState();
    if (mounted) setState(() => _loading = false);
  }

  String _gpsLabel() {
    final access = widget.services.location.lastAccess;
    final permission = access?.state;
    if (permission == WatchLocationPermissionState.serviceDisabled) {
      return 'Location off';
    }
    if (permission == WatchLocationPermissionState.denied ||
        permission == WatchLocationPermissionState.deniedPermanently) {
      return 'Permission blocked';
    }
    if (access?.hasFix == true) {
      final age = access!.ageSeconds;
      if (access.isCached && age != null) {
        return 'Cached ${age}s';
      }
      return 'Live fix';
    }
    if (widget.services.location.isEmergencyActive) {
      return 'Retrying';
    }
    return 'Waiting';
  }

  @override
  Widget build(BuildContext context) {
    final status = widget.services.heartbeat.latest;
    return WatchScreenShell(
      child: _loading && status == null
          ? const Center(
              child: CircularProgressIndicator(
                color: EyeColors.green,
                strokeWidth: 2,
              ),
            )
          : Column(
              children: [
                const WatchSectionTitle('Device Status'),
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: [
                    WatchMetricColumn(
                      value: '${status?.batteryLevel ?? '—'}%',
                      label: 'Battery',
                    ),
                    WatchMetricColumn(
                      value: '${status?.signalStrength ?? '—'}%',
                      label: 'Signal',
                    ),
                  ],
                ),
                const SizedBox(height: 12),
                WatchInfoRow(
                  label: 'Firmware',
                  value: status?.firmwareVersion ?? '0.1.0',
                ),
                WatchInfoRow(
                  label: 'Mode',
                  value: status?.connectivityMode.apiValue ?? 'Unknown',
                  valueColor: EyeColors.green,
                ),
                WatchInfoRow(
                  label: 'GPS',
                  value: _gpsLabel(),
                  valueColor: EyeColors.green,
                ),
                WatchInfoRow(
                  label: 'Last seen',
                  value: status?.lastSeenAt
                          ?.toLocal()
                          .toString()
                          .substring(0, 16) ??
                      '—',
                ),
                const Spacer(),
                WatchOutlineButton(label: 'Refresh', onPressed: _refresh),
                const SizedBox(height: 8),
              ],
            ),
    );
  }
}
