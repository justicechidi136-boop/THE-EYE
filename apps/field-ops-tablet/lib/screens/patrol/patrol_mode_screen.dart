import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../../api/field_api_client.dart';
import '../../services/field_app_services.dart';
import '../../services/field_offline_queue.dart';
import '../../theme/field_theme.dart';
import '../../widgets/backup_request_sheet.dart';
import '../../widgets/field_map_widget.dart';
import '../../widgets/officer_safety_panel.dart';

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
  bool _mapBusy = false;
  final List<Map<String, double>> _routePoints = [];
  List<Map<String, dynamic>> _mapMarkers = [];
  List<String> _mapLayers = [];
  Map<String, dynamic>? _mapCenter;

  @override
  void initState() {
    super.initState();
    _load();
    widget.services.events.startPolling();
  }

  @override
  void dispose() {
    widget.services.events.stopPolling();
    super.dispose();
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
      await _refreshMap();
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _busy = false;
      });
    }
  }

  Future<void> _refreshMap() async {
    setState(() => _mapBusy = true);
    try {
      await widget.services.restoreSession();
      final mapData = await widget.services.workflows.getMapContext(
        latitude: _position?.latitude,
        longitude: _position?.longitude,
      );
      if (!mounted) return;
      final markers = (mapData['markers'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const [];
      final layers = (mapData['layersEnabled'] as List?)
              ?.map((e) => e.toString())
              .toList() ??
          const [];
      setState(() {
        _mapMarkers = markers;
        _mapLayers = layers;
        _mapCenter = mapData['center'] is Map
            ? Map<String, dynamic>.from(mapData['center'] as Map)
            : null;
        _mapBusy = false;
      });
    } on FieldApiException {
      if (mounted) setState(() => _mapBusy = false);
    }
  }

  void _showBackupSheet() {
    showModalBottomSheet<bool>(
      context: context,
      isScrollControlled: true,
      backgroundColor: FieldColors.surface,
      builder: (_) => BackupRequestSheet(services: widget.services),
    );
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
                  child: FieldMapWidget(
                    markers: _mapMarkers,
                    center: _mapCenter,
                    position: _position,
                    followUnit: true,
                    layersEnabled: _mapLayers,
                    busy: _mapBusy,
                    onRefresh: _refreshMap,
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
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: _showBackupSheet,
                            child: const Text('Request backup'),
                          ),
                        ],
                        const Spacer(),
                        OfficerSafetyPanel(services: widget.services),
                        const SizedBox(height: 12),
                        _EvidencePlaceholder(),
                      ],
                    ),
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
