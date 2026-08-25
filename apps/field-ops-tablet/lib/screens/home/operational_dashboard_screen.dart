import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../screens/routes.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class OperationalDashboardScreen extends StatefulWidget {
  const OperationalDashboardScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<OperationalDashboardScreen> createState() =>
      _OperationalDashboardScreenState();
}

class _OperationalDashboardScreenState
    extends State<OperationalDashboardScreen> {
  Map<String, dynamic>? _dashboard;
  Position? _position;
  String? _locationLabel;
  int? _batteryLevel;
  String? _error;
  bool _busy = true;
  int _pendingSync = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final pending = await widget.services.offlineQueue.pendingCount();
      final dashboard = await widget.services.workflows.getDashboard();
      final batteryLevel =
          await widget.services.deviceContext.readBatteryLevel();
      Position? position;
      String? locationLabel;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 8),
          ),
        );
        locationLabel = await widget.services.deviceContext.reverseGeocode(
          latitude: position.latitude,
          longitude: position.longitude,
        );
        await widget.services.workflows.updateTelemetry({
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracyMeters': position.accuracy,
          'gpsStatus': 'active',
          if (batteryLevel != null) 'batteryLevel': batteryLevel,
        });
        await widget.services.offlineQueue.flushIfOnline();
      } on Object {
        // GPS optional for dashboard render.
      }
      if (!mounted) return;
      setState(() {
        _dashboard = dashboard;
        _position = position;
        _locationLabel = locationLabel;
        _batteryLevel = batteryLevel;
        _pendingSync = pending;
        _busy = false;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _busy = false;
      });
    }
  }

  void _openRoute(String route, {Object? arguments}) {
    Navigator.of(context).pushNamed(route, arguments: arguments);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    if (_busy) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_error != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(_error!, style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 16),
            ElevatedButton(onPressed: _load, child: Text(l10n.retry)),
          ],
        ),
      );
    }

    final officer = Map<String, dynamic>.from(
      _dashboard?['officer'] as Map? ?? const {},
    );
    final shift = _dashboard?['shift'] as Map?;
    final status = Map<String, dynamic>.from(
      _dashboard?['status'] as Map? ?? const {},
    );
    final device = Map<String, dynamic>.from(
      _dashboard?['device'] as Map? ?? const {},
    );
    final counts = Map<String, dynamic>.from(
      _dashboard?['counts'] as Map? ?? const {},
    );
    final battery =
        _batteryLevel ?? status['batteryLevel'] ?? device['batteryLevel'];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            l10n.operationalDashboard,
            style: Theme.of(context).textTheme.headlineLarge,
          ),
          const SizedBox(height: 8),
          Text(
            officer['displayName']?.toString() ?? 'Officer',
            style: Theme.of(context).textTheme.bodyLarge,
          ),
          const SizedBox(height: 24),
          Row(
            children: [
              Expanded(
                child: _StatusCard(
                  title: 'Shift',
                  value:
                      shift == null
                          ? l10n.noActiveShift
                          : shift['status']?.toString() ?? l10n.active,
                  icon: Icons.schedule,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StatusCard(
                  title: l10n.currentLocation,
                  value:
                      _locationLabel ??
                      (_position != null
                          ? l10n.locationDetected
                          : l10n.locationUnavailable),
                  icon: Icons.gps_fixed,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StatusCard(
                  title: l10n.battery,
                  value: battery != null ? '$battery%' : l10n.unknown,
                  icon: Icons.battery_std,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StatusCard(
                  title: l10n.offlineQueue,
                  value: l10n.pendingCount(_pendingSync),
                  icon: Icons.cloud_upload_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text(
            l10n.quickActions,
            style: Theme.of(context).textTheme.headlineMedium,
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 4,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.4,
            children: [
              _QuickAction(
                label: l10n.patrol,
                icon: Icons.map,
                onTap: () => _openRoute(FieldRoutes.patrol),
              ),
              _QuickAction(
                label: l10n.checkpoint,
                icon: Icons.fact_check_outlined,
                onTap: () => _openRoute(FieldRoutes.checkpoint),
              ),
              _QuickAction(
                label: l10n.assignments,
                icon: Icons.assignment,
                count: counts['activeAssignments'] as int?,
                onTap: () => _openRoute(FieldRoutes.assignments),
              ),
              _QuickAction(
                label: 'BOLO',
                icon: Icons.search,
                onTap: () => _openRoute(FieldRoutes.bolo),
              ),
              _QuickAction(
                label: l10n.drone,
                icon: Icons.flight,
                onTap: () => _openRoute(FieldRoutes.drone),
              ),
              _QuickAction(
                label: l10n.comms,
                icon: Icons.forum_outlined,
                onTap: () => _openRoute(FieldRoutes.comms),
              ),
              _QuickAction(
                label: l10n.sync,
                icon: Icons.sync,
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  await widget.services.offlineQueue.flushIfOnline();
                  if (!context.mounted) return;
                  messenger.showSnackBar(
                    SnackBar(content: Text(l10n.syncAttempted)),
                  );
                  await _load();
                },
              ),
              _QuickAction(
                label: l10n.emergency,
                icon: Icons.emergency,
                color: FieldColors.danger,
                onTap: () => _openRoute(FieldRoutes.patrol),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _StatusCard extends StatelessWidget {
  const _StatusCard({
    required this.title,
    required this.value,
    required this.icon,
  });

  final String title;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: FieldColors.orange),
            const SizedBox(height: 8),
            Text(title, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 4),
            Text(
              value,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelLarge,
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickAction extends StatelessWidget {
  const _QuickAction({
    required this.label,
    required this.icon,
    required this.onTap,
    this.count,
    this.color,
  });

  final String label;
  final IconData icon;
  final VoidCallback onTap;
  final int? count;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: FieldColors.surfaceElevated,
      borderRadius: BorderRadius.circular(14),
      child: InkWell(
        borderRadius: BorderRadius.circular(14),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Stack(
                clipBehavior: Clip.none,
                children: [
                  Icon(icon, color: color ?? FieldColors.orange, size: 32),
                  if (count != null && count! > 0)
                    Positioned(
                      right: -8,
                      top: -8,
                      child: CircleAvatar(
                        radius: 10,
                        backgroundColor: FieldColors.danger,
                        child: Text(
                          '$count',
                          style: const TextStyle(fontSize: 10),
                        ),
                      ),
                    ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
