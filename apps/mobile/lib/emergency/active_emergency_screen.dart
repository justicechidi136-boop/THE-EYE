import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/components/eye_page_back_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "active_emergency_contract.dart";
import "active_emergency_errors.dart";
import "active_emergency_evidence_actions.dart";
import "active_emergency_navigation.dart";
import "active_emergency_refresh_coordinator.dart";
import "active_emergency_service.dart";

class ActiveEmergencyScreen extends StatefulWidget {
  const ActiveEmergencyScreen({
    super.key,
    required this.incidentId,
    required this.accessToken,
    required this.service,
    required this.apiClient,
    this.silent = false,
    this.onStopLocationTracking,
    this.onStartLiveVideo,
    this.liveVideoErrorMessage,
  });

  final String incidentId;
  final String accessToken;
  final ActiveEmergencyService service;
  final TheEyeApiClient apiClient;
  final bool silent;
  final Future<void> Function()? onStopLocationTracking;
  final Future<void> Function(String incidentId)? onStartLiveVideo;
  final String? liveVideoErrorMessage;

  @override
  State<ActiveEmergencyScreen> createState() => _ActiveEmergencyScreenState();
}

class _ActiveEmergencyScreenState extends State<ActiveEmergencyScreen>
    with WidgetsBindingObserver {
  ActiveEmergencyContract? _contract;
  ActiveEmergencyActiveContract? _cachedActive;
  String? _errorLabel;
  String? _liveVideoError;
  bool _isStale = false;
  bool _actionInFlight = false;
  Timer? _pollTimer;
  int? _refreshGeneration;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
    _liveVideoError = widget.liveVideoErrorMessage;
    unawaited(_refresh(initial: true));
    _pollTimer = Timer.periodic(
      const Duration(seconds: 15),
      (_) => unawaited(_refresh()),
    );
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    _pollTimer?.cancel();
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(_refresh());
    }
    if (state == AppLifecycleState.paused ||
        state == AppLifecycleState.detached) {
      _pollTimer?.cancel();
    }
  }

  Future<void> _refresh({bool initial = false}) async {
    if (widget.incidentId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _errorLabel = activeEmergencyErrorLabel(
          ActiveEmergencyErrorCode.malformedContract,
        );
      });
      return;
    }

    final generation = widget.service.refreshCoordinator.beginRefresh();
    _refreshGeneration = generation;
    try {
      final contract = await widget.service.fetchActiveEmergencyContract(
        widget.incidentId,
        widget.accessToken,
        silent: widget.silent,
      );
      if (contract == null || !mounted) return;
      if (!widget.service.refreshCoordinator.isCurrent(generation)) return;

      if (contract is ActiveEmergencyTerminalContract) {
        await widget.onStopLocationTracking?.call();
        if (!mounted) return;
        setState(() {
          _contract = contract;
          _cachedActive = null;
          _errorLabel = null;
          _isStale = false;
        });
        await ActiveEmergencyNavigation.handleTerminalContract(context, contract);
        return;
      }

      final active = contract as ActiveEmergencyActiveContract;
      if (_cachedActive != null &&
          !widget.service.refreshCoordinator.shouldAccept(
            generation: generation,
            incomingStatusVersion: active.statusVersion,
            incomingUpdatedAt: active.lastUpdatedAt,
            currentStatusVersion: _cachedActive!.statusVersion,
            currentUpdatedAt: _cachedActive!.lastUpdatedAt,
          )) {
        return;
      }

      if (!mounted) return;
      setState(() {
        _contract = active;
        _cachedActive = active;
        _errorLabel = null;
        _isStale = false;
      });
    } on ActiveEmergencyContractException catch (error) {
      if (!mounted) return;
      setState(() {
        _errorLabel = activeEmergencyErrorLabel(error.code);
        _isStale = error.code == ActiveEmergencyErrorCode.networkTemporary ||
            _cachedActive != null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _errorLabel = activeEmergencyErrorLabel(
          ActiveEmergencyErrorCode.networkTemporary,
        );
        _isStale = _cachedActive != null;
      });
    }
  }

  Future<void> _performAction(Future<void> Function() action) async {
    if (_actionInFlight) return;
    setState(() => _actionInFlight = true);
    try {
      await _refresh();
      await action();
      await _refresh();
    } on ActiveEmergencyContractException catch (error) {
      if (!mounted) return;
      setState(() => _errorLabel = activeEmergencyErrorLabel(error.code));
      if (error.code == ActiveEmergencyErrorCode.staleActionConflict) {
        await _refresh();
      }
    } finally {
      if (mounted) setState(() => _actionInFlight = false);
    }
  }

  Future<void> _cancelEmergency() async {
    final reason = await _promptReason(
      title: "Cancel emergency",
      confirmLabel: "Cancel emergency",
    );
    if (reason == null) return;
    await _performAction(() async {
      await widget.service.cancelIncident(
        widget.incidentId,
        widget.accessToken,
        reason,
      );
      await widget.onStopLocationTracking?.call();
    });
  }

  Future<void> _requestCancellation() async {
    final reason = await _promptReason(
      title: "Request cancellation",
      confirmLabel: "Request cancellation",
      helper:
          "Assigned responders may continue until a dispatcher reviews your request.",
    );
    if (reason == null) return;
    await _performAction(() async {
      await widget.service.requestCancellation(
        widget.incidentId,
        widget.accessToken,
        reason,
      );
    });
  }

  Future<void> _submitReporterStatus(String status) async {
    final note = await _promptReason(
      title: status == "Resolved"
          ? "Confirm resolved"
          : status == "StillOngoing"
              ? "Confirm still ongoing"
              : "Mark unsure",
      confirmLabel: "Submit",
      requireReason: false,
    );
    await _performAction(() async {
      await widget.service.submitReporterStatus(
        widget.incidentId,
        widget.accessToken,
        status: status,
        clientActionId:
            "${status.toLowerCase()}-${DateTime.now().millisecondsSinceEpoch}",
        note: note,
      );
    });
  }

  Future<String?> _promptReason({
    required String title,
    required String confirmLabel,
    String? helper,
    bool requireReason = true,
  }) async {
    final controller = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(title),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            if (helper != null) ...[
              Text(helper),
              const SizedBox(height: 12),
            ],
            TextField(
              controller: controller,
              decoration: InputDecoration(
                labelText: requireReason ? "Reason" : "Note (optional)",
              ),
              minLines: 2,
              maxLines: 4,
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("Back"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: Text(confirmLabel),
          ),
        ],
      ),
    );
    if (confirmed != true) return null;
    final value = controller.text.trim();
    if (requireReason && value.isEmpty) return null;
    return value.isEmpty ? null : value;
  }

  Future<void> _startLiveVideo() async {
    if (widget.onStartLiveVideo != null) {
      await widget.onStartLiveVideo!(widget.incidentId);
      await _refresh();
    }
  }

  String _formatRelativeTime(DateTime value) {
    final diff = DateTime.now().toUtc().difference(value.toUtc());
    if (diff.inMinutes < 1) return "Just now";
    if (diff.inMinutes < 60) return "${diff.inMinutes} minutes ago";
    if (diff.inHours < 24) return "${diff.inHours} hours ago";
    return value.toLocal().toString();
  }

  Widget _buildLiveVideoCard(ActiveEmergencyActiveContract active) {
    final liveVideo = active.liveVideo;
    final displayState = liveVideo?.displayState ?? "NotStarted";
    return Semantics(
      label: "Live emergency video, $displayState",
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text("Live emergency video",
                  style: Theme.of(context).textTheme.titleMedium),
              const SizedBox(height: 8),
              _InfoRow(label: "State", value: displayState),
              if (liveVideo?.startedAt != null)
                _InfoRow(
                  label: "Started",
                  value: liveVideo!.startedAt!.toLocal().toString(),
                ),
              if (liveVideo?.durationSeconds != null)
                _InfoRow(
                  label: "Duration",
                  value: "${liveVideo!.durationSeconds}s",
                ),
              if (liveVideo?.connectionStatus != null)
                _InfoRow(
                  label: "Connection",
                  value: liveVideo!.connectionStatus!,
                ),
              if (liveVideo?.participantCount != null)
                _InfoRow(
                  label: "Participants",
                  value: liveVideo!.participantCount.toString(),
                ),
              if (_liveVideoError != null) ...[
                const SizedBox(height: 8),
                Text(
                  _liveVideoError!,
                  style: TextStyle(color: Theme.of(context).colorScheme.error),
                ),
              ],
              const SizedBox(height: 8),
              if (active.allowedActions.retryLiveVideo ||
                  liveVideo?.retryAvailable == true)
                FilledButton.icon(
                  onPressed: _actionInFlight ? null : _startLiveVideo,
                  icon: const Icon(Icons.videocam),
                  label: Text(
                    displayState == "Streaming"
                        ? "Return to live video"
                        : "Start live video",
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }

  String _spokenSummary(ActiveEmergencyActiveContract active) {
    return "Your ${active.category.toLowerCase()} report has been received. "
        "It is currently ${active.displayLabel.toLowerCase()}.";
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final active = _cachedActive ?? (_contract is ActiveEmergencyActiveContract
        ? _contract as ActiveEmergencyActiveContract
        : null);

    return PopScope(
      canPop: Navigator.of(context).canPop(),
      child: Scaffold(
        backgroundColor: colors.background,
        appBar: AppBar(
          title: Text(widget.silent ? "Status" : "Active emergency"),
          actions: [
            IconButton(
              tooltip: "Refresh",
              onPressed: _actionInFlight ? null : () => _refresh(),
              icon: const Icon(Icons.refresh),
            ),
          ],
        ),
        body: RefreshIndicator(
          onRefresh: () => _refresh(),
          child: active == null
              ? ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    if (_errorLabel != null)
                      Text(_errorLabel!,
                          style: TextStyle(color: Theme.of(context).colorScheme.error)),
                    const SizedBox(height: 24),
                    const Center(child: CircularProgressIndicator()),
                  ],
                )
              : ListView(
                  physics: const AlwaysScrollableScrollPhysics(),
                  padding: const EdgeInsets.all(16),
                  children: [
                    EyePageBackHeader(
                      title: widget.silent ? "Status" : "Active emergency",
                      onBack: () => Navigator.of(context).maybePop(),
                    ),
                    Semantics(
                      label: _spokenSummary(active),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            ActiveEmergencyNavigation.receivedCopy,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                          if (_isStale)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                "Last updated ${active.lastUpdatedAt.toLocal()} (may be stale)",
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                          if (_errorLabel != null)
                            Padding(
                              padding: const EdgeInsets.only(top: 8),
                              child: Text(
                                _errorLabel!,
                                style: TextStyle(
                                  color: Theme.of(context).colorScheme.error,
                                ),
                              ),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    _InfoRow(label: "Incident ID", value: active.incidentId),
                    _InfoRow(label: "Category", value: active.category),
                    _InfoRow(
                      label: "Reported",
                      value: active.reportedAt.toLocal().toString(),
                    ),
                    _InfoRow(
                      label: "Location",
                      value: active.reportedLocation.address ??
                          "${active.reportedLocation.latitude ?? "pending"}, "
                              "${active.reportedLocation.longitude ?? "pending"}",
                    ),
                    _InfoRow(
                      label: "Location quality",
                      value:
                          "${active.reportedLocation.source} / ${active.reportedLocation.quality}",
                    ),
                    _InfoRow(label: "Status", value: active.displayLabel),
                    _InfoRow(
                      label: "Progress",
                      value: "${active.progressStep}/${active.progressStages.length}",
                    ),
                    if (active.reporterConfidence != null)
                      _InfoRow(
                        label: "Reporter confidence",
                        value: active.reporterConfidence!,
                      ),
                    _InfoRow(
                      label: "Last updated",
                      value: active.lastUpdatedAt.toLocal().toString(),
                    ),
                    const SizedBox(height: 16),
                    Text("Evidence summary",
                        style: Theme.of(context).textTheme.titleMedium),
                    Text(
                      "Photos ${active.evidenceSummary.photos}, "
                      "Videos ${active.evidenceSummary.videos}, "
                      "Voice ${active.evidenceSummary.voice}",
                    ),
                    const SizedBox(height: 16),
                    _buildLiveVideoCard(active),
                    const SizedBox(height: 16),
                    Text("Communication",
                        style: Theme.of(context).textTheme.titleMedium),
                    if (active.communication.conversationAvailable) ...[
                      Text(
                        active.communication.lastMessagePreview ??
                            "No messages yet. You can contact dispatch here.",
                      ),
                      if (active.communication.unreadMessageCount > 0)
                        Text(
                          "${active.communication.unreadMessageCount} unread",
                          style: Theme.of(context).textTheme.labelLarge,
                        ),
                      const SizedBox(height: 8),
                      Semantics(
                        button: true,
                        label: "Open emergency communication",
                        child: FilledButton.icon(
                          onPressed: active.communication.allowedCommunicationActions.openThread
                              ? () {
                                  Navigator.of(context).pushNamed(
                                    "/active-emergency/${active.incidentId}/messages",
                                  );
                                }
                              : null,
                          icon: const Icon(Icons.chat_bubble_outline),
                          label: const Text("Open communication"),
                        ),
                      ),
                    ] else
                      const Text("Communication will be available once dispatch connects."),
                    const SizedBox(height: 16),
                    Text("Progress",
                        style: Theme.of(context).textTheme.titleMedium),
                    ...active.progressStages.map(
                      (stage) => Semantics(
                        label:
                            "${stage.label}, ${stage.state.name.replaceAll("_", " ")}",
                        child: ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: Icon(_stageIcon(stage.state)),
                          title: Text(stage.label),
                          subtitle: Text(stage.state.name),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Text("Response progress",
                        style: Theme.of(context).textTheme.titleMedium),
                    if (active.assignedAgencyName != null)
                      Text("Assigned agency: ${active.assignedAgencyName}")
                    else
                      const Text("No agency assigned yet."),
                    if (active.assignment != null)
                      Text("Assignment status: ${active.assignment!.status}"),
                    if (active.responderEtaMinutes != null)
                      Text("Responder ETA: ${active.responderEtaMinutes} minutes")
                    else
                      const Text("Responder ETA unavailable."),
                    if (active.witnessCount != null) ...[
                      const SizedBox(height: 8),
                      Text(
                        "Community witnesses: ${active.witnessCount}"
                        "${active.latestConfidence != null ? " (confidence ${active.latestConfidence})" : ""}",
                      ),
                    ],
                    const SizedBox(height: 16),
                    if (active.timelineSummary.isNotEmpty) ...[
                      Text("Timeline",
                          style: Theme.of(context).textTheme.titleMedium),
                      ...active.timelineSummary.take(12).map(
                            (entry) => Semantics(
                              label: "${entry.message}, ${_formatRelativeTime(entry.createdAt)}",
                              child: ListTile(
                                dense: true,
                                contentPadding: EdgeInsets.zero,
                                title: Text(entry.message),
                                subtitle: Text(_formatRelativeTime(entry.createdAt)),
                              ),
                            ),
                          ),
                    ],
                    const SizedBox(height: 24),
                    Text("Actions",
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    if (active.allowedActions.addEvidence ||
                        active.allowedActions.uploadPhoto ||
                        active.allowedActions.uploadVideo ||
                        active.allowedActions.uploadVoice ||
                        active.allowedActions.addUpdate ||
                        active.allowedActions.addWrittenUpdate)
                      ActiveEmergencyEvidenceActions(
                        incidentId: widget.incidentId,
                        accessToken: widget.accessToken,
                        allowedActions: active.allowedActions,
                        apiClient: widget.apiClient,
                        accessibilityVoiceGuidance: true,
                        onUploaded: _refresh,
                      ),
                    if (active.allowedActions.cancel)
                      FilledButton.tonal(
                        onPressed: _actionInFlight ? null : _cancelEmergency,
                        child: const Text("Cancel emergency"),
                      ),
                    if (active.allowedActions.requestCancellation) ...[
                      const SizedBox(height: 8),
                      FilledButton.tonal(
                        onPressed:
                            _actionInFlight ? null : _requestCancellation,
                        child: const Text("Request cancellation"),
                      ),
                    ],
                    if (active.allowedActions.confirmResolved) ...[
                      const SizedBox(height: 8),
                      FilledButton(
                        onPressed: _actionInFlight
                            ? null
                            : () => _submitReporterStatus("Resolved"),
                        child: const Text("Situation appears resolved"),
                      ),
                    ],
                    if (active.allowedActions.confirmStillOngoing) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _actionInFlight
                            ? null
                            : () => _submitReporterStatus("StillOngoing"),
                        child: const Text("Still ongoing"),
                      ),
                    ],
                    if (active.allowedActions.confirmResolved ||
                        active.allowedActions.confirmStillOngoing) ...[
                      const SizedBox(height: 8),
                      OutlinedButton(
                        onPressed: _actionInFlight
                            ? null
                            : () => _submitReporterStatus("Unsure"),
                        child: const Text("Unsure"),
                      ),
                    ],
                  ],
                ),
        ),
      ),
    );
  }

  IconData _stageIcon(ActiveEmergencyProgressStageState state) {
    switch (state) {
      case ActiveEmergencyProgressStageState.complete:
        return Icons.check_circle_outline;
      case ActiveEmergencyProgressStageState.current:
        return Icons.radio_button_checked_outlined;
      case ActiveEmergencyProgressStageState.skipped:
        return Icons.remove_circle_outline;
      case ActiveEmergencyProgressStageState.pending:
        return Icons.circle_outlined;
    }
  }
}

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 4),
      child: RichText(
        text: TextSpan(
          style: DefaultTextStyle.of(context).style,
          children: [
            TextSpan(
              text: "$label: ",
              style: const TextStyle(fontWeight: FontWeight.w600),
            ),
            TextSpan(text: value),
          ],
        ),
      ),
    );
  }
}
