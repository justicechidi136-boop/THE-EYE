import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:share_plus/share_plus.dart";

import "../brand.dart";
import "../design_system/components/eye_page_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "../design_system/tokens.dart";
import "../evidence/evidence_attachment_picker.dart";
import "../evidence/all_evidence_screen.dart";
import "../evidence/evidence_collection.dart";
import "../evidence/evidence_item.dart";
import "../evidence/evidence_policy.dart";
import "../incidents/incident_submission_service.dart";
import "../l10n/generated/app_localizations.dart";
import "../location/device_location_service.dart";
import "../location/device_location_state.dart";
import "../location/citizen_location_details.dart";
import "../location/nigeria_location_catalog.dart";
import "../presentation/citizen_location_presentation.dart";
import "../presentation/citizen_broadcast_presenter.dart";
import "../presentation/citizen_presentation.dart";
import "../presentation/citizen_time_picker.dart";
import "../theme/the_eye_theme.dart";
import "../widgets/section_card.dart";
import "broadcast_feed_service.dart";
import "broadcast_public_share.dart";
import "broadcast_action_policy.dart";
import "broadcast_media_upload_service.dart";
import "broadcast_navigation.dart";
import "broadcast_session.dart";
import "broadcast_sighting_service.dart";
import "broadcast_submission_service.dart";
import "broadcast_ui_helpers.dart";
import "../incidents/incident_draft_factory.dart";

enum _MyBroadcastsViewState {
  loading,
  success,
  empty,
  error,
  refreshing,
}

class BroadcastCreateHubScreen extends StatelessWidget {
  const BroadcastCreateHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return _BroadcastShell(
      title: "Create Broadcast",
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          const SectionCard(
            title: "Citizen safety broadcasts",
            child: Text(
              "Publish a missing person or stolen vehicle alert to people near the last known location.",
            ),
          ),
          const SizedBox(height: 16),
          _BroadcastActionTile(
            icon: Icons.person_search,
            title: "Missing person",
            subtitle: "Share details and last known location",
            onTap: () => Navigator.of(context)
                .pushNamed(BroadcastRoutes.createMissingPerson),
          ),
          const SizedBox(height: 12),
          _BroadcastActionTile(
            icon: Icons.directions_car,
            title: "Stolen vehicle",
            subtitle: "Report a stolen car, bike, or plate",
            onTap: () => Navigator.of(context)
                .pushNamed(BroadcastRoutes.createStolenVehicle),
          ),
          const SizedBox(height: 12),
          _BroadcastActionTile(
            icon: Icons.list_alt,
            title: "My broadcasts",
            subtitle: "Manage alerts you have published",
            onTap: () => Navigator.of(context).pushNamed(BroadcastRoutes.mine),
          ),
        ],
      ),
    );
  }
}

class MyBroadcastsScreen extends StatefulWidget {
  const MyBroadcastsScreen({super.key});

  @override
  State<MyBroadcastsScreen> createState() => _MyBroadcastsScreenState();
}

class _MyBroadcastsScreenState extends State<MyBroadcastsScreen> {
  static const _filters = [
    "All",
    "Active",
    "Updated",
    "Resolved",
    "WithdrawnByAuthor",
    "Suspended",
    "Expired",
  ];

