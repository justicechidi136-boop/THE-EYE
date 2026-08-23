import "dart:async";

import "package:flutter/material.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/eye_semantic_colors.dart";
import "../emergency/active_emergency_contract.dart";
import "../emergency/incident_communication_screen.dart";
import "../emergency/widgets/active_emergency_header.dart";
import "../emergency/widgets/active_emergency_skeleton.dart";
import "../emergency/widgets/active_emergency_tokens.dart";
import "../emergency/widgets/emergency_timeline_card.dart";
import "../emergency/widgets/response_progress_card.dart";
import "../evidence/all_evidence_screen.dart";
import "../evidence/evidence_collection.dart";
import "../evidence/evidence_item.dart";
import "../l10n/generated/app_localizations.dart";
import "../location/citizen_location_details.dart";
import "../presentation/citizen_presentation.dart";
import "activity_history_service.dart";
import "incident_archive_contract.dart";

class IncidentArchiveScreen extends StatefulWidget {
  const IncidentArchiveScreen({
    required this.incidentId,
    required this.accessToken,
    this.service,
    this.apiClient,
    super.key,
  });

  final String incidentId;
  final String accessToken;
  final ActivityHistoryService? service;
  final TheEyeApiClient? apiClient;

  @override
  State<IncidentArchiveScreen> createState() => _IncidentArchiveScreenState();
}

class _IncidentArchiveScreenState extends State<IncidentArchiveScreen> {
  late final TheEyeApiClient _apiClient;
  late final ActivityHistoryService _service;
  final Map<String, Future<Uri>> _evidenceUrls = {};
  IncidentArchiveContract? _archive;
  String? _error;
  bool _loading = true;

  @override
  void initState() {
    super.initState();
    _apiClient = widget.apiClient ?? TheEyeApiClient();
    _service = widget.service ?? ActivityHistoryService(apiClient: _apiClient);
    unawaited(_load());
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final archive = await _service.getIncidentArchiveContract(
        accessToken: widget.accessToken,
        incidentId: widget.incidentId,
      );
      if (!mounted) return;
      setState(() {
        _archive = archive;
        _loading = false;
        _evidenceUrls.clear();
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

  Future<Uri> _evidenceUrl(IncidentArchiveEvidenceItem item) {
    return _evidenceUrls.putIfAbsent(
      item.id,
      () => _service.getIncidentEvidenceViewUrl(
        accessToken: widget.accessToken,
        incidentId: widget.incidentId,
        mediaId: item.id,
      ),
    );
  }

  List<EvidenceItem> _evidenceItems(IncidentArchiveContract archive) {
    final counters = <String, int>{};
    return archive.evidence.map((item) {
      final key = item.mediaType.toLowerCase();
      final index = counters[key] = (counters[key] ?? 0) + 1;
      final prefix = key.contains("video")
          ? "Video"
          : key.contains("audio") || key.contains("voice")
              ? "Audio"
              : "Photo";
      return EvidenceItem(
        id: item.id,
        mediaType: item.mediaType,
        label: "$prefix $index",
        createdAt: item.uploadedAt,
        durationSeconds: item.durationSeconds,
        loadAuthorizedUri: () => _evidenceUrl(item),
      );
    }).toList(growable: false);
  }

  Future<void> _openCommunication(IncidentArchiveContract archive) {
    return Navigator.of(context).push(
      MaterialPageRoute<void>(
        builder: (context) => IncidentCommunicationScreen(
          incidentId: archive.incidentId,
          accessToken: widget.accessToken,
          apiClient: _apiClient,
          readOnly: true,
          publicReference: archive.publicReference,
          locationLabel: archive.location.label.replaceAll("\n", ", "),
          reportedAt: archive.reportedAt,
        ),
      ),
    );
  }

  List<ActiveEmergencyTimelineEntry> _timeline(
    IncidentArchiveContract archive,
  ) {
    return archive.timeline.indexed
        .map(
          (entry) => ActiveEmergencyTimelineEntry(
            id: "archive-${entry.$1}",
            eventType: entry.$2.type,
            message: entry.$2.label,
            createdAt: entry.$2.at!,
          ),
        )
        .toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final l10n = AppLocalizations.of(context);
    final archive = _archive;
    final category = archive == null
        ? "Emergency"
        : citizenIncidentCategoryLabel(archive.category);

    return Scaffold(
      backgroundColor: colors.background,
      body: Column(
        children: [
          ActiveEmergencyHeader(
            title: "$category archive",
            subtitle: archive?.publicReference ?? l10n.completedEmergency,
            refreshEnabled: !_loading,
            onRefresh: () => unawaited(_load()),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _load,
              child: archive == null
                  ? (_error == null
                      ? const ActiveEmergencySkeleton()
                      : _ArchiveError(error: _error!, onRetry: _load))
                  : ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      padding: const EdgeInsets.fromLTRB(16, 12, 16, 32),
                      children: [
                        _TerminalBanner(archive: archive),
                        const SizedBox(height: 14),
                        _ArchiveOverviewCard(archive: archive),
                        const SizedBox(height: 14),
                        EmergencyResponseProgressCard(
                          steps: archive.progressSteps,
                          title: l10n.completedResponseProgress,
                          note: archive.terminalState ==
                                  ArchivedEmergencyTerminalState.cancelled
                              ? "Progress reflects the stages reached before this incident was cancelled."
                              : "Progress reflects the response history recorded for this incident.",
                        ),
                        const SizedBox(height: 14),
                        _FinalStatusCard(archive: archive),
                        const SizedBox(height: 14),
                        _ArchiveEvidenceCard(
                          items: _evidenceItems(archive),
                          onViewAll: () => unawaited(
                            AllEvidenceScreen.open(
                              context,
                              items: _evidenceItems(archive),
                              onRetry: () => unawaited(_load()),
                            ),
                          ),
                        ),
                        const SizedBox(height: 14),
                        _CommunicationHistoryCard(
                          onOpen: () => unawaited(_openCommunication(archive)),
                        ),
                        const SizedBox(height: 14),
                        EmergencyTimelineCard(
                          entries: _timeline(archive),
                          limit: archive.timeline.length,
                        ),
                        const SizedBox(height: 14),
                        _DispatchTimelineCard(
                          entries: archive.dispatchTimeline,
                        ),
                      ],
                    ),
            ),
          ),
        ],
      ),
    );
  }
}

class _TerminalBanner extends StatelessWidget {
  const _TerminalBanner({required this.archive});

