import "dart:async";

import "package:flutter/material.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/components/eye_page_header.dart";
import "../design_system/components/eye_status_chip.dart";
import "../emergency/incident_communication_contract.dart";
import "../emergency/incident_communication_service.dart";
import "../presentation/citizen_presentation.dart";
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
  late final IncidentHistoryService _historyService;
  late final IncidentCommunicationService _communicationService;
  IncidentDetail? _detail;
  IncidentCommunicationSummary? _communication;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    final apiClient = widget.apiClient ?? TheEyeApiClient();
    _historyService = IncidentHistoryService(apiClient: apiClient);
    _communicationService = IncidentCommunicationService(apiClient);
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
    final detail = _detail;
    final statusLabel = detail == null
        ? null
        : resolveCitizenIncidentStatusLabel(
            displayLabel: detail.displayStatus,
            status: detail.status,
          );
    final heading = detail == null
        ? "Incident details"
        : citizenIncidentCategoryLabel(detail.type);

    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EyePageHeader.secondary(title: heading),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
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
                  if (detail != null) ...[
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Text(
                            detail.description ?? "No description",
                            style: const TextStyle(fontWeight: FontWeight.w600),
                          ),
                        ),
                        if (statusLabel != null) ...[
                          const SizedBox(width: 8),
                          EyeStatusChip(label: statusLabel, compact: true),
                        ],
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text("Agency: ${detail.agency}"),
                    Text("Verification: ${detail.verificationStatus}"),
                    Text("Evidence files: ${detail.evidenceCount}"),
                    if (_communication?.conversationAvailable == true) ...[
                      const SizedBox(height: 12),
                      const Text(
                        "Communication history",
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: const Icon(Icons.chat_bubble_outline),
                        title: Text(
                          _communication!.lastMessagePreview ??
                              "View communication record",
                        ),
                        subtitle: Text(
                          _communication!.unreadMessageCount > 0
                              ? "${_communication!.unreadMessageCount} unread message(s)"
                              : _communication!.lastMessageAt == null
                                  ? "Read-only communication record"
                                  : "Last update ${CitizenDateTimeFormatter.formatDateTime(_communication!.lastMessageAt!)}",
                        ),
                        trailing: const Icon(Icons.chevron_right),
                        onTap: () {
                          Navigator.of(context).pushNamed(
                            "/incident-detail/${widget.incidentId}/messages",
                          );
                        },
                      ),
                    ],
                    if (detail.statusHistory.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text(
                        "Status history",
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      ...detail.statusHistory.map((entry) {
                        final toStatus = entry["to"] ?? "Update";
                        final parsed =
                            CitizenDateTimeFormatter.tryParse(entry["time"]);
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            resolveCitizenIncidentStatusLabel(status: toStatus),
                          ),
                          subtitle: Text(
                            [
                              if ((entry["note"] ?? "").trim().isNotEmpty)
                                entry["note"],
                              parsed == null
                                  ? null
                                  : CitizenDateTimeFormatter.formatDateTime(
                                      parsed),
                            ].whereType<String>().join("\n"),
                          ),
                        );
                      }),
                    ],
                    if (detail.timeline.isNotEmpty) ...[
                      const SizedBox(height: 12),
                      const Text(
                        "Timeline",
                        style: TextStyle(fontWeight: FontWeight.w800),
                      ),
                      ...detail.timeline.map((entry) {
                        final parsed =
                            CitizenDateTimeFormatter.tryParse(entry["time"]);
                        return ListTile(
                          contentPadding: EdgeInsets.zero,
                          title: Text(
                            citizenTimelineMessage(
                              message: entry["event"],
                            ),
                          ),
                          subtitle: Text(
                            parsed == null
                                ? (entry["actor"] ?? "Update")
                                : "${entry["actor"] ?? "Update"} · ${CitizenDateTimeFormatter.formatDateTime(parsed)}",
                          ),
                        );
                      }),
                    ],
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