  List<BroadcastFeedItem> _items = const [];
  _MyBroadcastsViewState _viewState = _MyBroadcastsViewState.loading;
  String? _error;
  String _statusFilter = "All";

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_load());
    });
  }

  Future<void> _load({bool fromRefresh = false}) async {
    if (!mounted) return;
    final keepListVisible = fromRefresh && _items.isNotEmpty && _error == null;
    setState(() {
      _viewState = keepListVisible
          ? _MyBroadcastsViewState.refreshing
          : _MyBroadcastsViewState.loading;
      _error = null;
    });

    BroadcastSession session;
    try {
      session = BroadcastSession.require(context);
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _viewState = _MyBroadcastsViewState.error;
        _error = "We couldn't load your broadcasts.";
      });
      Navigator.of(context).pushReplacementNamed("/login");
      return;
    }

    if (!session.isAuthenticated || session.accessToken == null) {
      if (!mounted) return;
      setState(() {
        _viewState = _MyBroadcastsViewState.error;
        _error = "We couldn't load your broadcasts.";
      });
      Navigator.of(context).pushReplacementNamed("/login");
      return;
    }
    try {
      final items = await session.broadcastFeedService.listMine(
        accessToken: session.accessToken!,
        status: _statusFilter,
      );
      if (!mounted) return;
      setState(() {
        _items = items;
        _viewState = items.isEmpty
            ? _MyBroadcastsViewState.empty
            : _MyBroadcastsViewState.success;
        _error = null;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = "We couldn't load your broadcasts.";
        _viewState = _MyBroadcastsViewState.error;
      });
      if (error.statusCode == 401 || error.statusCode == 403) {
        Navigator.of(context).pushReplacementNamed("/login");
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "We couldn't load your broadcasts.";
        _viewState = _MyBroadcastsViewState.error;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return _BroadcastShell(
      title: "My broadcasts",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          SizedBox(
            height: 48,
            child: ListView.separated(
              scrollDirection: Axis.horizontal,
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              itemCount: _filters.length,
              separatorBuilder: (_, __) => const SizedBox(width: 8),
              itemBuilder: (context, index) {
                final filter = _filters[index];
                final selected = _statusFilter == filter;
                return FilterChip(
                  label: Text(
                      filter == "WithdrawnByAuthor" ? "Withdrawn" : filter),
                  selected: selected,
                  onSelected: _viewState == _MyBroadcastsViewState.loading
                      ? null
                      : (value) {
                          if (!value) return;
                          setState(() => _statusFilter = filter);
                          unawaited(_load());
                        },
                );
              },
            ),
          ),
          Expanded(
            child: RefreshIndicator(
              onRefresh: () => _load(fromRefresh: true),
              child: _viewState == _MyBroadcastsViewState.loading
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 120),
                        Center(child: CircularProgressIndicator()),
                      ],
                    )
                  : _viewState == _MyBroadcastsViewState.error
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(24),
                          children: [
                            ListTile(
                              leading: const Icon(Icons.cloud_off),
                              title: const Text(
                                  "We couldn't load your broadcasts."),
                              subtitle: Text(
                                _error ?? "Try again in a moment.",
                              ),
                            ),
                            FilledButton(
                              onPressed: () => unawaited(_load()),
                              child: const Text("Retry"),
                            ),
                          ],
                        )
                      : _viewState == _MyBroadcastsViewState.empty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(16),
                              children: [
                                const SectionCard(
                                  title: "No broadcasts yet",
                                  child: Text(
                                    "You haven't created any broadcasts yet.",
                                  ),
                                ),
                                const SizedBox(height: 12),
                                FilledButton.icon(
                                  onPressed: () => Navigator.of(context)
                                      .pushNamed(BroadcastRoutes.create),
                                  icon: const Icon(Icons.add),
                                  label: const Text("Create Broadcast"),
                                ),
                              ],
                            )
                          : Stack(
                              children: [
                                ListView.separated(
                                  physics:
                                      const AlwaysScrollableScrollPhysics(),
                                  padding:
                                      const EdgeInsets.fromLTRB(16, 8, 16, 120),
                                  itemCount: _items.length,
                                  separatorBuilder: (_, __) =>
                                      const SizedBox(height: 12),
                                  itemBuilder: (context, index) {
                                    final item = _items[index];
                                    final presentation =
                                        CitizenBroadcastPresenter.present(
                                      item,
                                      AppLocalizations.of(context),
                                    );
                                    return _BroadcastActionTile(
                                      icon: item.type
                                              .toLowerCase()
                                              .contains("vehicle")
                                          ? Icons.directions_car
                                          : Icons.person_search,
                                      title: presentation.title,
                                      subtitle:
                                          "${presentation.summary}\n${presentation.metadataLine}",
                                      onTap: () =>
                                          Navigator.of(context).pushNamed(
                                        broadcastDetailRoute(item.id)!,
                                      ),
                                    );
                                  },
                                ),
                                if (_viewState ==
                                    _MyBroadcastsViewState.refreshing)
                                  const Positioned(
                                    top: 0,
                                    left: 16,
                                    right: 16,
                                    child: LinearProgressIndicator(),
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

class BroadcastDetailScreen extends StatefulWidget {
  const BroadcastDetailScreen({required this.broadcastId, super.key});

  final String broadcastId;

  @override
  State<BroadcastDetailScreen> createState() => _BroadcastDetailScreenState();
}

class _BroadcastDetailScreenState extends State<BroadcastDetailScreen> {
  BroadcastFeedItem? _item;
  String? _currentUserId;
  String? _error;
  bool _loading = true;
  bool _actionInFlight = false;

  @override
  void initState() {
    super.initState();
    // FUNC-011: never touch InheritedWidgets during initState. Looking up
    // AppScope/BroadcastSession before the first frame can throw and leave
    // `_loading == true` forever (indefinite spinner).
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) unawaited(_loadDetail());
    });
  }

  @override
  void didUpdateWidget(covariant BroadcastDetailScreen oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.broadcastId != widget.broadcastId) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) unawaited(_loadDetail());
      });
    }
  }

  Future<void> _loadDetail() async {
    if (!mounted) return;
    setState(() {
      _loading = true;
      _error = null;
    });

    try {
      final session = BroadcastSession.require(context);
      if (!session.isAuthenticated || session.accessToken == null) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = "Sign in again to open this broadcast.";
        });
        Navigator.of(context).pushReplacementNamed("/login");
        return;
      }

      final broadcastId = widget.broadcastId.trim();
      if (broadcastId.isEmpty) {
        if (!mounted) return;
        setState(() {
          _loading = false;
          _error = "This broadcast link is invalid.";
        });
        return;
      }

      final item = await session.broadcastFeedService.getDetail(
        accessToken: session.accessToken!,
        broadcastId: broadcastId,
      );
      var currentUserId = session.cachedCitizenProfile?.id;
      if (currentUserId == null || currentUserId.trim().isEmpty) {
        try {
          currentUserId = (await session.loadCitizenProfile())?.id;
        } catch (_) {
          // Detail remains readable; owner-only actions stay fail-closed.
        }
      }
      // Never block detail rendering on read-receipt side effects.
      unawaited(session.markBroadcastRead(broadcastId));
      if (!mounted) return;
      setState(() {
        _item = item;
        _currentUserId = currentUserId;
        _loading = false;
        _error = null;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.statusCode == 404
            ? "This broadcast is no longer available."
            : (error.userMessage.trim().isEmpty
                ? "We couldn’t load this broadcast. Try again later."
                : error.userMessage);
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "We couldn’t load this broadcast. Try again later.";
        _loading = false;
      });
    } finally {
      if (mounted && _loading) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _resolve() async {
    final noteController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Mark as resolved"),
        content: TextField(
          controller: noteController,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: "Resolution note (optional)",
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text("Resolve"),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final session = BroadcastSession.require(context);
    final clientResolutionId = createClientSubmissionId();
    setState(() => _actionInFlight = true);
    try {
      await session.broadcastSubmissionService.resolve(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        note: noteController.text.trim(),
        clientResolutionId: clientResolutionId,
      );
      if (!mounted) return;
      showBroadcastSnackBar(context, "Broadcast marked as resolved.");
      unawaited(_loadDetail());
      unawaited(session.loadBroadcastsFromApi(refresh: true));
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
    } catch (_) {
      if (!mounted) return;
      showBroadcastSnackBar(context, "Unable to resolve broadcast.",
          isError: true);
    } finally {
      noteController.dispose();
      if (mounted) setState(() => _actionInFlight = false);
    }
  }

  Future<void> _withdraw() async {
    final reasonController = TextEditingController();
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Withdraw broadcast"),
        content: TextField(
          controller: reasonController,
          maxLines: 3,
          decoration: const InputDecoration(
            labelText: "Reason (optional)",
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(false),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(true),
            child: const Text("Withdraw"),
          ),
        ],
      ),
    );
    if (confirmed != true || !mounted) return;

    final session = BroadcastSession.require(context);
    final clientResolutionId = createClientSubmissionId();
    setState(() => _actionInFlight = true);
    try {
      await session.broadcastSubmissionService.withdraw(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        reason: reasonController.text.trim(),
        clientResolutionId: clientResolutionId,
      );
      if (!mounted) return;
      showBroadcastSnackBar(context, "Broadcast withdrawn.");
      unawaited(_loadDetail());
      unawaited(session.loadBroadcastsFromApi(refresh: true));
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
    } catch (_) {
      if (!mounted) return;
      showBroadcastSnackBar(context, "Unable to withdraw broadcast.",
          isError: true);
    } finally {
      reasonController.dispose();
      if (mounted) setState(() => _actionInFlight = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final item = _item;
    final detailArgs = ModalRoute.of(context)?.settings.arguments;
    final policy = item == null
        ? null
        : BroadcastActionPolicy.forViewer(
            broadcast: item,
            currentUserId: _currentUserId,
          );
    final l10n = AppLocalizations.of(context);
    final returnToCenterOnBack = detailArgs is BroadcastDetailNavigationArgs &&
        detailArgs.returnToCenterOnBack;
    return PopScope(
      canPop: !returnToCenterOnBack,
      onPopInvokedWithResult: (didPop, result) {
        if (didPop || !returnToCenterOnBack) return;
        Navigator.of(context).pushReplacementNamed(BroadcastRoutes.center);
      },
      child: _BroadcastShell(
        title: "Broadcast Detail",
        onBack: returnToCenterOnBack
            ? () => Navigator.of(context).pushReplacementNamed(
                  BroadcastRoutes.center,
                )
            : null,
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : _error != null
                ? ListView(
                    padding: const EdgeInsets.all(24),
                    children: [
                      ListTile(
                        leading: const Icon(Icons.cloud_off),
                        title: const Text("Broadcast unavailable"),
                        subtitle: Text(_error!),
                      ),
                      FilledButton(
                        onPressed: () => unawaited(_loadDetail()),
                        child: const Text("Retry"),
                      ),
                    ],
                  )
                : ListView(
                    padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                    children: [
                      SectionCard(
                        title: item?.title ?? "Safety broadcast",
                        child: _BroadcastDetailBody(item: item),
                      ),
                      const SizedBox(height: 16),
                      SectionCard(
                        title: "Actions",
                        child: Wrap(
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (policy?.canShare == true)
                              OutlinedButton.icon(
                                onPressed: _actionInFlight
                                    ? null
                                    : () => Navigator.of(context).pushNamed(
                                          "${BroadcastRoutes.center}/${widget.broadcastId}/share",
                                          arguments: item,
                                        ),
                                icon: const Icon(Icons.share_outlined),
                                label: Text(l10n.broadcastShare),
                              ),
                            if (policy?.canReportSighting == true)
                              OutlinedButton.icon(
                                onPressed: _actionInFlight
                                    ? null
                                    : () => Navigator.of(context).pushNamed(
                                          "${BroadcastRoutes.center}/${widget.broadcastId}/sighting",
                                          arguments: item,
                                        ),
                                icon: const Icon(Icons.visibility_outlined),
                                label: Text(l10n.reportSighting),
                              ),
                            if (policy?.canComment == true)
                              OutlinedButton.icon(
                                onPressed: _actionInFlight
                                    ? null
                                    : () => Navigator.of(context).pushNamed(
                                          "${BroadcastRoutes.center}/${widget.broadcastId}/comments",
                                        ),
                                icon: const Icon(Icons.chat_bubble_outline),
                                label: Text(l10n.broadcastComments),
                              ),
                            if (policy?.canReportBroadcast == true)
                              OutlinedButton.icon(
                                onPressed: _actionInFlight
                                    ? null
                                    : () => Navigator.of(context).pushNamed(
                                          "${BroadcastRoutes.center}/${widget.broadcastId}/report",
                                          arguments: item,
                                        ),
                                icon: const Icon(Icons.flag_outlined),
                                label: Text(l10n.broadcastReport),
                              ),
                            if (policy?.canResolve == true)
                              FilledButton.icon(
                                onPressed: _actionInFlight ? null : _resolve,
                                icon: const Icon(Icons.check_circle_outline),
                                label: Text(l10n.broadcastResolve),
                              ),
                            if (policy?.canWithdraw == true)
                              OutlinedButton.icon(
                                onPressed: _actionInFlight ? null : _withdraw,
                                icon: const Icon(Icons.unpublished_outlined),
                                label: Text(l10n.broadcastWithdraw),
                              ),
                          ],
                        ),
                      ),
                    ],
                  ),
      ),
    );
  }
}