  final IncidentArchiveContract archive;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final l10n = AppLocalizations.of(context);
    final cancelled =
        archive.terminalState == ArchivedEmergencyTerminalState.cancelled;
    final accent = cancelled ? colors.warning : colors.verified;
    final icon = cancelled ? Icons.cancel_outlined : Icons.check_circle_outline;
    final finalTime = archive.terminalAt == null
        ? "Final time unavailable"
        : CitizenDateTimeFormatter.formatDateTime(archive.terminalAt!);

    final terminalLabel = switch (archive.terminalState) {
      ArchivedEmergencyTerminalState.resolved => l10n.incidentResolved,
      ArchivedEmergencyTerminalState.cancelled => l10n.incidentCancelled,
      ArchivedEmergencyTerminalState.closed => l10n.incidentClosed,
      ArchivedEmergencyTerminalState.other => archive.terminalBannerLabel,
    };

    return Semantics(
      label: "$terminalLabel. $finalTime",
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: accent.withValues(alpha: 0.12),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: accent.withValues(alpha: 0.45)),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Icon(icon, color: accent, size: 28),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      terminalLabel,
                      style: TextStyle(
                        color: colors.bodyText,
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    const SizedBox(height: 3),
                    Text(finalTime, style: TextStyle(color: colors.mutedText)),
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

class _ArchiveOverviewCard extends StatelessWidget {
  const _ArchiveOverviewCard({required this.archive});

  final IncidentArchiveContract archive;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _ArchiveSectionCard(
      title: l10n.incidentOverview,
      children: [
        _ArchiveField(label: "Reference", value: archive.publicReference),
        _ArchiveField(
          label: "Incident type",
          value: citizenIncidentCategoryLabel(archive.category),
        ),
        if (archive.description?.isNotEmpty == true)
          _ArchiveField(label: "Description", value: archive.description!),
        _ArchiveField(
          label: l10n.reportedLabel,
          value: CitizenDateTimeFormatter.formatDateTime(archive.reportedAt),
        ),
        CitizenLocationDetails(
          key: const ValueKey("archive-readable-location"),
          address: archive.location.address,
          secondaryLocation: archive.location.jurisdiction,
          accuracyMeters: archive.location.accuracyMeters,
          capturedAt: archive.location.capturedAt,
        ),
        _ArchiveField(
          label: "Verification",
          value: archive.verificationStatus,
        ),
        if (archive.communitySummary?.isNotEmpty == true)
          _ArchiveField(
            label: "Community verification",
            value: archive.communitySummary!,
          ),
        _ArchiveField(
          label: "Agency",
          value: archive.agency ?? "Not assigned",
        ),
      ],
    );
  }
}

class _FinalStatusCard extends StatelessWidget {
  const _FinalStatusCard({required this.archive});

  final IncidentArchiveContract archive;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _ArchiveSectionCard(
      title: l10n.finalStatus,
      children: [
        _ArchiveField(label: l10n.finalStatus, value: archive.terminalLabel),
        if (archive.terminalAt != null)
          _ArchiveField(
            label: archive.terminalLabel,
            value: CitizenDateTimeFormatter.formatDateTime(archive.terminalAt!),
          ),
        if (archive.finalReason?.isNotEmpty == true)
          _ArchiveField(
            label: archive.terminalState ==
                    ArchivedEmergencyTerminalState.cancelled
                ? l10n.cancellationReason
                : l10n.resolutionReason,
            value: archive.finalReason!,
          ),
        if (_citizenResolutionSource(archive.resolutionSource) != null)
          _ArchiveField(
            label: "Updated by",
            value: _citizenResolutionSource(archive.resolutionSource)!,
          ),
      ],
    );
  }
}

class _ArchiveEvidenceCard extends StatelessWidget {
  const _ArchiveEvidenceCard({
    required this.items,
    required this.onViewAll,
  });

