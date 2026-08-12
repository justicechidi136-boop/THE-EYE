import "dart:async";

import "package:flutter/material.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/components/eye_cancellation_reason_sheet.dart";
import "../design_system/eye_semantic_colors.dart";
import "../presentation/citizen_presentation.dart";
import "active_emergency_contract.dart";
import "active_emergency_errors.dart";
import "active_emergency_evidence_actions.dart";
import "active_emergency_navigation.dart";
import "active_emergency_service.dart";
import "widgets/active_emergency_header.dart";
import "widgets/active_emergency_skeleton.dart";
import "widgets/active_live_video_card.dart";
import "widgets/emergency_cancel_card.dart";
import "widgets/emergency_evidence_card.dart";
import "widgets/emergency_live_banner.dart";
import "widgets/emergency_overview_card.dart";
import "widgets/emergency_quick_actions.dart";
import "widgets/emergency_status_update_card.dart";
import "widgets/emergency_timeline_card.dart";
import "widgets/response_progress_card.dart";

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
      _pollTimer?.cancel();
      _pollTimer = Timer.periodic(
        const Duration(seconds: 15),
        (_) => unawaited(_refresh()),
      );
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
        await ActiveEmergencyNavigation.handleTerminalContract(
            context, contract);
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
    final reason = await showCancellationReasonSheet(
      context,
      title: "Cancel emergency",
      confirmLabel: "Cancel emergency",
    );
    if (reason == null) return;
    await _performAction(() async {
      await widget.service.cancelIncident(
        widget.incidentId,
        widget.accessToken,
        reason.auditedReason,
        reasonCode: reason.reasonCode,
        reasonText: reason.reasonText,
      );
      await widget.onStopLocationTracking?.call();
    });
  }

  Future<void> _requestCancellation() async {
    final reason = await showCancellationReasonSheet(
      context,
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
        reason.auditedReason,
        reasonCode: reason.reasonCode,
        reasonText: reason.reasonText,
      );
    });
  }

  Future<void> _submitReporterStatus(String status) async {
    final note = await _promptReason(
      title: status == "Resolved"
          ? "Confirm resolved"
          : status == "StillOngoing"
              ? "Confirm still ongoing"
              : "Mark unsafe to respond",
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

  Future<void> _openLiveVideoSession() async {
    await _startLiveVideo();
  }

  Future<void> _stopLiveVideo() async {
    final sessionId = _cachedActive?.liveVideo?.sessionId;
    if (sessionId == null || sessionId.isEmpty) {
      await _openLiveVideoSession();
      return;
    }
    await _performAction(() async {
      await widget.apiClient.stopLiveVideo(
        sessionId: sessionId,
        accessToken: widget.accessToken,
      );
    });
  }

  Future<void> _openCommunication() async {
    final active = _cachedActive;
    if (active == null) return;
    final reference = resolveIncidentPublicReference(
      incidentId: active.incidentId,
      submittedAt: active.reportedAt,
      apiPublicReference: active.publicReference,
    );
    final location = active.reportedLocation.address?.trim().isNotEmpty == true
        ? active.reportedLocation.address!.trim()
        : (active.reportedLocation.locationLabel?.trim().isNotEmpty == true
            ? active.reportedLocation.locationLabel!.trim()
            : null);
    await Navigator.of(context).pushNamed(
      "/active-emergency/${active.incidentId}/messages",
      arguments: {
        "publicReference": reference,
        "locationLabel": location,
        "reportedAt": active.reportedAt,
        "confirmStillOngoing": active.allowedActions.confirmStillOngoing,
        "confirmResolved": active.allowedActions.confirmResolved,
      },
    );
    await _refresh();
  }

  Future<void> _showEvidenceSheet({bool preferWrittenUpdate = false}) async {
    final active = _cachedActive;
    if (active == null) return;
    await showModalBottomSheet<void>(
      context: context,
      isScrollControlled: true,
      backgroundColor: EyeSemanticColors.of(context).cardSurface,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(18)),
      ),
      builder: (context) {
        return Padding(
          padding: EdgeInsets.only(
            left: 16,
            right: 16,
            top: 16,
            bottom: MediaQuery.viewInsetsOf(context).bottom + 24,
          ),
          child: SingleChildScrollView(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Text(
                  preferWrittenUpdate ? "Add written update" : "Add evidence",
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: 12),
                ActiveEmergencyEvidenceActions(
                  incidentId: widget.incidentId,
                  accessToken: widget.accessToken,
                  allowedActions: active.allowedActions,
                  apiClient: widget.apiClient,
                  accessibilityVoiceGuidance: true,
                  onUploaded: () async {
                    Navigator.of(context).maybePop();
                    await _refresh();
                  },
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  void _shareLocationHint() {
    final canOpen =
        _cachedActive?.communication.allowedCommunicationActions.openThread ==
            true;
    if (canOpen) {
      unawaited(_openCommunication());
      return;
    }
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          "Location sharing stays active while this emergency is open.",
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
    final active = _cachedActive ??
        (_contract is ActiveEmergencyActiveContract
            ? _contract as ActiveEmergencyActiveContract
            : null);
    final incidentTypeLabel = active == null
        ? "Help is on the way"
        : citizenIncidentCategoryLabel(
            active.categoryLabel?.trim().isNotEmpty == true
                ? active.categoryLabel!
                : active.category,
          );

    return PopScope(
      canPop: Navigator.of(context).canPop(),
      child: Scaffold(
        backgroundColor: colors.background,
        body: Column(
          children: [
            ActiveEmergencyHeader(
              title: widget.silent ? "Status" : "Active Emergency",
              subtitle: incidentTypeLabel,
              refreshEnabled: !_actionInFlight,
              onRefresh: () => unawaited(_refresh()),
            ),
            Expanded(
              child: RefreshIndicator(
                onRefresh: () => _refresh(),
                child: active == null
                    ? (_errorLabel != null
                        ? ListView(
                            physics: const AlwaysScrollableScrollPhysics(),
                            padding: const EdgeInsets.all(16),
                            children: [
                              Text(
                                _errorLabel!,
                                style: TextStyle(color: colors.errorText),
                              ),
                              const SizedBox(height: 16),
                              FilledButton(
                                onPressed: () => unawaited(_refresh()),
                                child: const Text("Retry"),
                              ),
                            ],
                          )
                        : const ActiveEmergencySkeleton())
                    : ListView(
                        physics: const AlwaysScrollableScrollPhysics(),
                        padding: const EdgeInsets.fromLTRB(0, 0, 0, 28),
                        children: [
                          Semantics(
                            label: _spokenSummary(active),
                            child: EmergencyLiveBanner(
                              active: active,
                              onViewLive: _actionInFlight
                                  ? null
                                  : () => unawaited(_openLiveVideoSession()),
                            ),
                          ),
                          if (_isStale || _errorLabel != null)
                            Padding(
                              padding: const EdgeInsets.fromLTRB(16, 10, 16, 0),
                              child: DecoratedBox(
                                decoration: BoxDecoration(
                                  color: colors.warning.withValues(alpha: 0.12),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color:
                                        colors.warning.withValues(alpha: 0.4),
                                  ),
                                ),
                                child: Padding(
                                  padding: const EdgeInsets.all(12),
                                  child: Column(
                                    crossAxisAlignment:
                                        CrossAxisAlignment.stretch,
                                    children: [
                                      Text(
                                        _isStale
                                            ? "Information may be out of date. Last updated ${CitizenDateTimeFormatter.formatRelative(active.lastUpdatedAt)}."
                                            : (_errorLabel ?? ""),
                                        style: TextStyle(
                                          color: colors.bodyText,
                                          fontSize: 13,
                                        ),
                                      ),
                                      Align(
                                        alignment: Alignment.centerLeft,
                                        child: TextButton(
                                          onPressed: _actionInFlight
                                              ? null
                                              : () => unawaited(_refresh()),
                                          child: const Text("Retry"),
                                        ),
                                      ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          Padding(
                            padding: const EdgeInsets.fromLTRB(16, 14, 16, 0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                EmergencyOverviewCard(active: active),
                                const SizedBox(height: 14),
                                ResponseProgressCard(active: active),
                                const SizedBox(height: 14),
                                ActiveLiveVideoCard(
                                  active: active,
                                  errorMessage: _liveVideoError,
                                  busy: _actionInFlight,
                                  onStart: widget.onStartLiveVideo == null
                                      ? null
                                      : () => unawaited(_startLiveVideo()),
                                  onOpenSession: () =>
                                      unawaited(_openLiveVideoSession()),
                                  onStop: () => unawaited(_stopLiveVideo()),
                                  onSwitchCamera: () =>
                                      unawaited(_openLiveVideoSession()),
                                ),
                                const SizedBox(height: 14),
                                EmergencyQuickActions(
                                  allowedActions: active.allowedActions,
                                  communication: active.communication,
                                  onEvidence: () => unawaited(
                                    _showEvidenceSheet(),
                                  ),
                                  onLocation: _shareLocationHint,
                                  onNote: () => unawaited(
                                    _showEvidenceSheet(
                                      preferWrittenUpdate: true,
                                    ),
                                  ),
                                  onCommunicate: () =>
                                      unawaited(_openCommunication()),
                                ),
                                const SizedBox(height: 14),
                                EmergencyEvidenceCard(
                                  active: active,
                                  onViewAll: () =>
                                      unawaited(_showEvidenceSheet()),
                                  onAddMore: () =>
                                      unawaited(_showEvidenceSheet()),
                                ),
                                const SizedBox(height: 14),
                                EmergencyStatusUpdateCard(
                                  allowedActions: active.allowedActions,
                                  busy: _actionInFlight,
                                  onOngoing: () => unawaited(
                                    _submitReporterStatus("StillOngoing"),
                                  ),
                                  onResolved: () => unawaited(
                                    _submitReporterStatus("Resolved"),
                                  ),
                                  onUnsafe: () => unawaited(
                                    _submitReporterStatus("Unsure"),
                                  ),
                                ),
                                const SizedBox(height: 14),
                                EmergencyTimelineCard(
                                  entries: active.timelineSummary,
                                ),
                                const SizedBox(height: 8),
                                EmergencyCancelCard(
                                  canCancel: active.allowedActions.cancel,
                                  canRequestCancellation:
                                      active.allowedActions.requestCancellation,
                                  busy: _actionInFlight,
                                  onCancel: () => unawaited(_cancelEmergency()),
                                  onRequestCancellation: () =>
                                      unawaited(_requestCancellation()),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
