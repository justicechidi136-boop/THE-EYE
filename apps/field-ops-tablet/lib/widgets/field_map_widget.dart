import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../theme/field_theme.dart';

/// Operational map with layer toggles, recenter, and marker clustering by layer.
class FieldMapWidget extends StatefulWidget {
  const FieldMapWidget({
    super.key,
    required this.markers,
    this.center,
    this.position,
    this.followUnit = false,
    this.layersEnabled = const [],
    this.onRefresh,
    this.busy = false,
  });

  final List<Map<String, dynamic>> markers;
  final Map<String, dynamic>? center;
  final Position? position;
  final bool followUnit;
  final List<String> layersEnabled;
  final Future<void> Function()? onRefresh;
  final bool busy;

  @override
  State<FieldMapWidget> createState() => _FieldMapWidgetState();
}

class _FieldMapWidgetState extends State<FieldMapWidget> {
  final MapController _controller = MapController();
  final Set<String> _visibleLayers = {};

  @override
  void initState() {
    super.initState();
    _visibleLayers.addAll(widget.layersEnabled);
    if (_visibleLayers.isEmpty) {
      _visibleLayers.addAll({
        'currentUnit',
        'assignedIncidents',
        'fieldUnits',
        'dangerZones',
        'backupRequests',
      });
    }
  }

  LatLng? get _focusPoint {
    if (widget.followUnit && widget.position != null) {
      return LatLng(widget.position!.latitude, widget.position!.longitude);
    }
    final center = widget.center;
    if (center != null &&
        center['latitude'] != null &&
        center['longitude'] != null) {
      return LatLng(
        (center['latitude'] as num).toDouble(),
        (center['longitude'] as num).toDouble(),
      );
    }
    if (widget.position != null) {
      return LatLng(widget.position!.latitude, widget.position!.longitude);
    }
    return const LatLng(6.5244, 3.3792);
  }

  Color _markerColor(String layer, String? severity) {
    if (layer == 'currentUnit') return FieldColors.orange;
    if (layer == 'backupRequests') return FieldColors.danger;
    if (layer == 'dangerZones') return Colors.redAccent;
    if (severity == 'P1LifeThreat' || severity == 'P2Urgent') {
      return FieldColors.danger;
    }
    return FieldColors.success;
  }

  IconData _markerIcon(String layer) {
    switch (layer) {
      case 'currentUnit':
        return Icons.local_police;
      case 'assignedIncidents':
        return Icons.report;
      case 'fieldUnits':
        return Icons.directions_car;
      case 'dangerZones':
        return Icons.warning_amber;
      case 'backupRequests':
        return Icons.support_agent;
      case 'droneMissions':
        return Icons.flight;
      case 'missingPersonBroadcasts':
        return Icons.person_search;
      case 'stolenVehicleBroadcasts':
        return Icons.directions_car_filled;
      default:
        return Icons.place;
    }
  }

  void _recenter() {
    final point = _focusPoint;
    if (point == null) return;
    _controller.move(point, 14);
  }

  @override
  Widget build(BuildContext context) {
    final focus = _focusPoint ?? const LatLng(6.5244, 3.3792);
    final visible = widget.markers
        .where((m) => _visibleLayers.contains(m['layer']?.toString()))
        .toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        SizedBox(
          height: 44,
          child: ListView(
            scrollDirection: Axis.horizontal,
            padding: const EdgeInsets.symmetric(horizontal: 8),
            children: widget.layersEnabled.map((layer) {
              final selected = _visibleLayers.contains(layer);
              return Padding(
                padding: const EdgeInsets.only(right: 8),
                child: FilterChip(
                  label: Text(layer, style: const TextStyle(fontSize: 12)),
                  selected: selected,
                  onSelected: (value) {
                    setState(() {
                      if (value) {
                        _visibleLayers.add(layer);
                      } else {
                        _visibleLayers.remove(layer);
                      }
                    });
                  },
                ),
              );
            }).toList(),
          ),
        ),
        Expanded(
          child: Stack(
            children: [
              FlutterMap(
                mapController: _controller,
                options: MapOptions(
                  initialCenter: focus,
                  initialZoom: 14,
                  minZoom: 5,
                  maxZoom: 18,
                  interactionOptions: const InteractionOptions(
                    flags: InteractiveFlag.all,
                  ),
                ),
                children: [
                  TileLayer(
                    urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                    userAgentPackageName: 'com.theeye.fieldops',
                  ),
                  MarkerLayer(
                    markers: visible.map((marker) {
                      final lat = (marker['latitude'] as num?)?.toDouble();
                      final lng = (marker['longitude'] as num?)?.toDouble();
                      if (lat == null || lng == null) {
                        return Marker(
                          point: focus,
                          width: 0,
                          height: 0,
                          child: const SizedBox.shrink(),
                        );
                      }
                      final layer = marker['layer']?.toString() ?? 'unknown';
                      final color = _markerColor(
                        layer,
                        marker['severity']?.toString(),
                      );
                      return Marker(
                        point: LatLng(lat, lng),
                        width: 48,
                        height: 48,
                        child: Tooltip(
                          message:
                              '${marker['title'] ?? layer}\n${marker['distanceMeters'] != null ? '${marker['distanceMeters']} m' : ''}',
                          child: Icon(
                            _markerIcon(layer),
                            color: color,
                            size: 32,
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ],
              ),
              if (widget.busy)
                const Positioned(
                  top: 12,
                  right: 12,
                  child: CircularProgressIndicator(strokeWidth: 2),
                ),
              Positioned(
                right: 12,
                bottom: 12,
                child: Column(
                  children: [
                    FloatingActionButton.small(
                      heroTag: 'recenter',
                      onPressed: _recenter,
                      child: const Icon(Icons.my_location),
                    ),
                    const SizedBox(height: 8),
                    if (widget.onRefresh != null)
                      FloatingActionButton.small(
                        heroTag: 'refresh',
                        onPressed: widget.busy ? null : widget.onRefresh,
                        child: const Icon(Icons.refresh),
                      ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}