class _BroadcastDetailBody extends StatelessWidget {
  const _BroadcastDetailBody({required this.item});

  final BroadcastFeedItem? item;

  String? _meta(String key) {
    final value = item?.metadata[key];
    if (value == null) return null;
    final text = value.toString().trim();
    return text.isEmpty ? null : text;
  }

  String? _metaAny(List<String> keys) {
    for (final key in keys) {
      final value = _meta(key);
      if (value != null) return value;
    }
    return null;
  }

  DateTime? _metaDateAny(List<String> keys) {
    for (final key in keys) {
      final raw = _meta(key);
      if (raw == null) continue;
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) return parsed;
    }
    return null;
  }

  String _formatDateTimeWithMeridiem(DateTime value) {
    return "${CitizenDateTimeFormatter.formatDate(value)} · ${CitizenDateTimeFormatter.formatTime(value)}";
  }

  List<Map<String, dynamic>> get _attachments {
    return _metadataAttachments("attachments");
  }

  List<Map<String, dynamic>> get _vehiclePhotos {
    return _metadataAttachments("vehiclePhotos");
  }

  List<Map<String, dynamic>> _metadataAttachments(String key) {
    final raw = item?.metadata[key];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((entry) => Map<String, dynamic>.from(entry))
        .toList(growable: false);
  }

  List<Widget> _buildEvidenceWidgets(
    BuildContext context,
    Color muted, {
    List<Map<String, dynamic>>? source,
    String emptyMessage =
        "Broadcast evidence will appear here when media is attached.",
  }) {
    final attachments = source ?? _attachments;
    final items = _evidenceItems(attachments);
    return [
      const SizedBox(height: 8),
      CompactEvidenceCollection(
        items: items,
        emptyMessage: emptyMessage,
        showHeader: false,
        onViewAll: items.isEmpty
            ? null
            : () => AllEvidenceScreen.open(
                  context,
                  items: items,
                  title: item?.title ?? "Broadcast evidence",
                ),
      ),
    ];
  }

  List<EvidenceItem> _evidenceItems(List<Map<String, dynamic>> attachments) {
    return attachments.indexed.map((entry) {
      final index = entry.$1;
      final attachment = entry.$2;
      final rawUrl = attachment["url"]?.toString().trim() ?? "";
      final duration = attachment["durationSeconds"];
      final angle = attachment["angle"]?.toString().trim().toUpperCase();
      final angleLabel = switch (angle) {
        "FRONT" => "Front photo",
        "REAR" => "Rear photo",
        "SIDE" => "Side photo",
        "OTHER" => "Other photo",
        _ => null,
      };
      return EvidenceItem(
        id: attachment["id"]?.toString() ?? "broadcast-${item?.id}-$index",
        mediaType: attachment["mediaType"]?.toString() ?? "attachment",
        label: angleLabel ??
            (attachment["label"]?.toString().trim().isNotEmpty == true
            ? attachment["label"].toString()
            : "Evidence ${index + 1}"),
        durationSeconds: duration is num ? duration.round() : null,
        authorizedUri: rawUrl.isEmpty ? null : Uri.tryParse(rawUrl),
      );
    }).toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final muted = BrandColors.lightTextMuted;
    final fullName = _meta("fullName");
    final age = _meta("ageOrApproximateAge");
    final gender = _meta("gender");
    final lastSeenAt = _metaDateAny(const ["lastSeenAt"]);
    final lastSeenAddress = _meta("lastSeenAddress");
    final physical = _meta("physicalDescription");
    final clothing = _meta("clothingDescription");
    final additional = _meta("additionalDescription");
    final isMissingPerson =
        (item?.type.toLowerCase().contains("missing") ?? false) ||
            fullName != null;
    final isStolenVehicle =
        (item?.type.toLowerCase().contains("vehicle") ?? false) ||
            _metaAny(const ["make", "vehicleMake"]) != null ||
            _metaAny(const ["registrationNumber", "plateNumber"]) != null;
    final vehicleMake = _metaAny(const ["make", "vehicleMake"]);
    final vehicleModel = _metaAny(const ["model", "vehicleModel"]);
    final vehicleYear = _metaAny(const ["year", "vehicleYear"]);
    final vehicleColor = _metaAny(const ["colour", "color", "vehicleColor"]);
    final vehiclePlate = _metaAny(const [
      "registrationNumber",
      "plateNumber",
      "licensePlate",
      "registrationMasked",
    ]);
    final vehicleVin = _metaAny(const ["vin", "chassisNumber", "vinLastFour"]);
    final vehicleLastSeenAt =
        _metaDateAny(const ["lastSeenAt", "stolenAt", "theftAt"]);
    final vehicleLastSeenAddress = _metaAny(
      const [
        "lastSeenAddress",
        "lastKnownLocation",
        "lastKnownAddress",
        "lastSeenLocation",
      ],
    );
    final distinguishingFeatures = _meta("distinguishingFeatures");
    final theftDescription =
        _metaAny(const ["theftDescription", "additionalDescription"]);
    Map<String, dynamic>? primaryPhoto;
    for (final attachment in _attachments) {
      if (attachment["mediaType"] == "image") {
        primaryPhoto = attachment;
        break;
      }
    }
    final primaryPhotoUrl = primaryPhoto?["url"] as String?;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (item?.authorLabel != null)
          Text(
            item!.authorLabel!,
            style: TextStyle(
              color: item!.adminVerified
                  ? EyeSemanticColors.of(context).verified
                  : muted,
              fontWeight: FontWeight.w600,
            ),
          ),
        Builder(
          builder: (context) {
            final expiry = BroadcastExpiryPresenter.present(
              backendStatus: item?.status,
              expiresAt: item?.expiresAt,
            );
            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  expiry.statusLabel,
                  style: TextStyle(color: muted, fontWeight: FontWeight.w700),
                ),
                if (expiry.detailLine != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    expiry.detailLine!,
                    style: TextStyle(color: muted),
                  ),
                ],
              ],
            );
          },
        ),
        if (item?.publishedAt != null) ...[
          const SizedBox(height: 4),
          Text(
            "Published ${CitizenDateTimeFormatter.formatDateTime(item!.publishedAt!)}",
            style: TextStyle(color: muted),
          ),
        ],
        const SizedBox(height: 12),
        if (isMissingPerson) ...[
          Text("MISSING PERSON",
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                    letterSpacing: 0.6,
                  )),
          const SizedBox(height: 12),
          AspectRatio(
            aspectRatio: 4 / 3,
            child: Container(
              width: double.infinity,
              alignment: Alignment.center,
              decoration: BoxDecoration(
                color: EyeSemanticColors.of(context).elevatedSurface,
                borderRadius: BorderRadius.circular(12),
                border: Border.all(color: EyeSemanticColors.of(context).border),
              ),
              clipBehavior: Clip.antiAlias,
              child: primaryPhotoUrl != null && primaryPhotoUrl.isNotEmpty
                  ? Image.network(
                      primaryPhotoUrl,
                      fit: BoxFit.cover,
                      width: double.infinity,
                      height: double.infinity,
                      errorBuilder: (_, __, ___) => Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(Icons.person_search,
                              size: 56,
                              color: EyeSemanticColors.of(context)
                                  .interactiveText),
                          const SizedBox(height: 8),
                          Text(
                            "Main photograph unavailable",
                            style: TextStyle(color: muted),
                          ),
                        ],
                      ),
                    )
                  : Column(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Icon(Icons.person_search,
                            size: 56,
                            color:
                                EyeSemanticColors.of(context).interactiveText),
                        const SizedBox(height: 8),
                        Text(
                          "Main photograph unavailable",
                          style: TextStyle(color: muted),
                        ),
                      ],
                    ),
            ),
          ),
          const SizedBox(height: 16),
          if (fullName != null)
            Text(
              fullName,
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
          if (age != null) ...[
            const SizedBox(height: 4),
            Text(
              RegExp(r"^\d{1,3}$").hasMatch(age)
                  ? "Age $age"
                  : "Approx. age $age",
              style: Theme.of(context).textTheme.titleMedium,
            ),
          ],
          if (gender != null) ...[
            const SizedBox(height: 4),
            Text(gender),
          ],
          const SizedBox(height: 12),
          Text("Last seen", style: Theme.of(context).textTheme.titleSmall),
          if (lastSeenAt != null) Text(_formatDateTimeWithMeridiem(lastSeenAt)),
          if (lastSeenAddress != null) Text(lastSeenAddress),
          if (physical != null) ...[
            const SizedBox(height: 12),
            Text("Physical description",
                style: Theme.of(context).textTheme.titleSmall),
            Text(physical),
          ],
          if (clothing != null) ...[
            const SizedBox(height: 12),
            Text("Clothing", style: Theme.of(context).textTheme.titleSmall),
            Text(clothing),
          ],
          if (additional != null) ...[
            const SizedBox(height: 12),
            Text("Additional information",
                style: Theme.of(context).textTheme.titleSmall),
            Text(additional),
          ],
          const SizedBox(height: 12),
          Text("Evidence", style: Theme.of(context).textTheme.titleSmall),
          ..._buildEvidenceWidgets(context, muted),
          if ((item?.commentsCount ?? 0) > 0) ...[
            const SizedBox(height: 12),
            Text(
              "Comments: ${item!.commentsCount}",
              style: TextStyle(color: muted),
            ),
          ],
        ] else if (isStolenVehicle) ...[
          Text(
            "STOLEN VEHICLE",
            style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontWeight: FontWeight.w800,
                  letterSpacing: 0.6,
                ),
          ),
          const SizedBox(height: 12),
          if (vehicleMake != null || vehicleModel != null)
            Text(
              [
                "Stolen Vehicle:",
                vehicleMake,
                vehicleModel,
                vehiclePlate,
              ].whereType<String>().join(" "),
              style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
          const SizedBox(height: 16),
          Text("Vehicle Information",
              style: Theme.of(context).textTheme.titleMedium),
          if (vehicleYear != null) ...[
            const SizedBox(height: 8),
            Text("Year", style: Theme.of(context).textTheme.titleSmall),
            Text(vehicleYear),
          ],
          if (vehicleColor != null) ...[
            const SizedBox(height: 8),
            Text("Color", style: Theme.of(context).textTheme.titleSmall),
            Text(vehicleColor),
          ],
          if (vehiclePlate != null) ...[
            const SizedBox(height: 8),
            Text("Plate Number", style: Theme.of(context).textTheme.titleSmall),
            Row(
              children: [
                Expanded(child: SelectableText(vehiclePlate)),
                IconButton(
                  tooltip: "Copy plate number",
                  onPressed: () => Clipboard.setData(
                    ClipboardData(text: vehiclePlate),
                  ),
                  icon: const Icon(Icons.copy_outlined),
                ),
              ],
            ),
          ],
          if (vehicleVin != null) ...[
            const SizedBox(height: 8),
            Text("VIN", style: Theme.of(context).textTheme.titleSmall),
            Row(
              children: [
                Expanded(child: SelectableText(vehicleVin)),
                IconButton(
                  tooltip: "Copy VIN",
                  onPressed: () => Clipboard.setData(
                    ClipboardData(text: vehicleVin),
                  ),
                  icon: const Icon(Icons.copy_outlined),
                ),
              ],
            ),
          ],
          if (distinguishingFeatures != null) ...[
            const SizedBox(height: 16),
            Text(
              "Distinguishing Features",
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: 4),
            SelectableText(distinguishingFeatures),
          ],
          const SizedBox(height: 16),
          Text("Vehicle Photos",
              style: Theme.of(context).textTheme.titleMedium),
          ..._buildEvidenceWidgets(
            context,
            muted,
            source: _vehiclePhotos,
            emptyMessage: "No vehicle reference photos attached.",
          ),
          const SizedBox(height: 16),
          Text("Last Seen", style: Theme.of(context).textTheme.titleMedium),
          if (vehicleLastSeenAt != null)
            Text(_formatDateTimeWithMeridiem(vehicleLastSeenAt)),
          if (vehicleLastSeenAddress != null) Text(vehicleLastSeenAddress),
          if (theftDescription != null ||
              (item?.body ?? "").trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Text("Description of Theft",
                style: Theme.of(context).textTheme.titleMedium),
            Text(theftDescription ?? item?.body ?? ""),
          ],
          const SizedBox(height: 12),
          Text("Incident Evidence",
              style: Theme.of(context).textTheme.titleMedium),
          ..._buildEvidenceWidgets(context, muted),
          if ((item?.commentsCount ?? 0) > 0) ...[
            const SizedBox(height: 12),
            Text(
              "Comments: ${item!.commentsCount}",
              style: TextStyle(color: muted),
            ),
          ],
        ] else ...[
          Text(item?.body ?? ""),
          if ((item?.commentsCount ?? 0) > 0) ...[
            const SizedBox(height: 8),
            Text(
              "${item!.commentsCount} community comment${item!.commentsCount == 1 ? "" : "s"}",
              style: TextStyle(color: muted),
            ),
          ],
        ],
      ],
    );
  }
}

