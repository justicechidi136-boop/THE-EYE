import "dart:async";

import "package:flutter/material.dart";

import "../contracts/the_eye_api_client.dart";
import "../emergency/incident_communication_contract.dart";
import "../emergency/incident_communication_service.dart";
import "incident_history_service.dart";

class IncidentDetailScreen extends StatefulWidget {
  const IncidentDetailScreen({
    required this.incidentId,
    required this.accessToken,
    this.apiClient,
    super.key,
  });

  final String incidentId;
  final String accessToken;
  final TheEyeApiClient? apiClient;

  @override
  State<IncidentDetailScreen> createState() => _IncidentDetailScreenState();
}

class _IncidentDetailScreenState extends State<IncidentDetailScreen> {
  final IncidentHistoryService _historyService = IncidentHistoryService();
  late final IncidentCommunicationService _communicationService;
  IncidentDetail? _detail;
  IncidentCommunicationSummary? _communication;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _communicationService = IncidentCommunicationService(
      widget.apiClient ?? TheEyeApiClient(),
    );
    unawaited(_load());
  }

  Future<void> _loadCommunication() async {
    try {
      final conversation = await _communicationService.fetchConversation(
        widget.incidentId,
        widget.accessToken,
      );
      if (!mounted) return;
      setState(() {
        _communication = IncidentCommunicationSummary.fromJson(conversation);
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => _communication = null);
    }
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
      await _loadCommunication();
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
              if (_communication?.conversationAvailable == true) ...[
                const SizedBox(height: 12),
                const Text("Communication history",
                    style: TextStyle(fontWeight: FontWeight.w800)),
                ListTile(
                  leading: const Icon(Icons.chat_bubble_outline),
                  title: Text(
                    _communication!.lastMessagePreview ?? "View communication record",
                  ),
                  subtitle: Text(
                    _communication!.unreadMessageCount > 0
                        ? "${_communication!.unreadMessageCount} unread message(s)"
                        : "Read-only communication record",
                  ),
                  trailing: const Icon(Icons.chevron_right),
                  onTap: () {
                    Navigator.of(context).pushNamed(
                      "/incident-detail/${widget.incidentId}/messages",
                    );
                  },
                ),
              ],
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
