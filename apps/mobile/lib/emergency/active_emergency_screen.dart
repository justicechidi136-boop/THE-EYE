import "dart:async";

import "package:flutter/material.dart";

import "active_emergency_service.dart";
import "active_emergency_state.dart";
import "active_emergency_store.dart";

class ActiveEmergencyScreen extends StatefulWidget {
  const ActiveEmergencyScreen({
    super.key,
    required this.incidentId,
    required this.accessToken,
    required this.service,
    this.silent = false,
    this.onStopLocationTracking,
  });

  final String incidentId;
  final String accessToken;
  final ActiveEmergencyService service;
  final bool silent;
  final Future<void> Function()? onStopLocationTracking;

  @override
  State<ActiveEmergencyScreen> createState() => _ActiveEmergencyScreenState();
}

class _ActiveEmergencyScreenState extends State<ActiveEmergencyScreen> {
  ActiveEmergencySnapshot? _snapshot;
  String? _error;
  Timer? _pollTimer;
  bool _cancelling = false;

  @override
  void initState() {
    super.initState();
    unawaited(_refresh());
    _pollTimer = Timer.periodic(
        const Duration(seconds: 10), (_) => unawaited(_refresh()));
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    super.dispose();
  }

  Future<void> _refresh() async {
    try {
      final snapshot = await widget.service.refreshIncident(
        widget.incidentId,
        widget.accessToken,
        silent: widget.silent,
      );
      if (!mounted) return;
      setState(() {
        _snapshot = snapshot;
        _error = null;
      });
      final phase = mapIncidentStatusToPhase(snapshot.status);
      if (!phaseAllowsLocationStreaming(phase)) {
        await widget.onStopLocationTracking?.call();
        if (phase == ActiveEmergencyPhase.resolved ||
            phase == ActiveEmergencyPhase.cancelled) {
          await widget.service.clearActiveIncident();
        }
      }
    } catch (error) {
      if (!mounted) return;
      setState(() => _error = error.toString());
    }
  }

  Future<void> _cancelEmergency() async {
    if (_cancelling) return;
    setState(() => _cancelling = true);
    try {
      await widget.service.cancelIncident(
        widget.incidentId,
        widget.accessToken,
        "Citizen requested cancellation",
      );
      await widget.onStopLocationTracking?.call();
      if (!mounted) return;
      Navigator.of(context).pop();
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.toString();
        _cancelling = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = _snapshot;
    final phase = snapshot == null
        ? ActiveEmergencyPhase.sending
        : mapIncidentStatusToPhase(snapshot.status);
    final discreet = widget.silent;

    return Scaffold(
      appBar: AppBar(
        title: Text(discreet ? "Status" : "Active emergency"),
      ),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: snapshot == null
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                children: [
                  if (_error != null)
                    Text(_error!,
                        style: TextStyle(
                            color: Theme.of(context).colorScheme.error)),
                  Text(phaseLabel(phase),
                      style: Theme.of(context).textTheme.headlineSmall),
                  const SizedBox(height: 8),
                  Text("Incident ID: ${snapshot.incidentId}"),
                  Text("Category: ${snapshot.type}"),
                  if (snapshot.agencyName.isNotEmpty)
                    Text("Assigned agency: ${snapshot.agencyName}")
                  else if (phase.index >=
                      ActiveEmergencyPhase.awaitingAssignment.index)
                    const Text("Awaiting agency assignment"),
                  if (snapshot.lastLocationAt != null)
                    Text(
                        "Last location update: ${snapshot.lastLocationAt!.toLocal()}"),
                  const SizedBox(height: 16),
                  Text(
                    discreet
                        ? "Updates are shown discreetly. Help is only indicated when assignment is confirmed."
                        : _statusMessage(phase, snapshot),
                  ),
                  const SizedBox(height: 16),
                  if (snapshot.timeline.isNotEmpty) ...[
                    Text("Timeline",
                        style: Theme.of(context).textTheme.titleMedium),
                    ...snapshot.timeline.take(8).map(
                          (entry) => ListTile(
                            dense: true,
                            title: Text(timelineEntryLabel(entry)),
                          ),
                        ),
                  ],
                  if (phaseAllowsCancellation(phase))
                    Padding(
                      padding: const EdgeInsets.only(top: 24),
                      child: OutlinedButton(
                        onPressed: _cancelling ? null : _cancelEmergency,
                        child: Text(
                            _cancelling ? "Cancelling…" : "Cancel emergency"),
                      ),
                    ),
                ],
              ),
      ),
    );
  }

  String _statusMessage(
      ActiveEmergencyPhase phase, ActiveEmergencySnapshot snapshot) {
    switch (phase) {
      case ActiveEmergencyPhase.awaitingAssignment:
        return "Your report was received and is awaiting responder assignment.";
      case ActiveEmergencyPhase.assigned:
      case ActiveEmergencyPhase.responderAccepted:
      case ActiveEmergencyPhase.responderEnRoute:
      case ActiveEmergencyPhase.responderArrived:
      case ActiveEmergencyPhase.inProgress:
        if (snapshot.agencyName.isEmpty) {
          return "Status updated. Assignment details will appear when confirmed.";
        }
        return "Assigned agency: ${snapshot.agencyName}.";
      case ActiveEmergencyPhase.resolved:
        return "This emergency has been marked resolved.";
      case ActiveEmergencyPhase.cancelled:
        return "This emergency was closed.";
      default:
        return "Emergency submitted. Status updates will appear here.";
    }
  }
}