class BroadcastCommentsScreen extends StatefulWidget {
  const BroadcastCommentsScreen({required this.broadcastId, super.key});

  final String broadcastId;

  @override
  State<BroadcastCommentsScreen> createState() =>
      _BroadcastCommentsScreenState();
}

class _BroadcastCommentsScreenState extends State<BroadcastCommentsScreen> {
  final _commentController = TextEditingController();
  List<BroadcastCommentItem> _comments = const [];
  bool _didLoad = false;
  bool _loading = true;
  bool _submitting = false;
  BroadcastCommentItem? _replyTo;
  String? _error;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didLoad) return;
    _didLoad = true;
    unawaited(_load());
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) {
      setState(() {
        _loading = false;
        _error = "Sign in again to view broadcast comments.";
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final comments = await session.broadcastFeedService.listComments(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
      );
      if (!mounted) return;
      setState(() {
        _comments = comments;
        _loading = false;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to load comments.";
        _loading = false;
      });
    }
  }

  Future<void> _submit() async {
    final body = _commentController.text.trim();
    if (body.isEmpty) {
      showBroadcastSnackBar(context, "Enter a comment.", isError: true);
      return;
    }
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
    setState(() => _submitting = true);
    try {
      await session.broadcastSubmissionService.addComment(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        body: body,
        parentId: _replyTo?.id,
      );
      _commentController.clear();
      setState(() => _replyTo = null);
      await _load();
      if (!mounted) return;
      showBroadcastSnackBar(context, "Comment posted.");
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
    } catch (_) {
      if (!mounted) return;
      showBroadcastSnackBar(context, "Unable to post comment.", isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  Future<void> _edit(BroadcastCommentItem comment) async {
    final controller = TextEditingController(text: comment.body);
    final body = await showDialog<String>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text("Edit comment"),
        content: TextField(
          controller: controller,
          autofocus: true,
          maxLength: 2000,
          maxLines: 5,
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(context).pop(),
            child: const Text("Cancel"),
          ),
          FilledButton(
            onPressed: () => Navigator.of(context).pop(controller.text.trim()),
            child: const Text("Save"),
          ),
        ],
      ),
    );
    controller.dispose();
    if (body == null || body.isEmpty || !mounted) return;
    final session = BroadcastSession.require(context);
    try {
      await session.broadcastSubmissionService.updateComment(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        commentId: comment.id,
        body: body,
      );
      await _load();
    } on IncidentApiException catch (error) {
      if (mounted) {
        showBroadcastSnackBar(context, error.userMessage, isError: true);
      }
    }
  }

  Future<void> _delete(BroadcastCommentItem comment) async {
    final confirmed = await showDialog<bool>(
          context: context,
          builder: (context) => AlertDialog(
            title: const Text("Delete comment?"),
            content: const Text("This cannot be undone."),
            actions: [
              TextButton(
                onPressed: () => Navigator.of(context).pop(false),
                child: const Text("Cancel"),
              ),
              FilledButton(
                onPressed: () => Navigator.of(context).pop(true),
                child: const Text("Delete"),
              ),
            ],
          ),
        ) ??
        false;
    if (!confirmed || !mounted) return;
    final session = BroadcastSession.require(context);
    try {
      await session.broadcastSubmissionService.deleteComment(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        commentId: comment.id,
      );
      await _load();
    } on IncidentApiException catch (error) {
      if (mounted) {
        showBroadcastSnackBar(context, error.userMessage, isError: true);
      }
    }
  }

  Future<void> _react(BroadcastCommentItem comment, String reaction) async {
    final session = BroadcastSession.require(context);
    try {
      await session.broadcastSubmissionService.reactToComment(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        commentId: comment.id,
        reaction: reaction,
      );
      await _load();
    } on IncidentApiException catch (error) {
      if (mounted) {
        showBroadcastSnackBar(context, error.userMessage, isError: true);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return _BroadcastShell(
      title: "Comments",
      child: Column(
        children: [
          Expanded(
            child: _loading
                ? const Center(child: CircularProgressIndicator())
                : _error != null
                    ? ListView(
                        padding: const EdgeInsets.all(24),
                        children: [
                          Text(_error!),
                          FilledButton(
                            onPressed: () => unawaited(_load()),
                            child: const Text("Retry"),
                          ),
                        ],
                      )
                    : RefreshIndicator(
                        onRefresh: _load,
                        child: _comments.isEmpty
                            ? ListView(
                                physics: const AlwaysScrollableScrollPhysics(),
                                padding: const EdgeInsets.all(16),
                                children: const [
                                  SectionCard(
                                    title: "No comments yet",
                                    child: Text(
                                      "Be the first to share relevant information about this broadcast.",
                                    ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 8, 16, 16),
                                itemCount: _comments.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 8),
                                itemBuilder: (context, index) {
                                  final comment = _comments[index];
                                  final currentUserId =
                                      BroadcastSession.require(
                                    context,
                                  ).cachedCitizenProfile?.id;
                                  final isOwner = currentUserId != null &&
                                      currentUserId == comment.authorUserId;
                                  return Padding(
                                    padding: EdgeInsets.only(
                                      left: comment.parentId == null ? 0 : 24,
                                    ),
                                    child: SectionCard(
                                      title: comment.authorName,
                                      child: Column(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.start,
                                        children: [
                                          Text(comment.body),
                                          if (comment.createdAt != null) ...[
                                            const SizedBox(height: 8),
                                            Text(
                                              formatBroadcastAge(
                                                comment.createdAt!,
                                              ),
                                              style: const TextStyle(
                                                color:
                                                    BrandColors.lightTextMuted,
                                              ),
                                            ),
                                          ],
                                          const SizedBox(height: 8),
                                          Wrap(
                                            spacing: 4,
                                            runSpacing: 4,
                                            children: [
                                              TextButton.icon(
                                                onPressed: () => unawaited(
                                                  _react(comment, "Helpful"),
                                                ),
                                                icon: const Icon(
                                                  Icons.thumb_up_outlined,
                                                ),
                                                label: Text(
                                                  "Helpful ${comment.helpfulReactions}",
                                                ),
                                              ),
                                              TextButton.icon(
                                                onPressed: () => unawaited(
                                                  _react(comment, "Thanks"),
                                                ),
                                                icon: const Icon(
                                                  Icons
                                                      .volunteer_activism_outlined,
                                                ),
                                                label: Text(
                                                  "Thanks ${comment.thanksReactions}",
                                                ),
                                              ),
                                              if (comment.parentId == null)
                                                TextButton(
                                                  onPressed: () => setState(
                                                    () => _replyTo = comment,
                                                  ),
                                                  child: const Text("Reply"),
                                                ),
                                              if (isOwner)
                                                IconButton(
                                                  tooltip: "Edit comment",
                                                  onPressed: () =>
                                                      unawaited(_edit(comment)),
                                                  icon: const Icon(
                                                      Icons.edit_outlined),
                                                ),
                                              if (isOwner)
                                                IconButton(
                                                  tooltip: "Delete comment",
                                                  onPressed: () => unawaited(
                                                      _delete(comment)),
                                                  icon: const Icon(
                                                      Icons.delete_outline),
                                                ),
                                            ],
                                          ),
                                        ],
                                      ),
                                    ),
                                  );
                                },
                              ),
                      ),
          ),
          SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 16),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        if (_replyTo != null)
                          InputChip(
                            label: Text("Replying to ${_replyTo!.authorName}"),
                            onDeleted: () => setState(() => _replyTo = null),
                          ),
                        TextField(
                          controller: _commentController,
                          minLines: 1,
                          maxLines: 3,
                          maxLength: 2000,
                          decoration: InputDecoration(
                            hintText: _replyTo == null
                                ? "Add a comment"
                                : "Write a reply",
                            counterText: "",
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
                    style: FilledButton.styleFrom(
                      minimumSize: const Size(56, 56),
                      padding: EdgeInsets.zero,
                    ),
                    onPressed: _submitting ? null : _submit,
                    child: _submitting
                        ? const SizedBox(
                            width: 18,
                            height: 18,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Icon(Icons.send),
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

class BroadcastReportScreen extends StatefulWidget {
  const BroadcastReportScreen({
    required this.broadcastId,
    this.source,
    super.key,
  });

  final String broadcastId;
  final BroadcastFeedItem? source;

  @override
  State<BroadcastReportScreen> createState() => _BroadcastReportScreenState();
}

class _BroadcastReportScreenState extends State<BroadcastReportScreen> {
  late BroadcastReportContent _content;
  late String _reason;
  final _detailsController = TextEditingController();
  bool _submitting = false;
  String? _detailsError;

  @override
  void initState() {
    super.initState();
    _content = broadcastReportContentForType(widget.source?.type);
    _reason = _content.reasons.first.code;
  }

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
    final trimmedDetails = _detailsController.text.trim();
    if (_reason == "Other" && trimmedDetails.isEmpty) {
      setState(() => _detailsError = "Additional details are required.");
      return;
    }
    setState(() => _submitting = true);
    try {
      await session.broadcastSubmissionService.report(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        reason: _reason,
        details: _reason == "Other"
            ? trimmedDetails
            : (trimmedDetails.isEmpty ? null : trimmedDetails),
      );
      if (!mounted) return;
      showBroadcastSnackBar(
        context,
        "Broadcast reported. Thank you. Our moderation team will review this report.",
      );
      Navigator.of(context).pop();
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
    } catch (_) {
      if (!mounted) return;
      showBroadcastSnackBar(context, "Unable to submit report.", isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final showAdditionalDetails = _reason == "Other";
    return _BroadcastShell(
      title: "Report Broadcast",
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          SectionCard(
            title: _content.heading,
            child: const Text(
              "Reports are reviewed by moderators. Misuse may affect account standing.",
            ),
          ),
          const SizedBox(height: 16),
          ..._content.reasons.map(
            (reason) => RadioListTile<String>(
              value: reason.code,
              groupValue: _reason,
              onChanged: _submitting
                  ? null
                  : (value) => setState(() {
                        _reason = value ?? _reason;
                        _detailsError = null;
                      }),
              title: Text(reason.label),
            ),
          ),
          if (showAdditionalDetails) ...[
            const SizedBox(height: 8),
            TextField(
              controller: _detailsController,
              maxLines: 4,
              onChanged: (_) {
                if (_detailsError == null) return;
                setState(() => _detailsError = null);
              },
              decoration: InputDecoration(
                labelText: "Additional details",
                errorText: _detailsError,
              ),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Submit report"),
          ),
        ],
      ),
    );
  }
}

class BroadcastShareScreen extends StatefulWidget {
  const BroadcastShareScreen({
    required this.broadcastId,
    this.fallbackSource,
    this.shareInvoker,
    super.key,
  });

  final String broadcastId;
  final BroadcastFeedItem? fallbackSource;
  final Future<void> Function(BroadcastSharePayload payload)? shareInvoker;

  @override
  State<BroadcastShareScreen> createState() => _BroadcastShareScreenState();
}

class _BroadcastShareScreenState extends State<BroadcastShareScreen> {
  BroadcastSharePayload? _payload;
  bool _didLoad = false;
  bool _loading = true;
  String? _error;
  bool _shareOpened = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_didLoad) return;
    _didLoad = true;
    unawaited(_load());
  }

  Future<void> _load() async {
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) {
      setState(() {
        _loading = false;
        _error = "Sign in again to share this broadcast.";
      });
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      late final BroadcastSharePayload payload;
      try {
        payload = await session.broadcastFeedService
            .getSharePayload(
              accessToken: session.accessToken!,
              broadcastId: widget.broadcastId,
              fallbackSource: widget.fallbackSource,
            )
            .timeout(const Duration(seconds: 12));
      } on TimeoutException {
        final fallback = widget.fallbackSource;
        if (fallback == null) rethrow;
        payload = BroadcastSharePayload.fromPublic(
          BroadcastPublicShareMapper.fromFeedItemFallback(fallback),
        );
      }
      if (!mounted) return;
      setState(() {
        _payload = payload;
        _loading = false;
      });
      await _openNativeShare(payload);
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.userMessage;
        _loading = false;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _error = "Unable to prepare share content.";
        _loading = false;
      });
    }
  }

  Future<void> _openNativeShare(BroadcastSharePayload payload) async {
    if (_shareOpened) return;
    _shareOpened = true;
    try {
      final invoker = widget.shareInvoker;
      if (invoker != null) {
        await invoker(payload);
      } else {
        await SharePlus.instance.share(
          ShareParams(text: payload.shareText, subject: payload.title),
        );
      }
    } catch (_) {
      if (mounted) {
        showBroadcastSnackBar(
          context,
          "Unable to open the share sheet. You can copy the share text instead.",
          isError: true,
        );
      }
    } finally {
      _shareOpened = false;
    }
  }

  Future<void> _copyShareText() async {
    final text = _payload?.shareText;
    if (text == null || text.isEmpty) return;
    await Clipboard.setData(ClipboardData(text: text));
    if (!mounted) return;
    showBroadcastSnackBar(context, "Share text copied.");
  }

  @override
  Widget build(BuildContext context) {
    final payload = _payload;
    return _BroadcastShell(
      title: "Share broadcast",
      child: _loading
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? ListView(
                  padding: const EdgeInsets.all(24),
                  children: [
                    Text(_error!),
                    FilledButton(
                      onPressed: () => unawaited(_load()),
                      child: const Text("Retry"),
                    ),
                  ],
                )
              : ListView(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
                  children: [
                    if (payload?.locallyGenerated == true) ...[
                      SectionCard(
                        title: "Local preview",
                        child: Text(
                          "Share preview generated on this device because the public share service is temporarily unavailable.",
                          style: TextStyle(
                            color: EyeSemanticColors.of(context).mutedText,
                          ),
                        ),
                      ),
                      const SizedBox(height: 12),
                    ],
                    SectionCard(
                      title: payload?.title ?? "Safety broadcast",
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(payload?.body ?? ""),
                          if (payload?.deepLink != null) ...[
                            const SizedBox(height: 12),
                            SelectableText(
                              payload!.deepLink!,
                              style: TextStyle(
                                color: EyeSemanticColors.of(context)
                                    .interactiveText,
                              ),
                            ),
                          ],
                        ],
                      ),
                    ),
                    const SizedBox(height: 16),
                    FilledButton.icon(
                      onPressed: payload == null
                          ? null
                          : () {
                              _shareOpened = false;
                              unawaited(_openNativeShare(payload));
                            },
                      icon: const Icon(Icons.share_outlined),
                      label: const Text("Share"),
                    ),
                    const SizedBox(height: 8),
                    TextButton.icon(
                      onPressed: _copyShareText,
                      icon: const Icon(Icons.copy_outlined),
                      label: const Text("Copy share text"),
                    ),
                  ],
                ),
    );
  }
}

class SubmitSightingScreen extends StatefulWidget {
  const SubmitSightingScreen({
    required this.broadcastId,
    this.currentLocationProbe,
    this.locationProvider = const NigeriaLocationCatalog(),
    super.key,
  });

  final String broadcastId;
  final Future<DeviceLocationState> Function()? currentLocationProbe;
  final LocationSelectionProvider locationProvider;

  @override
  State<SubmitSightingScreen> createState() => _SubmitSightingScreenState();
}

class _SubmitSightingScreenState extends State<SubmitSightingScreen> {
  final _evidenceSectionKey = GlobalKey<ManagedEvidenceSectionState>();
  final _descriptionController = TextEditingController();
  final _streetAddressController = TextEditingController();
  final _customCityController = TextEditingController();
  late final BroadcastMediaUploadService _uploadService;
  final String _clientActionId = createClientSubmissionId();
  DateTime _observedAt = DateTime.now();
  _SightingLocationMode? _locationMode;
  bool _submitting = false;
  BroadcastFeedItem? _headerItem;
  DeviceLocationState? _capturedLocation;
  String? _selectedState;
  String? _selectedCity;
  String? _locationStatus;
  bool _uploadServiceInitialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_uploadServiceInitialized) return;
    _uploadServiceInitialized = true;
    _uploadService = BroadcastMediaUploadService(
      apiClient: BroadcastSession.require(context).apiClient,
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is BroadcastFeedItem) {
        setState(() => _headerItem = args);
      }
    });
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _streetAddressController.dispose();
    _customCityController.dispose();
    super.dispose();
  }

  Future<void> _captureLocation() async {
    setState(() => _locationStatus = "Finding your current location...");
    final outcome = await (widget.currentLocationProbe ??
        DeviceLocationService().probeCurrentLocation)();
    if (!mounted) return;
    if (!outcome.isAcquired || !outcome.hasCoordinates) {
      setState(() {
        _capturedLocation = null;
        _locationStatus = outcome.message ??
            "Current location is unavailable. Enter the location manually.";
      });
      return;
    }
    setState(() {
      _capturedLocation = outcome;
      _locationStatus = null;
    });
  }

  Future<void> _pickObservedDate() async {
    final picked = await showDatePicker(
      context: context,
      firstDate: DateTime.now().subtract(const Duration(days: 30)),
      lastDate: DateTime.now().add(const Duration(days: 1)),
      initialDate: _observedAt,
    );
    if (picked == null || !mounted) return;
    setState(() {
      _observedAt = DateTime(
        picked.year,
        picked.month,
        picked.day,
        _observedAt.hour,
        _observedAt.minute,
      );
    });
  }

  Future<void> _pickObservedTime() async {
    final picked = await showCitizenTimePicker(
      context,
      initialTime: TimeOfDay.fromDateTime(_observedAt),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _observedAt = DateTime(
        _observedAt.year,
        _observedAt.month,
        _observedAt.day,
        picked.hour,
        picked.minute,
      );
    });
  }

  Future<void> _submit() async {
    if (_submitting) return;
    final description = _descriptionController.text.trim();
    if (description.isEmpty) {
      showBroadcastSnackBar(context, "Describe what you saw.", isError: true);
      return;
    }
    if (_locationMode == null) {
      showBroadcastSnackBar(context, "Choose a sighting location.",
          isError: true);
      return;
    }
    if (_locationMode == _SightingLocationMode.currentGps &&
        (_capturedLocation?.hasCoordinates != true)) {
      showBroadcastSnackBar(
        context,
        "Capture your current location or enter it manually.",
        isError: true,
      );
      return;
    }
    final usesOtherCity = _selectedCity == NigeriaLocationCatalog.otherCityTown;
    final cityTown = usesOtherCity
        ? _customCityController.text.trim()
        : _selectedCity?.trim();
    if (_locationMode == _SightingLocationMode.manual) {
      if (_selectedState == null ||
          cityTown == null ||
          cityTown.isEmpty ||
          _streetAddressController.text.trim().length < 2) {
        showBroadcastSnackBar(
          context,
          "Enter State, City/Town, and Street/Road Address.",
          isError: true,
        );
        return;
      }
    }
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
    setState(() => _submitting = true);
    try {
      final attachments = await _uploadService.uploadAttachments(
        attachments: _evidenceSectionKey.currentState?.attachments ?? const [],
        accessToken: session.accessToken!,
      );
      await session.broadcastSubmissionService.submitSighting(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        clientActionId: _clientActionId,
        description: description,
        observedAt: _observedAt.toUtc().toIso8601String(),
        locationMode: _locationMode!.apiValue,
        latitude: _locationMode == _SightingLocationMode.currentGps
            ? _capturedLocation!.latitude
            : null,
        longitude: _locationMode == _SightingLocationMode.currentGps
            ? _capturedLocation!.longitude
            : null,
        countryCode: "NG",
        state: _locationMode == _SightingLocationMode.manual
            ? _selectedState
            : _capturedLocation?.state,
        cityTown: _locationMode == _SightingLocationMode.manual
            ? cityTown
            : _capturedLocation?.locality,
        streetAddress: _locationMode == _SightingLocationMode.manual
            ? _streetAddressController.text.trim()
            : _capturedLocation?.street,
        displayAddress: _locationMode == _SightingLocationMode.currentGps
            ? CitizenLocationPresentation(
                streetAddress: _capturedLocation?.street,
                subLocality: _capturedLocation?.subLocality,
                cityTown: _capturedLocation?.locality,
                lga: _capturedLocation?.lga,
                state: _capturedLocation?.state,
              ).lines.join(", ")
            : CitizenLocationPresentation(
                streetAddress: _streetAddressController.text,
                cityTown: cityTown,
                state: _selectedState,
              ).lines.join(", "),
        capturedAt: _capturedLocation?.capturedAt?.toUtc().toIso8601String(),
        confidence: "ReporterProvided",
        attachments: attachments,
      );
      if (!mounted) return;
      Navigator.of(context).pushReplacement(
        MaterialPageRoute(
          builder: (_) =>
              _SightingSubmittedScreen(broadcastId: widget.broadcastId),
        ),
      );
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
    } on BroadcastMediaUploadFailure catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.message, isError: true);
    } catch (_) {
      if (!mounted) return;
      showBroadcastSnackBar(context, "Unable to submit sighting.",
          isError: true);
    } finally {
      if (mounted) setState(() => _submitting = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final headerTitle = _headerItem == null
        ? "Report Sighting"
        : [
            _headerItem!.metadata["make"],
            _headerItem!.metadata["model"],
          ].whereType<String>().join(" ").trim().isEmpty
            ? _headerItem!.title
            : [
                _headerItem!.metadata["make"],
                _headerItem!.metadata["model"],
              ].whereType<String>().join(" ");
    return _BroadcastShell(
      title: l10n.reportSighting,
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          SectionCard(title: "Vehicle", child: Text(headerTitle)),
          const SizedBox(height: 16),
          SectionCard(
            title: "WHEN",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 12,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _submitting ? null : _pickObservedDate,
                      icon: const Icon(Icons.event_outlined),
                      label: Text(
                          CitizenDateTimeFormatter.formatDate(_observedAt)),
                    ),
                    OutlinedButton.icon(
                      onPressed: _submitting ? null : _pickObservedTime,
                      icon: const Icon(Icons.schedule_outlined),
                      label: Text(
                          CitizenDateTimeFormatter.formatTime(_observedAt)),
                    ),
                  ],
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "WHERE",
            child: Material(
              color: Colors.transparent,
              child: Column(
                children: [
                  RadioListTile<_SightingLocationMode>(
                    value: _SightingLocationMode.currentGps,
                    groupValue: _locationMode,
                    onChanged: _submitting
                        ? null
                        : (value) async {
                            setState(() => _locationMode = value);
                            await _captureLocation();
                          },
                    title: Text(l10n.useCurrentLocation),
                  ),
                  RadioListTile<_SightingLocationMode>(
                    value: _SightingLocationMode.manual,
                    groupValue: _locationMode,
                    onChanged: _submitting
                        ? null
                        : (value) => setState(() => _locationMode = value),
                    title: Text(l10n.enterManually),
                  ),
                  if (_locationMode == _SightingLocationMode.manual) ...[
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedState,
                      decoration: InputDecoration(labelText: l10n.stateLabel),
                      items: widget.locationProvider.states
                          .map((state) => DropdownMenuItem(
                                value: state,
                                child: Text(state),
                              ))
                          .toList(growable: false),
                      onChanged: _submitting
                          ? null
                          : (value) => setState(() {
                                _selectedState = value;
                                _selectedCity = null;
                                _customCityController.clear();
                              }),
                    ),
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      value: _selectedCity,
                      decoration: InputDecoration(labelText: l10n.cityTown),
                      items: _selectedState == null
                          ? const []
                          : widget.locationProvider
                              .citiesForState(_selectedState!)
                              .map((city) => DropdownMenuItem(
                                    value: city,
                                    child: Text(city),
                                  ))
                              .toList(growable: false),
                      onChanged: _submitting || _selectedState == null
                          ? null
                          : (value) => setState(() => _selectedCity = value),
                    ),
                    if (_selectedCity ==
                        NigeriaLocationCatalog.otherCityTown) ...[
                      const SizedBox(height: 8),
                      TextField(
                        controller: _customCityController,
                        enabled: !_submitting,
                        decoration:
                            InputDecoration(labelText: l10n.cityTownName),
                      ),
                    ],
                    const SizedBox(height: 8),
                    TextField(
                      controller: _streetAddressController,
                      enabled: !_submitting,
                      decoration: InputDecoration(
                        labelText: l10n.streetRoadAddress,
                        helperText: "Example: Stadium Road or Rumuola Junction",
                      ),
                    ),
                  ],
                  if (_capturedLocation?.hasCoordinates == true)
                    Padding(
                      padding: const EdgeInsets.only(top: 8),
                      child: CitizenLocationDetails(
                        address: CitizenLocationPresentation(
                          streetAddress: _capturedLocation?.street,
                          subLocality: _capturedLocation?.subLocality,
                          cityTown: _capturedLocation?.locality,
                          lga: _capturedLocation?.lga,
                          state: _capturedLocation?.state,
                        ).label,
                        accuracyMeters: _capturedLocation?.accuracyMeters,
                        capturedAt: _capturedLocation?.capturedAt,
                      ),
                    ),
                  if (_locationStatus != null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _locationStatus!,
                        style: TextStyle(
                            color: EyeSemanticColors.of(context).mutedText),
                      ),
                    ),
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          const Text("DETAILS", style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: "What did you observe?",
            ),
          ),
          const SizedBox(height: 16),
          const Text("EVIDENCE", style: TextStyle(fontWeight: FontWeight.w700)),
          const SizedBox(height: 8),
          ManagedEvidenceSection(
            key: _evidenceSectionKey,
            lowDataMode: false,
            policy: EvidencePolicy.incident,
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Safety notice",
            child: Text(
              "Do not approach suspects. Share only what you observed and stay in a safe location.",
              style: TextStyle(color: EyeSemanticColors.of(context).mutedText),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton(
            onPressed: _submitting ? null : _submit,
            child: _submitting
                ? const SizedBox(
                    width: 22,
                    height: 22,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text("Submit sighting"),
          ),
        ],
      ),
    );
  }
}

