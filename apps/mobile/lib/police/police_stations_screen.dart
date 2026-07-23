import "dart:async";

import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:url_launcher/url_launcher.dart";

import "../design_system/components/eye_page_back_header.dart";
import "../incidents/incident_submission_service.dart";
import "../location/location_permission_service.dart";
import "police_stations_service.dart";

class NearbyPoliceStationsScreen extends StatefulWidget {
  const NearbyPoliceStationsScreen({super.key, this.autoload = true});

  final bool autoload;

  @override
  State<NearbyPoliceStationsScreen> createState() =>
      _NearbyPoliceStationsScreenState();
}

class _NearbyPoliceStationsScreenState
    extends State<NearbyPoliceStationsScreen> {
  final _service = PoliceStationsService();
  final _searchController = TextEditingController();
  final _stateController = TextEditingController();
  final _lgaController = TextEditingController();
  List<PoliceStationItem> _stations = [];
  bool _loading = true;
  String? _error;
  String? _locationNotice;
  String? _attributionNotice;
  bool _providerFailed = false;
  LocationCaptureResult? _locationBlock;
  int _radiusMeters = 25000;

  @override
  void initState() {
    super.initState();
    if (widget.autoload) {
      unawaited(_load());
    } else {
      _loading = false;
    }
  }

  @override
  void dispose() {
    _searchController.dispose();
    _stateController.dispose();
    _lgaController.dispose();
    super.dispose();
  }

  Future<
      ({
        double? latitude,
        double? longitude,
        String? notice,
        LocationCaptureResult? block
      })> _resolveCoordinates() async {
    final permission = await resolveLocationPermission();
    if (permission != LocationCaptureResult.granted) {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        return (
          latitude: last.latitude,
          longitude: last.longitude,
          notice:
              "${nearbyLocationNotice(permission)} Distances use your last known position.",
          block: permission,
        );
      }
      return (
        latitude: null,
        longitude: null,
        notice: nearbyLocationNotice(permission),
        block: permission,
      );
    }

    try {
      Position? position = await Geolocator.getLastKnownPosition();
      position ??= await Geolocator.getCurrentPosition(
        locationSettings: const LocationSettings(
          accuracy: LocationAccuracy.medium,
          timeLimit: Duration(seconds: 12),
        ),
      ).timeout(const Duration(seconds: 12));
      return (
        latitude: position.latitude,
        longitude: position.longitude,
        notice: null,
        block: null,
      );
    } on TimeoutException {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        return (
          latitude: last.latitude,
          longitude: last.longitude,
          notice: "GPS timed out. Distances use your last known position.",
          block: LocationCaptureResult.timeout,
        );
      }
      return (
        latitude: null,
        longitude: null,
        notice: nearbyLocationNotice(LocationCaptureResult.timeout),
        block: LocationCaptureResult.timeout,
      );
    } catch (_) {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) {
        return (
          latitude: last.latitude,
          longitude: last.longitude,
          notice: "GPS unavailable. Distances use your last known position.",
          block: LocationCaptureResult.timeout,
        );
      }
      return (
        latitude: null,
        longitude: null,
        notice: nearbyLocationNotice(LocationCaptureResult.timeout),
        block: LocationCaptureResult.timeout,
      );
    }
  }

  Future<void> _load({String? search}) async {
    setState(() {
      _loading = true;
      _error = null;
      _locationNotice = null;
      _attributionNotice = null;
      _providerFailed = false;
      _locationBlock = null;
    });
    try {
      final coords = await _resolveCoordinates();
      final result = await _service.nearby(
        search: search ?? _searchController.text.trim(),
        state: _stateController.text.trim(),
        lga: _lgaController.text.trim(),
        latitude: coords.latitude,
        longitude: coords.longitude,
        radiusMeters: _radiusMeters,
      );
      if (!mounted) return;
      setState(() {
        _stations = result.stations;
        _locationNotice = coords.notice;
        _locationBlock = coords.block;
        _attributionNotice = result.googleAttributionNotice;
        _providerFailed = result.providerFailed;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error =
            "Unable to reach police station service (ERR-POLICE-001). Check your connection and retry.";
        _loading = false;
      });
    }
  }

  Future<void> _retryLocationPermission() async {
    await _load(search: _searchController.text.trim());
  }

  void _handleBack(BuildContext context) {
    if (Navigator.of(context).canPop()) {
      Navigator.of(context).pop();
      return;
    }
    Navigator.of(context).pushReplacementNamed("/home");
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final blocked = _locationBlock;
    final showSettings = blocked == LocationCaptureResult.deniedForever ||
        blocked == LocationCaptureResult.serviceDisabled;
    return PopScope(
      canPop: Navigator.of(context).canPop(),
      onPopInvokedWithResult: (didPop, result) {
        if (!didPop) _handleBack(context);
      },
      child: Scaffold(
        appBar: AppBar(
          automaticallyImplyLeading: false,
          title: const Text("Nearby police"),
          actions: [
            IconButton(
              tooltip: "Refresh stations",
              onPressed: _loading ? null : () => _load(),
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EyePageBackHeader(
              title: "Nearby police",
              onBack: () => _handleBack(context),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
                children: [
                  TextField(
                    controller: _searchController,
                    decoration: const InputDecoration(
                      prefixIcon: Icon(Icons.search),
                      labelText: "Search by name or address",
                    ),
                    onSubmitted: (_) =>
                        _load(search: _searchController.text.trim()),
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: TextField(
                          controller: _stateController,
                          decoration: const InputDecoration(
                            labelText: "State",
                          ),
                          onSubmitted: (_) => _load(),
                        ),
                      ),
                      const SizedBox(width: 8),
                      Expanded(
                        child: TextField(
                          controller: _lgaController,
                          decoration: const InputDecoration(
                            labelText: "LGA",
                          ),
                          onSubmitted: (_) => _load(),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  DropdownButtonFormField<int>(
                    value: _radiusMeters,
                    decoration: const InputDecoration(
                      labelText: "Search radius",
                    ),
                    items: const [
                      DropdownMenuItem(value: 5000, child: Text("5 km")),
                      DropdownMenuItem(value: 10000, child: Text("10 km")),
                      DropdownMenuItem(value: 25000, child: Text("25 km")),
                      DropdownMenuItem(value: 50000, child: Text("50 km")),
                    ],
                    onChanged: _loading
                        ? null
                        : (value) {
                            if (value == null) return;
                            setState(() => _radiusMeters = value);
                            unawaited(_load());
                          },
                  ),
                  const SizedBox(height: 12),
                  if (_locationNotice != null)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _locationNotice!,
                            style: theme.textTheme.bodySmall?.copyWith(
                              color: theme.colorScheme.onSurfaceVariant,
                            ),
                          ),
                          if (blocked != null &&
                              blocked != LocationCaptureResult.granted) ...[
                            const SizedBox(height: 8),
                            Wrap(
                              spacing: 8,
                              runSpacing: 8,
                              children: [
                                if (showSettings)
                                  OutlinedButton.icon(
                                    onPressed: blocked ==
                                            LocationCaptureResult
                                                .serviceDisabled
                                        ? openLocationSettings
                                        : openAppSettings,
                                    icon: const Icon(Icons.settings),
                                    label: Text(
                                      blocked ==
                                              LocationCaptureResult
                                                  .serviceDisabled
                                          ? "Open location settings"
                                          : "Open app settings",
                                    ),
                                  ),
                                OutlinedButton.icon(
                                  onPressed: _retryLocationPermission,
                                  icon: const Icon(Icons.refresh),
                                  label: const Text("Retry GPS"),
                                ),
                              ],
                            ),
                          ],
                        ],
                      ),
                    ),
                  if (_providerFailed)
                    Padding(
                      padding: const EdgeInsets.only(bottom: 12),
                      child: Text(
                        "Google Maps supplemental results are temporarily unavailable. Showing verified THE EYE records only.",
                        style: theme.textTheme.bodySmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ),
                  if (_loading)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 48),
                      child: Center(child: CircularProgressIndicator()),
                    )
                  else if (_error != null)
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(_error!,
                            style: TextStyle(color: theme.colorScheme.error)),
                        const SizedBox(height: 8),
                        FilledButton(
                          onPressed: () => _load(),
                          child: const Text("Retry"),
                        ),
                      ],
                    )
                  else if (_stations.isEmpty)
                    Text(
                      "No verified police stations matched your search. Try widening the radius or adjusting filters.",
                      style: theme.textTheme.bodyMedium,
                    )
                  else ...[
                    ..._stations
                        .map((station) => _PoliceStationTile(station: station)),
                    if (_attributionNotice != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        _attributionNotice!,
                        style: theme.textTheme.labelSmall?.copyWith(
                          color: theme.colorScheme.onSurfaceVariant,
                        ),
                      ),
                    ],
                    const SizedBox(height: 8),
                    Text(
                      "Distances are straight-line estimates from THE EYE. Directions open Google Maps navigation.",
                      style: theme.textTheme.labelSmall?.copyWith(
                        color: theme.colorScheme.onSurfaceVariant,
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
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
            Row(
              children: [
                Expanded(
                  child: Text(
                    station.name,
                    style: theme.textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
                if (station.isVerifiedByTheEye)
                  Chip(
                    label: const Text("Verified"),
                    visualDensity: VisualDensity.compact,
                    backgroundColor:
                        theme.colorScheme.primaryContainer.withValues(alpha: 0.7),
                  )
                else if (station.isGoogleResult)
                  Chip(
                    label: const Text("Google Maps result"),
                    visualDensity: VisualDensity.compact,
                  ),
              ],
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
                    launchUrl(Uri.parse(url),
                        mode: LaunchMode.externalApplication);
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
