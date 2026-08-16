import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";

import "../incidents/incident_submission_service.dart";
import "activity_history_service.dart";

class IncidentArchiveScreen extends StatefulWidget {
  const IncidentArchiveScreen({
    required this.incidentId,
    required this.accessToken,
    super.key,
  });

  final String incidentId;
  final String accessToken;

  @override
  State<IncidentArchiveScreen> createState() => _IncidentArchiveScreenState();
}

class _IncidentArchiveScreenState extends State<IncidentArchiveScreen> {
  final ActivityHistoryService _service = ActivityHistoryService();
  Map<String, dynamic>? _archive;
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
      final archive = await _service.getIncidentArchive(
        accessToken: widget.accessToken,
        incidentId: widget.incidentId,
      );
      if (!mounted) return;
      setState(() {
        _archive = archive;
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
        _error = "Unable to load incident archive.";
      });
    }
  }

  List<Map<String, dynamic>> _mapList(Object? value) {
    if (value is! List) return const [];
    return value
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList();
  }

  String _evidenceLabel(Map<String, dynamic> item, int index) {
    final label = item["label"]?.toString().trim();
    if (label != null && label.isNotEmpty) return label;
    final mediaType = item["mediaType"]?.toString().toLowerCase();
    final prefix = switch (mediaType) {
      "image" || "photo" => "Photo",
      "video" => "Video",
      "audio" => "Audio",
      _ => "Evidence",
    };
    return "$prefix ${index + 1}";
  }

  String _evidenceStatus(Map<String, dynamic> item) {
    final uploadedAt = item["uploadedAt"]?.toString().trim();
    if (uploadedAt != null && uploadedAt.isNotEmpty) {
      return "Uploaded $uploadedAt";
    }
    final status = item["status"]?.toString().trim();
    return status == null || status.isEmpty ? "Archived evidence item" : status;
  }

  @override
  Widget build(BuildContext context) {
    final archive = _archive;
    final location = archive?["location"] is Map
        ? Map<String, dynamic>.from(archive!["location"] as Map)
        : null;
    final map = archive?["map"] is Map
        ? Map<String, dynamic>.from(archive!["map"] as Map)
        : null;
    final community = archive?["communityVerificationSummary"] is Map
        ? Map<String, dynamic>.from(
            archive!["communityVerificationSummary"] as Map)
        : null;
    final mediaStats = archive?["mediaStatistics"] is Map
        ? Map<String, dynamic>.from(archive!["mediaStatistics"] as Map)
        : null;
    final audit = archive?["auditSummary"] is Map
        ? Map<String, dynamic>.from(archive!["auditSummary"] as Map)
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Semantics(header: true, child: const Text("Incident archive")),
        actions: [
          Semantics(
            button: true,
            label: "Read incident archive aloud",
            child: IconButton(
              tooltip: "Read aloud",
              icon: const Icon(Icons.record_voice_over),
              onPressed: archive == null
                  ? null
                  : () => SemanticsService.announce(
                        "${archive["title"]}. ${archive["status"]}. ${location?["address"] ?? "Location unavailable"}",
                        TextDirection.ltr,
                      ),
            ),
          ),
        ],
      ),
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
                title: const Text("Unable to load archive"),
                subtitle: Text(_error!),
              ),
            if (archive != null) ...[
              ListTile(
                leading: const Icon(Icons.inventory_2_outlined),
                title: Text("${archive["category"]} • ${archive["status"]}"),
                subtitle: Text(
                  "Incident ${archive["incidentId"]}\n"
                  "Created ${archive["createdAt"]}\n"
                  "Resolved ${archive["resolvedAt"] ?? "Not resolved"}",
                ),
              ),
              if (location != null)
                ListTile(
                  leading: const Icon(Icons.place),
                  title: const Text("Location"),
                  subtitle: Text(
                    "${location["address"] ?? "Address unavailable"}\n"
                    "${location["jurisdiction"] ?? ""}",
                  ),
                ),
              if (map?["latitude"] != null && map?["longitude"] != null)
                ListTile(
                  leading: const Icon(Icons.map),
                  title: const Text("Map coordinates"),
                  subtitle: Text("${map!["latitude"]}, ${map["longitude"]}"),
                ),
              ListTile(
                leading: const Icon(Icons.business),
                title: const Text("Agency"),
                subtitle: Text("${archive["agency"] ?? "Not assigned"}"),
              ),
              ListTile(
                leading: const Icon(Icons.verified_user),
                title: const Text("Resolution"),
                subtitle: Text(
                  "${archive["finalOutcome"]}\n"
                  "${archive["resolutionNotes"] ?? "No resolution notes"}\n"
                  "Source: ${archive["resolutionSource"] ?? "Unknown"}",
                ),
              ),
              if (community != null)
                ListTile(
                  leading: const Icon(Icons.groups),
                  title: const Text("Community verification"),
                  subtitle: Text(
                    "${community["safeSummaryText"] ?? "No community summary"}\n"
                    "Confirmed ${community["confirmedCount"] ?? 0}, responses ${community["responsesReceived"] ?? 0}",
                  ),
                ),
              if (mediaStats != null)
                ListTile(
                  leading: const Icon(Icons.perm_media),
                  title: const Text("Media statistics"),
                  subtitle:
                      Text("${mediaStats["totalItems"] ?? 0} evidence items"),
                ),
              if (audit != null)
                ListTile(
                  leading: const Icon(Icons.shield),
                  title: const Text("Audit summary"),
                  subtitle:
                      Text("${audit["eventCount"] ?? 0} audit events recorded"),
                ),
              const SizedBox(height: 12),
              const Text("Evidence gallery",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["evidenceGallery"]).indexed.map(
                    (entry) => ListTile(
                      leading: const Icon(Icons.attach_file),
                      title: Text(_evidenceLabel(entry.$2, entry.$1)),
                      subtitle: Text(_evidenceStatus(entry.$2)),
                    ),
                  ),
              const SizedBox(height: 12),
              const Text("Timeline",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["timeline"]).map(
                (entry) => ListTile(
                  title: Text("${entry["label"] ?? entry["type"] ?? "Update"}"),
                  subtitle: Text("${entry["at"] ?? ""}"),
                ),
              ),
              const SizedBox(height: 12),
              const Text("Dispatch timeline",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["dispatchTimeline"]).map(
                (entry) => ListTile(
                  title: Text("${entry["label"] ?? "Dispatch update"}"),
                  subtitle: Text(
                      "${entry["at"] ?? ""}${entry["agency"] != null ? " • ${entry["agency"]}" : ""}"),
                ),
              ),
              const SizedBox(height: 12),
              const Text("Notifications sent",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["notificationsSent"]).map(
                (entry) => ListTile(
                  title: Text(
                      "${entry["title"] ?? entry["type"] ?? "Notification"}"),
                  subtitle: Text(
                      "${entry["createdAt"] ?? ""} • ${entry["read"] == true ? "Read" : "Unread"}"),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