enum _SightingLocationMode {
  currentGps("CURRENT_GPS"),
  manual("MANUAL");

  const _SightingLocationMode(this.apiValue);
  final String apiValue;
}

class SightingDetailsScreen extends StatefulWidget {
  const SightingDetailsScreen({
    required this.broadcastId,
    required this.sightingId,
    this.service,
    super.key,
  });

  final String broadcastId;
  final String sightingId;
  final BroadcastSightingService? service;

  @override
  State<SightingDetailsScreen> createState() => _SightingDetailsScreenState();
}

class _SightingDetailsScreenState extends State<SightingDetailsScreen> {
  BroadcastSightingDetail? _detail;
  String? _error;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => unawaited(_load()));
  }

  Future<void> _load() async {
    setState(() => _error = null);
    try {
      final session = BroadcastSession.require(context);
      final token = session.accessToken;
      if (token == null) throw StateError("Authentication required");
      final detail = await (widget.service ??
              BroadcastSightingService(apiClient: session.apiClient))
          .getDetail(
        accessToken: token,
        broadcastId: widget.broadcastId,
        sightingId: widget.sightingId,
      );
      if (mounted) setState(() => _detail = detail);
    } catch (_) {
      if (mounted) {
        setState(() => _error = "Unable to load sighting details.");
      }
    }
  }

  List<EvidenceItem> _evidenceItems(BroadcastSightingDetail detail) {
    return detail.attachments.indexed.map((entry) {
      final index = entry.$1;
      final attachment = entry.$2;
      final rawUrl = attachment["url"]?.toString().trim() ?? "";
      final duration = attachment["durationSeconds"];
      return EvidenceItem(
        id: attachment["id"]?.toString() ?? "sighting-${detail.id}-$index",
        mediaType: attachment["mediaType"]?.toString() ?? "attachment",
        label: attachment["label"]?.toString() ?? "Evidence ${index + 1}",
        durationSeconds: duration is num ? duration.round() : null,
        authorizedUri: rawUrl.isEmpty ? null : Uri.tryParse(rawUrl),
      );
    }).toList(growable: false);
  }

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final detail = _detail;
    final location = detail?.location ?? const <String, dynamic>{};
    final locationLabel = CitizenLocationPresentation(
      streetAddress: location["streetAddress"]?.toString(),
      subLocality: location["subLocality"]?.toString(),
      cityTown: location["cityTown"]?.toString(),
      lga: location["lga"]?.toString(),
      state: location["state"]?.toString(),
      country: location["country"]?.toString(),
    ).label;
    final evidenceItems =
        detail == null ? const <EvidenceItem>[] : _evidenceItems(detail);
    return _BroadcastShell(
      title: l10n.sightingDetails,
      child: detail == null
          ? Center(
              child: _error == null
                  ? const CircularProgressIndicator()
                  : Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(_error!),
                        const SizedBox(height: 12),
                        OutlinedButton(
                          onPressed: _load,
                          child: Text(l10n.retry),
                        ),
                      ],
                    ),
            )
          : ListView(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
              children: [
                Text(
                  l10n.newSightingReported,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: 6),
                Text(detail.subjectSummary),
                const SizedBox(height: 16),
                SectionCard(
                  title: "Sighting",
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (detail.reportedAt != null)
                        Text(
                            "${l10n.reportedLabel}: ${CitizenDateTimeFormatter.formatDateTime(detail.reportedAt!)}"),
                      if (detail.observedAt != null) ...[
                        const SizedBox(height: 6),
                        Text(
                            "${l10n.observedLabel}: ${CitizenDateTimeFormatter.formatDateTime(detail.observedAt!)}"),
                      ],
                      const SizedBox(height: 12),
                      CitizenLocationDetails(
                        address: location["displayAddress"]
                                    ?.toString()
                                    .trim()
                                    .isNotEmpty ==
                                true
                            ? location["displayAddress"].toString()
                            : locationLabel,
                        accuracyMeters:
                            (location["accuracyMeters"] as num?)?.toDouble(),
                        capturedAt: DateTime.tryParse(
                          location["capturedAt"]?.toString() ?? "",
                        ),
                      ),
                      const SizedBox(height: 12),
                      Text(l10n.whatWasObserved,
                          style: const TextStyle(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 4),
                      Text(detail.description),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SectionCard(
                  title: l10n.evidenceLabel,
                  child: CompactEvidenceCollection(
                    items: evidenceItems,
                    showHeader: false,
                    emptyMessage: l10n.noEvidenceAttached,
                    onViewAll: evidenceItems.isEmpty
                        ? null
                        : () => AllEvidenceScreen.open(
                              context,
                              items: evidenceItems,
                              title: l10n.evidenceLabel,
                              onRetry: _load,
                            ),
                  ),
                ),
                const SizedBox(height: 16),
                OutlinedButton.icon(
                  onPressed: () => Navigator.of(context).pushNamed(
                    broadcastDetailRoute(detail.broadcastId)!,
                  ),
                  icon: const Icon(Icons.campaign_outlined),
                  label: Text(l10n.viewOriginalBroadcast),
                ),
              ],
            ),
    );
  }
}

