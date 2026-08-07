import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../api/field_api_client.dart';
import '../../services/field_app_services.dart';
import '../../services/field_offline_queue.dart';
import '../../theme/field_theme.dart';

class PatrolModeScreen extends StatefulWidget {
  const PatrolModeScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<PatrolModeScreen> createState() => _PatrolModeScreenState();
}

class _PatrolModeScreenState extends State<PatrolModeScreen> {
  Map<String, dynamic>? _patrol;
  Position? _position;
  String? _error;
  bool _busy = true;
  bool _recordingRoute = false;
  final List<Map<String, double>> _routePoints = [];

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
      final patrol = await widget.services.workflows.getActivePatrol();
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition();
      } on Object {
        // GPS optional.
      }
      if (!mounted) return;
      setState(() {
        _patrol = patrol;
        _position = position;
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

  Future<void> _startPatrol() async {
    await widget.services.restoreSession();
    Position? position = _position;
    try {
      position ??= await Geolocator.getCurrentPosition();
    } on Object {
      // GPS optional when starting patrol offline.
    }
    final clientActionId = widget.services.offlineQueue.newClientActionId();
    final body = {
      'patrolZoneLabel': 'Sector patrol',
      'clientActionId': clientActionId,
      if (position != null) ...{
        'latitude': position.latitude,
        'longitude': position.longitude,
      },
    };
    try {
      await widget.services.workflows.startPatrol(body);
    } on FieldApiException {
      await widget.services.offlineQueue.enqueue(
        type: FieldOfflineActionType.patrol,
        payload: body,
        clientActionId: clientActionId,
      );
    }
    await _load();
  }

  Future<void> _recordLocation() async {
    final position = await Geolocator.getCurrentPosition();
    final clientActionId = widget.services.offlineQueue.newClientActionId();
    final body = {
      'latitude': position.latitude,
      'longitude': position.longitude,
      'accuracyMeters': position.accuracy,
      'clientActionId': clientActionId,
    };
    if (_recordingRoute) {
      setState(() {
        _routePoints.add({
          'lat': position.latitude,
          'lng': position.longitude,
        });
      });
    }
    try {
      await widget.services.workflows.recordPatrolLocation(body);
    } on FieldApiException {
      await widget.services.offlineQueue.enqueue(
        type: FieldOfflineActionType.patrolLocation,
        payload: body,
        clientActionId: clientActionId,
      );
    }
    setState(() => _position = position);
  }

  Future<void> _endPatrol() async {
    await widget.services.restoreSession();
    try {
      await widget.services.workflows.endPatrol();
    } on FieldApiException {
      await widget.services.offlineQueue.enqueue(
        type: FieldOfflineActionType.patrol,
        payload: {'action': 'end'},
      );
    }
    setState(() {
      _recordingRoute = false;
      _routePoints.clear();
    });
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Patrol mode'),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
      ),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : Row(
              children: [
                Expanded(
                  flex: 3,
                  child: _MapShell(
                    position: _position,
                    zoneLabel: _patrol?['patrolZoneLabel']?.toString(),
                    routePoints: _routePoints,
                  ),
                ),
                SizedBox(
                  width: 320,
                  child: Padding(
                    padding: const EdgeInsets.all(16),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        if (_error != null) ...[
                          Text(_error!, style: const TextStyle(color: FieldColors.danger)),
                          const SizedBox(height: 12),
                        ],
                        Text(
                          _patrol == null ? 'Patrol inactive' : 'Patrol active',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: 8),
                        Text(
                          _position == null
                              ? 'GPS acquiring…'
                              : '${_position!.latitude.toStringAsFixed(5)}, '
                                  '${_position!.longitude.toStringAsFixed(5)}',
                        ),
                        const SizedBox(height: 24),
                        if (_patrol == null)
                          ElevatedButton(
                            onPressed: _startPatrol,
                            child: const Text('Start patrol'),
                          )
                        else ...[
                          ElevatedButton(
                            onPressed: _recordLocation,
                            child: const Text('Record GPS point'),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: () =>
                                setState(() => _recordingRoute = !_recordingRoute),
                            child: Text(
                              _recordingRoute
                                  ? 'Stop route recording'
                                  : 'Start route recording',
                            ),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: _endPatrol,
                            child: const Text('End patrol'),
                          ),
                        ],
                        const Spacer(),
                        _EvidencePlaceholder(),
                        const SizedBox(height: 12),
                        ElevatedButton(
                          style: ElevatedButton.styleFrom(
                            backgroundColor: FieldColors.danger,
                            foregroundColor: FieldColors.white,
                          ),
                          onPressed: () {
                            ScaffoldMessenger.of(context).showSnackBar(
                              const SnackBar(
                                content: Text('Emergency signal placeholder'),
                              ),
                            );
                          },
                          child: const Text('EMERGENCY'),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
    );
  }
}

class _MapShell extends StatelessWidget {
  const _MapShell({
    this.position,
    this.zoneLabel,
    required this.routePoints,
  });

  final Position? position;
  final String? zoneLabel;
  final List<Map<String, double>> routePoints;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: FieldColors.surfaceElevated,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FieldColors.orange.withValues(alpha: 0.4)),
      ),
      child: Stack(
        children: [
          Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.map, size: 72, color: FieldColors.muted),
                const SizedBox(height: 12),
                Text(
                  zoneLabel ?? 'Patrol zone',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                const SizedBox(height: 8),
                Text(
                  position == null
                      ? 'Waiting for GPS fix'
                      : 'Lat ${position!.latitude.toStringAsFixed(5)} · '
                          'Lng ${position!.longitude.toStringAsFixed(5)}',
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (routePoints.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text('Route points: ${routePoints.length}'),
                ],
              ],
            ),
          ),
          Positioned(
            top: 16,
            left: 16,
            child: Chip(
              label: Text(zoneLabel ?? 'Unassigned zone'),
              backgroundColor: FieldColors.surface,
            ),
          ),
        ],
      ),
    );
  }
}

class _EvidencePlaceholder extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Evidence', style: Theme.of(context).textTheme.labelLarge),
            const SizedBox(height: 8),
            Row(
              children: [
                OutlinedButton(
                  onPressed: () {},
                  child: const Text('Photo'),
                ),
                const SizedBox(width: 8),
                OutlinedButton(
                  onPressed: () {},
                  child: const Text('Video'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