  final List<EvidenceItem> items;
  final VoidCallback onViewAll;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return _ArchiveSectionCard(
      title: l10n.evidenceLabel,
      children: [
        CompactEvidenceCollection(
          items: items,
          emptyMessage: l10n.noEvidenceSubmitted,
          onViewAll: items.isEmpty ? null : onViewAll,
          showHeader: false,
        ),
      ],
    );
  }
}

class _CommunicationHistoryCard extends StatelessWidget {
  const _CommunicationHistoryCard({required this.onOpen});

  final VoidCallback onOpen;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final l10n = AppLocalizations.of(context);
    return _ArchiveSectionCard(
      title: l10n.communicationHistory,
      children: [
        Row(
          children: [
            Icon(Icons.lock_outline, color: colors.mutedText, size: 18),
            const SizedBox(width: 8),
            Expanded(
              child: Text(
                "${l10n.readOnly}. Messages and attachments can no longer be added.",
                style: TextStyle(color: colors.mutedText, fontSize: 13),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),
        Align(
          alignment: Alignment.centerLeft,
          child: ActiveEmergencySectionLink(
            label: l10n.viewCommunicationHistory,
            onPressed: onOpen,
          ),
        ),
      ],
    );
  }
}

class _DispatchTimelineCard extends StatelessWidget {
  const _DispatchTimelineCard({required this.entries});

  final List<IncidentArchiveDispatchEntry> entries;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final l10n = AppLocalizations.of(context);
    return _ArchiveSectionCard(
      title: "Dispatch timeline",
      children: entries.isEmpty
          ? [
              Text(
                l10n.noDispatchActivityRecorded,
                style: TextStyle(color: colors.mutedText),
              ),
            ]
          : entries
              .map(
                (entry) => Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Icon(
                          Icons.radio_button_checked,
                          size: 12,
                          color: colors.information,
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              entry.label,
                              style: TextStyle(
                                color: colors.bodyText,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                            Text(
                              [
                                if (entry.agency != null) entry.agency!,
                                CitizenDateTimeFormatter.formatDateTime(
                                  entry.at!,
                                ),
                              ].join(" · "),
                              style: TextStyle(
                                color: colors.mutedText,
                                fontSize: 12,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              )
              .toList(growable: false),
    );
  }
}

class _ArchiveSectionCard extends StatelessWidget {
  const _ArchiveSectionCard({required this.title, required this.children});

  final String title;
  final List<Widget> children;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return ActiveEmergencyCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Semantics(
            header: true,
            child: Text(
              title,
              style: TextStyle(
                color: colors.bodyText,
                fontSize: 14.5,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          const SizedBox(height: 12),
          ...children,
        ],
      ),
    );
  }
}

class _ArchiveField extends StatelessWidget {
  const _ArchiveField({
    required this.label,
    required this.value,
  });

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label.toUpperCase(),
            style: TextStyle(
              color: colors.mutedText,
              fontSize: 10.5,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            value,
            style: TextStyle(
              color: colors.bodyText,
              fontSize: 13,
              height: 1.35,
              fontWeight: FontWeight.w600,
            ),
          ),
        ],
      ),
    );
  }
}

class _ArchiveError extends StatelessWidget {
  const _ArchiveError({required this.error, required this.onRetry});

  final String error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final l10n = AppLocalizations.of(context);
    return ListView(
      physics: const AlwaysScrollableScrollPhysics(),
      padding: const EdgeInsets.all(24),
      children: [
        Icon(Icons.error_outline, color: colors.error, size: 40),
        const SizedBox(height: 12),
        Text(
          "Unable to load archive",
          textAlign: TextAlign.center,
          style: TextStyle(
            color: colors.bodyText,
            fontSize: 18,
            fontWeight: FontWeight.w700,
          ),
        ),
        const SizedBox(height: 6),
        Text(
          error,
          textAlign: TextAlign.center,
          style: TextStyle(color: colors.mutedText),
        ),
        const SizedBox(height: 16),
        FilledButton(onPressed: onRetry, child: Text(l10n.retry)),
      ],
    );
  }
}

String? _citizenResolutionSource(String? value) {
  final lower = value?.toLowerCase() ?? "";
  if (lower.isEmpty) return null;
  if (lower.contains("reporter")) return "You";
  if (lower.contains("responder")) return "Response team";
  if (lower.contains("admin") || lower.contains("dispatch")) {
    return "Operations team";
  }
  return null;
}
