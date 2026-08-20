import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";

import "../contracts/the_eye_api_client.dart";
import "activity_history_service.dart";

class BroadcastArchiveScreen extends StatefulWidget {
  const BroadcastArchiveScreen({
    required this.broadcastId,
    required this.accessToken,
    this.apiClient,
    super.key,
  });

  final String broadcastId;
  final String accessToken;
  final TheEyeApiClient? apiClient;

  @override
  State<BroadcastArchiveScreen> createState() => _BroadcastArchiveScreenState();
}

class _BroadcastArchiveScreenState extends State<BroadcastArchiveScreen> {
  late final ActivityHistoryService _service;
  Map<String, dynamic>? _archive;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _service = ActivityHistoryService(apiClient: widget.apiClient);
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final archive = await _service.getBroadcastArchive(
        accessToken: widget.accessToken,
        broadcastId: widget.broadcastId,
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
        _error = "Unable to load broadcast archive.";
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
    final missing = archive?["missingPerson"] is Map
        ? Map<String, dynamic>.from(archive!["missingPerson"] as Map)
        : null;
    final vehicle = archive?["stolenVehicle"] is Map
        ? Map<String, dynamic>.from(archive!["stolenVehicle"] as Map)
        : null;
    final verification = archive?["verification"] is Map
        ? Map<String, dynamic>.from(archive!["verification"] as Map)
        : null;
    final resolution = archive?["resolution"] is Map
        ? Map<String, dynamic>.from(archive!["resolution"] as Map)
        : null;

    return Scaffold(
      appBar: AppBar(
        title: Semantics(header: true, child: const Text("Broadcast archive")),
        actions: [
          Semantics(
            button: true,
            label: "Read broadcast archive aloud",
            child: IconButton(
              tooltip: "Read aloud",
              icon: const Icon(Icons.record_voice_over),
              onPressed: archive == null
                  ? null
                  : () => SemanticsService.announce(
                        "${archive["title"]}. ${archive["status"]}. Reach ${archive["reach"] ?? 0}",
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
                leading: const Icon(Icons.campaign),
                title: Text("${archive["title"]}"),
                subtitle: Text(
                  "${archive["type"]} • ${archive["status"]}\n"
                  "Created ${archive["createdAt"]}\n"
                  "Country ${archive["country"] ?? "Unknown"}",
                ),
              ),
              if (missing != null)
                ListTile(
                  leading: const Icon(Icons.person_search),
                  title: Text("${missing["fullName"] ?? "Missing person"}"),
                  subtitle: Text(
                      "${missing["lastSeenAddress"] ?? "Last seen location unavailable"}"),
                ),
              if (vehicle != null)
                ListTile(
                  leading: const Icon(Icons.directions_car),
                  title: Text(
                      "${vehicle["make"] ?? ""} ${vehicle["model"] ?? ""}"
                          .trim()),
                  subtitle: Text(
                      "${vehicle["registrationMasked"] ?? "Plate masked"} • ${vehicle["colour"] ?? ""}"),
                ),
              ListTile(
                leading: const Icon(Icons.analytics_outlined),
                title: const Text("Reach and engagement"),
                subtitle: Text(
                  "Reach ${archive["reach"] ?? 0} • Views ${archive["views"] ?? 0} • "
                  "Shares ${archive["shares"] ?? 0} • Comments ${archive["commentsCount"] ?? 0} • "
                  "Sightings ${archive["sightingsCount"] ?? 0}",
                ),
              ),
              ListTile(
                leading: const Icon(Icons.verified),
                title: const Text("Verification"),
                subtitle: Text(
                  verification?["adminVerified"] == true
                      ? "Admin verified"
                      : "Pending verification",
                ),
              ),
              ListTile(
                leading: const Icon(Icons.flag),
                title: const Text("Resolution"),
                subtitle: Text(
                  "${resolution?["status"] ?? archive["status"]}\n"
                  "Resolved ${resolution?["resolvedAt"] ?? "Not resolved"}\n"
                  "Withdrawn ${archive["withdrawnAt"] ?? "Not withdrawn"}",
                ),
              ),
              if (archive["withdrawalReason"] != null)
                ListTile(
                  leading: const Icon(Icons.info_outline),
                  title: const Text("Withdrawal reason"),
                  subtitle: Text("${archive["withdrawalReason"]}"),
                ),
              if (_mapList(archive["evidenceGallery"]).isNotEmpty ||
                  _mapList(archive["attachments"]).isNotEmpty) ...[
                const SizedBox(height: 12),
                const Text("Evidence gallery",
                    style: TextStyle(fontWeight: FontWeight.w800)),
                ...(_mapList(archive["evidenceGallery"]).isNotEmpty
                        ? _mapList(archive["evidenceGallery"])
                        : _mapList(archive["attachments"]))
                    .indexed
                    .map(
                      (entry) => ListTile(
                        leading: const Icon(Icons.attach_file),
                        title: Text(_evidenceLabel(entry.$2, entry.$1)),
                        subtitle: Text(_evidenceStatus(entry.$2)),
                      ),
                    ),
              ],
              const SizedBox(height: 12),
              const Text("Timeline",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["timelinePreview"]).map(
                (entry) => ListTile(
                  title: Text("${entry["label"] ?? "Update"}"),
                  subtitle: Text("${entry["at"] ?? ""}"),
                ),
              ),
              const SizedBox(height: 12),
              const Text("Comments",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["comments"]).map(
                (entry) => ListTile(
                  title: Text("${entry["label"] ?? "Comment"}"),
                  subtitle:
                      Text("${entry["body"]}\n${entry["createdAt"] ?? ""}"),
                ),
              ),
              const SizedBox(height: 12),
              const Text("Admin comments",
                  style: TextStyle(fontWeight: FontWeight.w800)),
              ..._mapList(archive["adminComments"]).map(
                (entry) => ListTile(
                  title: const Text("Official update"),
                  subtitle:
                      Text("${entry["body"]}\n${entry["createdAt"] ?? ""}"),
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}
