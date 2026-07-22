import "dart:async";

import "package:flutter/material.dart";

import "incident_history_service.dart";
import "incident_submission_service.dart";

class IncidentDetailScreen extends StatefulWidget {
  const IncidentDetailScreen({
    required this.incidentId,
    required this.accessToken,
    super.key,
  });

  final String incidentId;
  final String accessToken;

  @override
  State<IncidentDetailScreen> createState() => _IncidentDetailScreenState();
}

class _IncidentDetailScreenState extends State<IncidentDetailScreen> {
  final IncidentHistoryService _historyService = IncidentHistoryService();
  IncidentDetail? _detail;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final detail = await _historyService.getIncident(
        accessToken: widget.accessToken,
        incidentId: widget.incidentId,
      );
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error.userMessage;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = "Unable to load incident details.";
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Incident details")),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          children: [
            if (_loading)
              const Center(
                child: Padding(
                  padding: EdgeInsets.all(24),
                  child: CircularProgressIndicator(),
                ),
              ),
            if (_error != null)
              ListTile(
                leading: const Icon(Icons.error_outline),
                title: const Text("Unable to load"),
                subtitle: Text(_error!),
              ),
            if (_detail != null) ...[
              ListTile(
                leading: const Icon(Icons.report),
                title: Text("${_detail!.type} • ${_detail!.status}"),
                subtitle: Text(
                  "${_detail!.description ?? "No description"}\n"
                  "Agency: ${_detail!.agency}\n"
                  "Verification: ${_detail!.verificationStatus}\n"
                  "Evidence files: ${_detail!.evidenceCount}",
                ),
              ),
              if (_detail!.statusHistory.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text("Status history",
                    style: TextStyle(fontWeight: FontWeight.w800)),
                ..._detail!.statusHistory.map(
                  (entry) => ListTile(
                    title: Text("${entry["from"]} → ${entry["to"]}"),
                    subtitle: Text("${entry["note"]}\n${entry["time"]}"),
                  ),
                ),
              ],
              if (_detail!.timeline.isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text("Timeline",
                    style: TextStyle(fontWeight: FontWeight.w800)),
                ..._detail!.timeline.map(
                  (entry) => ListTile(
                    title: Text(entry["event"] ?? "Update"),
                    subtitle: Text("${entry["actor"]} • ${entry["time"]}"),
                  ),
                ),
              ],
            ],
          ],
        ),
      ),
    );
  }
}
