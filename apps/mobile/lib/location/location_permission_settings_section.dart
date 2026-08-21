import "dart:async";

import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../widgets/section_card.dart";
import "device_location_service.dart";
import "device_location_state.dart";
import "location_permission_service.dart";
import "location_types.dart";

class LocationPermissionSettingsSection extends StatefulWidget {
  const LocationPermissionSettingsSection({super.key});

  @override
  State<LocationPermissionSettingsSection> createState() =>
      _LocationPermissionSettingsSectionState();
}

class _LocationPermissionSettingsSectionState
    extends State<LocationPermissionSettingsSection> {
  final DeviceLocationService _deviceLocationService = DeviceLocationService();

  LocationPermissionState? _permission;
  bool _initialLoading = true;
  bool _testInFlight = false;
  DeviceLocationState? _deviceLocation;
  ProfileJurisdictionDisplay? _profileJurisdiction;
  String? _trackingSummary;

  @override
  void initState() {
    super.initState();
    unawaited(_refreshPermissionOnly());
    WidgetsBinding.instance.addPostFrameCallback((_) {
      unawaited(_loadProfileJurisdiction());
      _refreshTrackingSummary();
    });
  }

  Future<void> _refreshPermissionOnly({bool requestIfDenied = false}) async {
    setState(() => _initialLoading = true);
    final permission = await resolveLocationPermissionState(
      requestIfDenied: requestIfDenied,
    );
    if (!mounted) return;
    setState(() {
      _permission = permission;
      _initialLoading = false;
    });
  }

  Future<void> _loadProfileJurisdiction() async {
    final controller = AppScope.of(context);
    if (!controller.isAuthenticated) {
      if (!mounted) return;
      setState(() => _profileJurisdiction = null);
      return;
    }
    final profile = controller.cachedCitizenProfile ??
        await controller.loadCitizenProfile();
    if (!mounted) return;
    setState(() {
      _profileJurisdiction = profile == null
          ? null
          : profileJurisdictionFromProfile(
              country: profile.profile.country,
              state: profile.profile.state,
              lga: profile.profile.lga,
              complete: profile.profileComplete,
            );
    });
  }

  void _refreshTrackingSummary() {
    final controller = AppScope.of(context);
    setState(() {
      _trackingSummary = controller.isEmergencyLocationTracking
          ? "Active emergency location sharing is running."
          : "No active emergency location sharing.";
    });
  }

  Future<void> _testCurrentLocation() async {
    if (_testInFlight) return;
    setState(() {
      _testInFlight = true;
      _deviceLocation = const DeviceLocationState(
        status: DeviceLocationStatus.acquiring,
      );
    });
    try {
      final result = await _deviceLocationService.probeCurrentLocation();
      if (!mounted) return;
      setState(() {
        _deviceLocation = result;
        _permission = result.permissionState ?? _permission;
      });
    } finally {
      if (mounted) {
        setState(() => _testInFlight = false);
      }
    }
  }

  String _permissionLabel(LocationPermissionState? state) {
    switch (state) {
      case LocationPermissionState.grantedPrecise:
        return "Precise location allowed";
      case LocationPermissionState.grantedApproximate:
        return "Approximate location allowed";
      case LocationPermissionState.denied:
        return "Permission denied";
      case LocationPermissionState.deniedPermanently:
        return "Permission blocked in Settings";
      case LocationPermissionState.serviceDisabled:
        return "Location services off";
      case LocationPermissionState.restricted:
        return "Restricted";
      case LocationPermissionState.timedOut:
        return "GPS timed out";
      case LocationPermissionState.unavailable:
        return "GPS unavailable";
      case LocationPermissionState.notRequested:
      case null:
        return "Not requested yet";
      case LocationPermissionState.acquiring:
        return "Acquiring GPS";
      case LocationPermissionState.error:
        return "Location error";
    }
  }

  Widget _infoRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SizedBox(
            width: 110,
            child: Text(
              label,
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
          ),
          Expanded(child: Text(value)),
        ],
      ),
    );
  }

  Widget _buildDeviceLocationCard(BuildContext context) {
    final device = _deviceLocation;
    final theme = Theme.of(context);
    return SectionCard(
      title: "Device location",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (device == null)
            const Text(
              "Tap Test current location to acquire a fresh GPS reading. "
              "No location is shown until acquisition completes.",
            )
          else if (_testInFlight ||
              device.status == DeviceLocationStatus.acquiring ||
              device.status == DeviceLocationStatus.checkingPermission)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            Text(
              device.headlineLabel,
              style: theme.textTheme.titleSmall,
            ),
            const SizedBox(height: 8),
            Text(
              device.displayLocality,
              style: theme.textTheme.bodyLarge,
            ),
            if (device.isAcquired) ...[
              const SizedBox(height: 12),
              _infoRow("Source", device.sourceLabel),
              _infoRow("Accuracy", device.accuracyLabel),
              if (device.ageLabel.isNotEmpty)
                _infoRow("Updated", device.ageLabel),
              if (device.message != null && device.message!.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.only(top: 4),
                  child: Text(
                    device.message!,
                    style: theme.textTheme.bodySmall,
                  ),
                ),
            ] else if (device.message != null)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(device.message!),
              ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _testInFlight ? null : _testCurrentLocation,
                icon: _testInFlight
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : const Icon(Icons.my_location),
                label: Text(
                  _testInFlight ? "Testing location…" : "Test current location",
                ),
              ),
              OutlinedButton.icon(
                onPressed: _testInFlight
                    ? null
                    : () => _refreshPermissionOnly(requestIfDenied: true),
                icon: const Icon(Icons.refresh),
                label: const Text("Retry permission"),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProfileJurisdictionCard() {
    final profile = _profileJurisdiction;
    return SectionCard(
      title: "Profile jurisdiction",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(
            profile?.hasValues == true ? profile!.label : "Not set",
            style: const TextStyle(fontSize: 16),
          ),
          const SizedBox(height: 8),
          Text(
            profile?.hasValues == true
                ? "This is your saved profile jurisdiction, not your current GPS location."
                : "Complete your profile to save your home jurisdiction for routing and alerts.",
          ),
          if (profile != null && profile.complete)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                "Profile completion: complete",
                style: TextStyle(
                  color: Colors.green.shade700,
                  fontSize: 12,
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildEmergencySharingCard() {
    return SectionCard(
      title: "Emergency location sharing",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(_trackingSummary ?? "Checking tracker state…"),
          const SizedBox(height: 8),
          const Text(
            "During an active SOS or live emergency video, THE EYE may share "
            "foreground location updates with authorized responders.",
          ),
        ],
      ),
    );
  }

  Widget _buildPermissionStatusCard() {
    return SectionCard(
      title: "Permission & services",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          if (_initialLoading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 12),
              child: Center(child: CircularProgressIndicator()),
            )
          else ...[
            ListTile(
              contentPadding: EdgeInsets.zero,
              leading: const Icon(Icons.location_on_outlined),
              title: Text(_permissionLabel(_permission)),
              subtitle: const Text(
                "Location is required for SOS, Neighborhood Watch, and nearby police.",
              ),
            ),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                if (_permission == LocationPermissionState.serviceDisabled)
                  OutlinedButton.icon(
                    onPressed: openLocationSettings,
                    icon: const Icon(Icons.settings),
                    label: const Text("Open location settings"),
                  ),
                if (_permission == LocationPermissionState.deniedPermanently ||
                    _permission == LocationPermissionState.restricted)
                  OutlinedButton.icon(
                    onPressed: openAppSettings,
                    icon: const Icon(Icons.settings),
                    label: const Text("Open app settings"),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildPermissionStatusCard(),
        const SizedBox(height: 16),
        _buildDeviceLocationCard(context),
        const SizedBox(height: 16),
        _buildProfileJurisdictionCard(),
        const SizedBox(height: 16),
        _buildEmergencySharingCard(),
      ],
    );
  }
}
