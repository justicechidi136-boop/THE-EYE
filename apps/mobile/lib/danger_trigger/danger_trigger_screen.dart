import "dart:async";

import "package:flutter/material.dart";
import "package:uuid/uuid.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/eye_semantic_colors.dart";
import "../live_video/live_video_connection_state.dart";
import "../live_video/live_video_lifecycle_phase.dart";
import "../live_video/live_video_session_controller.dart";
import "../location/device_location_service.dart";
import "../location/device_location_state.dart";
import "../push/watch_danger_alert_relay.dart";
import "danger_trigger_service.dart";

enum DangerTriggerViewState {
  ready,
  locating,
  preparing,
  connecting,
  broadcasting,
  reconnecting,
  ended,
  failed,
}

class DangerTriggerScreen extends StatefulWidget {
  DangerTriggerScreen({
    required TheEyeApiClient apiClient,
    required this.accessTokenProvider,
    DangerTriggerGateway? gateway,
    DeviceLocationService? locationService,
    LiveVideoSessionController? liveVoiceController,
    WatchDangerAlertRelay? watchRelay,
    super.key,
  })  : gateway = gateway ?? DangerTriggerApiService(apiClient),
        locationService = locationService ?? DeviceLocationService(),
        liveVoiceController =
            liveVoiceController ?? LiveVideoSessionController(audioOnly: true),
        watchRelay = watchRelay ?? WatchDangerAlertRelay();

  final String? Function() accessTokenProvider;
  final DangerTriggerGateway gateway;
  final DeviceLocationService locationService;
  final LiveVideoSessionController liveVoiceController;
  final WatchDangerAlertRelay watchRelay;

  @override
  State<DangerTriggerScreen> createState() => _DangerTriggerScreenState();
}

class _DangerTriggerScreenState extends State<DangerTriggerScreen> {
  DangerTriggerViewState _viewState = DangerTriggerViewState.locating;
  DeviceLocationState? _location;
  PreparedDangerTrigger? _prepared;
  String? _error;
  Timer? _timer;
  Duration _elapsed = Duration.zero;
  bool _ending = false;
  DangerTriggerActivation? _activation;
  bool _pairedWatchAlerted = false;
  String? _dangerAlertCode;

  bool get _isActive =>
      _viewState == DangerTriggerViewState.preparing ||
      _viewState == DangerTriggerViewState.connecting ||
      _viewState == DangerTriggerViewState.broadcasting ||
      _viewState == DangerTriggerViewState.reconnecting;

