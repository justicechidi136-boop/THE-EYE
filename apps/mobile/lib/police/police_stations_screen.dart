import "dart:async";

import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:url_launcher/url_launcher.dart";

import "police_stations_service.dart";

class NearbyPoliceStationsScreen extends StatefulWidget {
  const NearbyPoliceStationsScreen({super.key});

  @override
  State<NearbyPoliceStationsScreen> createState() =>
      _NearbyPoliceStationsScreenState();
}

class _NearbyPoliceStationsScreenState extends State<NearbyPoliceStationsScreen> {
  final _service = PoliceStationsService();
  final _searchController = TextEditingController();
  List<PoliceStationItem> _stations = [];
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({String? search}) async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      Position? position = await Geolocator.getLastKnownPosition();
      position ??= await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      ).timeout(const Duration(seconds: 12));

      final stations = await _service.list(
        search: search ?? _searchController.text.trim(),
        latitude: position.latitude,
        longitude: position.longitude,
      );
      if (!mounted) return;
      setState(() {
        _stations = stations;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load police stations (ERR-POLICE-001).";
        _loading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text("Nearby police")),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          TextField(
            controller: _searchController,
            decoration: const InputDecoration(
              prefixIcon: Icon(Icons.search),
              labelText: "Search by state, LGA, or location",
            ),
            onSubmitted: (_) => _load(search: _searchController.text.trim()),
          ),
          const SizedBox(height: 12),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 48),
              child: Center(child: CircularProgressIndicator()),
            )
          else if (_error != null)
            Column(
              children: [
                Text(_error!, style: TextStyle(color: theme.colorScheme.error)),
                const SizedBox(height: 8),
                FilledButton(
                  onPressed: () => _load(),
                  child: const Text("Retry"),
                ),
              ],
            )
          else if (_stations.isEmpty)
            Text(
              "No verified police stations matched your search.",
              style: theme.textTheme.bodyMedium,
            )
          else
            ..._stations.map((station) => _PoliceStationTile(station: station)),
        ],
      ),
    );
  }
}

class _PoliceStationTile extends StatelessWidget {
  const _PoliceStationTile({required this.station});

  final PoliceStationItem station;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              station.name,
              style: theme.textTheme.titleSmall?.copyWith(
                fontWeight: FontWeight.w600,
              ),
            ),
            const SizedBox(height: 4),
            Text(station.address, style: theme.textTheme.bodySmall),
            if (station.distanceLabel.isNotEmpty)
              Text(station.distanceLabel, style: theme.textTheme.labelSmall),
            const SizedBox(height: 8),
            Row(
              children: [
                TextButton.icon(
                  onPressed: station.canCall
                      ? () => launchUrl(Uri.parse("tel:${station.phone}"))
                      : null,
                  icon: const Icon(Icons.call),
                  label: Text(
                    station.canCall ? "Call" : "No phone on file",
                  ),
                ),
                TextButton.icon(
                  onPressed: () {
                    final url = station.navigationUrl ??
                        "https://www.google.com/maps/dir/?api=1&destination=${station.latitude},${station.longitude}";
                    launchUrl(Uri.parse(url), mode: LaunchMode.externalApplication);
                  },
                  icon: const Icon(Icons.map),
                  label: const Text("Directions"),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
