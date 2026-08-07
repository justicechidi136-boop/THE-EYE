import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../api/field_api_client.dart';
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

class _OperationalDashboardScreenState extends State<OperationalDashboardScreen> {
  Map<String, dynamic>? _dashboard;
  Position? _position;
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
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.high,
            timeLimit: Duration(seconds: 8),
          ),
        );
        await widget.services.workflows.updateTelemetry({
          'latitude': position.latitude,
          'longitude': position.longitude,
          'accuracyMeters': position.accuracy,
          'gpsStatus': 'active',
        });
        await widget.services.offlineQueue.flushIfOnline();
      } on Object {
        // GPS optional for dashboard render.
      }
      if (!mounted) return;
      setState(() {
        _dashboard = dashboard;
        _position = position;
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
            ElevatedButton(onPressed: _load, child: const Text('Retry')),
          ],
        ),
      );
    }

    final officer =
        Map<String, dynamic>.from(_dashboard?['officer'] as Map? ?? const {});
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
    final battery = status['batteryLevel'] ?? device['batteryLevel'];
    final lat = _position?.latitude ?? status['latitude'];
    final lng = _position?.longitude ?? status['longitude'];

    return RefreshIndicator(
      onRefresh: _load,
      child: ListView(
        padding: const EdgeInsets.all(24),
        children: [
          Text(
            'Operational dashboard',
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
                  value: shift == null
                      ? 'No active shift'
                      : shift['status']?.toString() ?? 'Active',
                  icon: Icons.schedule,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StatusCard(
                  title: 'GPS',
                  value: lat != null && lng != null
                      ? '${lat.toStringAsFixed(5)}, ${lng.toStringAsFixed(5)}'
                      : status['gpsStatus']?.toString() ?? 'Unavailable',
                  icon: Icons.gps_fixed,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StatusCard(
                  title: 'Battery',
                  value: battery != null ? '$battery%' : 'Unknown',
                  icon: Icons.battery_std,
                ),
              ),
              const SizedBox(width: 16),
              Expanded(
                child: _StatusCard(
                  title: 'Offline queue',
                  value: '$_pendingSync pending',
                  icon: Icons.cloud_upload_outlined,
                ),
              ),
            ],
          ),
          const SizedBox(height: 24),
          Text('Quick actions', style: Theme.of(context).textTheme.headlineMedium),
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
                label: 'Patrol',
                icon: Icons.map,
                onTap: () => _openRoute(FieldRoutes.patrol),
              ),
              _QuickAction(
                label: 'Checkpoint',
                icon: Icons.fact_check_outlined,
                onTap: () => _openRoute(FieldRoutes.checkpoint),
              ),
              _QuickAction(
                label: 'Assignments',
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
                label: 'Drone',
                icon: Icons.flight,
                onTap: () => _openRoute(FieldRoutes.drone),
              ),
              _QuickAction(
                label: 'Comms',
                icon: Icons.forum_outlined,
                onTap: () => _openRoute(FieldRoutes.comms),
              ),
              _QuickAction(
                label: 'Sync',
                icon: Icons.sync,
                onTap: () async {
                  final messenger = ScaffoldMessenger.of(context);
                  await widget.services.offlineQueue.flushIfOnline();
                  if (!context.mounted) return;
                  messenger.showSnackBar(
                    const SnackBar(content: Text('Sync attempted')),
                  );
                  await _load();
                },
              ),
              _QuickAction(
                label: 'Emergency',
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
            Text(value, style: Theme.of(context).textTheme.labelLarge),
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