  DangerTriggerCategory? get _selectedDangerCategory {
    for (final category in dangerTriggerCategories) {
      if (category.code == _dangerAlertCode) return category;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    widget.liveVoiceController.addListener(_handleVoiceLifecycle);
    unawaited(_refreshLocation());
  }

  @override
  void dispose() {
    _timer?.cancel();
    widget.liveVoiceController.removeListener(_handleVoiceLifecycle);
    widget.liveVoiceController.dispose();
    super.dispose();
  }

  void _handleVoiceLifecycle() {
    if (!mounted || !_isActive) return;
    final phase = widget.liveVoiceController.lifecyclePhase;
    if (_viewState == DangerTriggerViewState.broadcasting &&
        (widget.liveVoiceController.connectionState ==
                LiveVideoConnectionState.reconnecting ||
            phase == LiveVideoLifecyclePhase.connecting ||
            phase == LiveVideoLifecyclePhase.disconnectedUnexpectedly)) {
      setState(() => _viewState = DangerTriggerViewState.reconnecting);
    } else if (_viewState == DangerTriggerViewState.reconnecting &&
        phase == LiveVideoLifecyclePhase.streaming) {
      setState(() => _viewState = DangerTriggerViewState.broadcasting);
    }
  }

  Future<void> _refreshLocation() async {
    setState(() {
      _viewState = DangerTriggerViewState.locating;
      _error = null;
    });
    final location = await widget.locationService.probeCurrentLocation();
    if (!mounted) return;
    setState(() {
      _location = location;
      _viewState = location.hasCoordinates
          ? DangerTriggerViewState.ready
          : DangerTriggerViewState.failed;
      if (!location.hasCoordinates) {
        _error = location.message ??
            "A current location is required to alert nearby users safely.";
      }
    });
  }

  Future<void> _start() async {
    if (_isActive) return;
    final token = widget.accessTokenProvider()?.trim() ?? "";
    final location = _location;
    final dangerAlertCode = _dangerAlertCode;
    if (token.isEmpty) {
      setState(() {
        _viewState = DangerTriggerViewState.failed;
        _error = "Sign in again before starting a danger broadcast.";
      });
      return;
    }
    if (location == null || !location.hasCoordinates) {
      await _refreshLocation();
      return;
    }
    if (dangerAlertCode == null) {
      setState(
        () => _error = "Select the type of danger before starting the alert.",
      );
      return;
    }

    setState(() {
      _viewState = DangerTriggerViewState.preparing;
      _error = null;
    });
    final permission = await widget.liveVoiceController.ensurePermissions();
    if (!permission.granted) {
      if (!mounted) return;
      setState(() {
        _viewState = DangerTriggerViewState.failed;
        _error = permission.message;
      });
      return;
    }

    try {
      final prepared = await widget.gateway.prepare(
        accessToken: token,
        clientTriggerId: const Uuid().v4(),
        latitude: location.latitude!,
        longitude: location.longitude!,
        accuracyMeters: location.accuracyMeters,
        locationCapturedAt: location.capturedAt ?? DateTime.now(),
        locationSource: _apiLocationSource(location.source),
        dangerAlertCode: dangerAlertCode,
        areaName: location.displayLocality,
      );
      if (!mounted) return;
      setState(() {
        _prepared = prepared;
        _viewState = DangerTriggerViewState.connecting;
      });
      final connected = await widget.liveVoiceController.startSession(
        prepared.liveVideo,
        incidentIdOverride: prepared.liveVideo.incidentId,
      );
      if (!connected) {
        throw DangerTriggerException(
          widget.liveVoiceController.errorMessage ??
              "Unable to establish the live voice connection.",
        );
      }
      final activation = await widget.gateway.activate(
        accessToken: token,
        eventId: prepared.eventId,
        liveSessionId: prepared.liveSessionId,
        connectedAt: DateTime.now(),
      );
      if (!mounted) return;
      _timer?.cancel();
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (mounted) setState(() => _elapsed += const Duration(seconds: 1));
      });
      setState(() {
        _activation = activation;
        _viewState = DangerTriggerViewState.broadcasting;
      });
      unawaited(_relayToPairedWatch(activation));
    } catch (error) {
      await widget.liveVoiceController.stop();
      if (!mounted) return;
      setState(() {
        _viewState = DangerTriggerViewState.failed;
        _error = error is DangerTriggerException
            ? error.message
            : "Unable to start the live danger broadcast. Please try again.";
      });
    }
  }

  Future<void> _relayToPairedWatch(DangerTriggerActivation activation) async {
    if (activation.watchRelayPayload.isEmpty) return;
    final relayed = await widget.watchRelay.relayDangerAlert(
      activation.watchRelayPayload,
    );
    if (mounted && relayed) {
      setState(() => _pairedWatchAlerted = true);
    }
  }

  Future<void> _end() async {
    final prepared = _prepared;
    final token = widget.accessTokenProvider()?.trim() ?? "";
    if (prepared == null || token.isEmpty || _ending) return;
    setState(() => _ending = true);
    try {
      await widget.liveVoiceController.stop();
      await widget.gateway.endLiveVoice(
        accessToken: token,
        eventId: prepared.eventId,
      );
      _timer?.cancel();
      if (!mounted) return;
      setState(() {
        _viewState = DangerTriggerViewState.ended;
        _ending = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _ending = false;
        _error = error is DangerTriggerException
            ? error.message
            : "Unable to end the live voice broadcast.";
      });
    }
  }

  Future<void> _cancel() async {
    final prepared = _prepared;
    final token = widget.accessTokenProvider()?.trim() ?? "";
    if (prepared == null || token.isEmpty || _ending) return;
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Cancel danger alert?"),
        content: const Text(
          "Use this only if the alert was triggered by mistake. The safety record will be preserved.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("Keep alert"),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text("Cancel alert"),
          ),
        ],
      ),
    );
    if (confirmed != true) return;
    setState(() => _ending = true);
    try {
      await widget.liveVoiceController.stop();
      await widget.gateway.cancel(
        accessToken: token,
        eventId: prepared.eventId,
      );
      _timer?.cancel();
      if (!mounted) return;
      setState(() {
        _viewState = DangerTriggerViewState.ended;
        _ending = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _ending = false;
        _error = error is DangerTriggerException
            ? error.message
            : "Unable to cancel this alert.";
      });
    }
  }

  Future<bool> _confirmLeave() async {
    if (!_isActive) return true;
    final leave = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Live voice is active"),
        content: const Text(
          "End the live voice broadcast before leaving this screen.",
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text("Stay"),
          ),
          FilledButton(
            onPressed: () async {
              await _end();
              if (context.mounted) Navigator.pop(context, true);
            },
            child: const Text("End voice and leave"),
          ),
        ],
      ),
    );
    return leave == true;
  }

  String _apiLocationSource(DeviceLocationSourceKind source) {
    switch (source) {
      case DeviceLocationSourceKind.freshGps:
        return "freshGps";
      case DeviceLocationSourceKind.cachedDevice:
        return "cachedDevice";
      default:
        return "networkLocation";
    }
  }

  String get _statusLabel {
    switch (_viewState) {
      case DangerTriggerViewState.ready:
        return "Ready";
      case DangerTriggerViewState.locating:
        return "Checking location";
      case DangerTriggerViewState.preparing:
        return "Preparing";
      case DangerTriggerViewState.connecting:
        return "Connecting";
      case DangerTriggerViewState.broadcasting:
        return "Broadcasting";
      case DangerTriggerViewState.reconnecting:
        return "Reconnecting";
      case DangerTriggerViewState.ended:
        return "Ended";
      case DangerTriggerViewState.failed:
        return "Failed";
    }
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final location = _location;
    final minutes = _elapsed.inMinutes.toString().padLeft(2, "0");
    final seconds = (_elapsed.inSeconds % 60).toString().padLeft(2, "0");
    return PopScope(
      canPop: !_isActive,
      onPopInvokedWithResult: (didPop, _) async {
        if (didPop) return;
        if (await _confirmLeave() && context.mounted) Navigator.pop(context);
      },
      child: Scaffold(
        appBar: AppBar(title: const Text("Danger Trigger")),
        body: SafeArea(
          child: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              Row(
                children: [
                  Icon(
                    Icons.warning_amber_rounded,
                    color: Colors.amber.shade800,
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Text(
                      "Alert nearby people when you are in immediate danger.",
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ),
                  Chip(label: Text(_statusLabel)),
                ],
              ),
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: semantics.cardSurface,
                  border: Border.all(color: semantics.border),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(
                      Icons.location_on_outlined,
                      color: semantics.primaryAction,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          const Text("Alert location"),
                          const SizedBox(height: 4),
                          Text(
                            location?.displayLocality ??
                                "Checking your current location...",
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (location?.hasCoordinates == true) ...[
                            const SizedBox(height: 4),
                            Text(
                              "${location!.sourceLabel} · ${location.accuracyLabel}",
                              style: Theme.of(context).textTheme.bodySmall,
                            ),
                          ],
                        ],
                      ),
                    ),
                    IconButton(
                      tooltip: "Refresh location",
                      onPressed: _isActive ? null : _refreshLocation,
                      icon: const Icon(Icons.refresh),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              Text(
                "Select danger type",
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 4),
              Text(
                "Choose what nearby users and responders should hear.",
                style: Theme.of(context).textTheme.bodySmall,
              ),
              const SizedBox(height: 12),
              GridView.builder(
                key: const Key("danger-trigger-category-grid"),
                shrinkWrap: true,
                physics: const NeverScrollableScrollPhysics(),
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 8,
                  mainAxisSpacing: 8,
                  mainAxisExtent: 112,
                ),
                itemCount: dangerTriggerCategories.length,
                itemBuilder: (context, index) {
                  final category = dangerTriggerCategories[index];
                  return _DangerCategoryKey(
                    category: category,
                    icon: _dangerCategoryIcon(category.code),
                    selected: category.code == _dangerAlertCode,
                    enabled: !_isActive,
                    onTap: () => setState(() {
                      _dangerAlertCode = category.code;
                      _error = null;
                    }),
                  );
                },
              ),
              const SizedBox(height: 12),
              AnimatedSwitcher(
                duration: const Duration(milliseconds: 180),
                child: _selectedDangerCategory == null
                    ? Container(
                        key: const Key("danger-category-required"),
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: semantics.warning.withValues(alpha: 0.1),
                          border: Border.all(color: semantics.warning),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Text(
                          "Select a danger type to continue.",
                          textAlign: TextAlign.center,
                        ),
                      )
                    : Container(
                        key: ValueKey(_dangerAlertCode),
                        width: double.infinity,
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: semantics.warning.withValues(alpha: 0.16),
                          border: Border.all(
                            color: semantics.warning,
                            width: 2,
                          ),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          "Selected danger: ${_selectedDangerCategory!.label.toUpperCase()}",
                          textAlign: TextAlign.center,
                          style: Theme.of(context)
                              .textTheme
                              .titleSmall
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
              ),
              const SizedBox(height: 20),
              if (_viewState == DangerTriggerViewState.broadcasting ||
                  _viewState == DangerTriggerViewState.reconnecting) ...[
                Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: semantics.error.withValues(alpha: 0.12),
                    border: Border.all(color: semantics.error),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Column(
                    children: [
                      Icon(Icons.mic, color: semantics.error, size: 44),
                      const SizedBox(height: 10),
                      Text(
                        _viewState == DangerTriggerViewState.reconnecting
                            ? "Reconnecting"
                            : "Live voice broadcasting",
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 6),
                      Text("$minutes:$seconds"),
                      const SizedBox(height: 8),
                      Text(
                        "Nearby alerts cover up to ${((_prepared?.radiusMeters ?? 4000) / 1000).toStringAsFixed(0)} km. Ending voice does not resolve the safety event.",
                        textAlign: TextAlign.center,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        _activation == null
                            ? "Activating nearby alerts..."
                            : _activation!.recipientCount == 0
                                ? "Alert active. No other nearby users were eligible when the alert started."
                                : "Alert active. Alerts sent to ${_activation!.recipientCount} nearby ${_activation!.recipientCount == 1 ? "user" : "users"}.",
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      if (_activation?.initiatorWatchAlertQueued == true) ...[
                        const SizedBox(height: 4),
                        Text(
                          _pairedWatchAlerted
                              ? "Paired smartwatch alerted."
                              : "Smartwatch alert queued. Delivery depends on watch connectivity.",
                          textAlign: TextAlign.center,
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                FilledButton.icon(
                  onPressed: _ending ? null : _end,
                  icon: const Icon(Icons.stop_circle_outlined),
                  label: Text(_ending ? "Ending..." : "End live voice"),
                ),
                TextButton(
                  onPressed: _ending ? null : _cancel,
                  child: const Text("Triggered by mistake"),
                ),
              ] else ...[
                FilledButton.icon(
                  onPressed: location?.hasCoordinates == true &&
                          _dangerAlertCode != null &&
                          !_isActive
                      ? _start
                      : null,
                  icon: const Icon(Icons.mic),
                  label: const Text("Start Live Danger Broadcast"),
                  style: FilledButton.styleFrom(
                    minimumSize: const Size.fromHeight(56),
                    backgroundColor: semantics.error,
                    foregroundColor: Colors.white,
                  ),
                ),
                const SizedBox(height: 12),
                OutlinedButton.icon(
                  onPressed: () =>
                      Navigator.of(context).pushNamed("/report/emergency"),
                  icon: const Icon(Icons.warning_amber_rounded),
                  label: const Text("Report Immediate Danger"),
                  style: OutlinedButton.styleFrom(
                    minimumSize: const Size.fromHeight(52),
                  ),
                ),
              ],
              if (_error != null) ...[
                const SizedBox(height: 16),
                Text(
                  _error!,
                  style: TextStyle(color: semantics.error),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),
                TextButton.icon(
                  onPressed: _viewState == DangerTriggerViewState.failed
                      ? (location?.hasCoordinates == true
                          ? _start
                          : _refreshLocation)
                      : null,
                  icon: const Icon(Icons.refresh),
                  label: const Text("Try again"),
                ),
              ],
              const SizedBox(height: 20),
              Container(
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: semantics.warning.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(Icons.privacy_tip_outlined),
                    SizedBox(width: 10),
                    Expanded(
                      child: Text(
                        "Your microphone activates only after you tap Start. Use this feature only in a real emergency. Your exact location remains restricted to authorized responders.",
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

IconData _dangerCategoryIcon(String code) => switch (code) {
      "DANGER_ZONE_FIRE_NEARBY" => Icons.local_fire_department_outlined,
      "DANGER_ZONE_ARMED_ROBBERY_NEARBY" => Icons.warning_amber_rounded,
      "DANGER_ZONE_KIDNAPPING_NEARBY" => Icons.person_search_outlined,
      "DANGER_ZONE_ACTIVE_SHOOTER_NEARBY" => Icons.crisis_alert_outlined,
      "DANGER_ZONE_CIVIL_DISTURBANCE_NEARBY" => Icons.groups_outlined,
      "DANGER_ZONE_BANDIT_ATTACK_NEARBY" => Icons.report_outlined,
      "DANGER_ZONE_CULT_CLASH_NEARBY" => Icons.group_off_outlined,
      "DANGER_ZONE_COMMUNITY_CRISIS_NEARBY" => Icons.location_city_outlined,
      "DANGER_ZONE_KILLING_NEARBY" => Icons.dangerous_outlined,
      _ => Icons.warning_amber_rounded,
    };

class _DangerCategoryKey extends StatelessWidget {
  const _DangerCategoryKey({
    required this.category,
    required this.icon,
    required this.selected,
    required this.enabled,
    required this.onTap,
  });

  final DangerTriggerCategory category;
  final IconData icon;
  final bool selected;
  final bool enabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final foreground =
        selected ? semantics.warning : Theme.of(context).colorScheme.onSurface;

    return Semantics(
      button: true,
      selected: selected,
      enabled: enabled,
      label: category.label,
      child: Material(
        color: selected
            ? semantics.warning.withValues(alpha: 0.16)
            : semantics.cardSurface,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(8),
          side: BorderSide(
            color: selected ? semantics.warning : semantics.border,
            width: selected ? 2 : 1,
          ),
        ),
        clipBehavior: Clip.antiAlias,
        child: InkWell(
          key: Key("danger-category-${category.code}"),
          onTap: enabled ? onTap : null,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
            child: Stack(
              children: [
                Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(icon, color: foreground, size: 26),
                      const SizedBox(height: 7),
                      Text(
                        category.label.toUpperCase(),
                        maxLines: 3,
                        overflow: TextOverflow.ellipsis,
                        textAlign: TextAlign.center,
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: foreground,
                              fontWeight: FontWeight.w700,
                              height: 1.15,
                            ),
                      ),
                    ],
                  ),
                ),
                if (selected)
                  Positioned(
                    top: 0,
                    right: 0,
                    child: Icon(
                      Icons.check_circle,
                      color: semantics.warning,
                      size: 18,
                    ),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