class _SightingSubmittedScreen extends StatelessWidget {
  const _SightingSubmittedScreen({required this.broadcastId});

  final String broadcastId;

  @override
  Widget build(BuildContext context) {
    return _BroadcastShell(
      title: "Sighting submitted",
      child: Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(Icons.check_circle_outline, size: 56),
              const SizedBox(height: 16),
              const Text(
                "Thanks for reporting this sighting.",
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.of(context).pushReplacementNamed(
                  broadcastDetailRoute(broadcastId)!,
                ),
                child: const Text("Back to broadcast"),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _BroadcastShell extends StatelessWidget {
  const _BroadcastShell({
    required this.title,
    required this.child,
    this.onBack,
  });

  final String title;
  final Widget child;
  final VoidCallback? onBack;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: EyeSemanticColors.of(context).background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EyePageHeader.secondary(
            title: title,
            onBack: () {
              final callback = onBack;
              if (callback != null) {
                callback();
                return;
              }
              if (Navigator.of(context).canPop()) {
                Navigator.of(context).pop();
                return;
              }
              Navigator.of(context)
                  .pushReplacementNamed(BroadcastRoutes.center);
            },
          ),
          Expanded(child: child),
        ],
      ),
    );
  }
}

class _BroadcastActionTile extends StatelessWidget {
  const _BroadcastActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.eyeSurface,
      borderRadius: BorderRadius.circular(EyeTokens.radiusLg),
      child: InkWell(
        borderRadius: BorderRadius.circular(EyeTokens.radiusLg),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              CircleAvatar(
                backgroundColor: EyeSemanticColors.of(context)
                    .primaryAction
                    .withValues(alpha: 0.12),
                foregroundColor: EyeSemanticColors.of(context).primaryAction,
                child: Icon(icon),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      subtitle,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: BrandColors.lightTextMuted,
                          ),
                    ),
                  ],
                ),
              ),
              Icon(
                Icons.chevron_right,
                color: EyeSemanticColors.of(context).mutedText,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
