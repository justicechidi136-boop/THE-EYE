import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:just_audio/just_audio.dart";
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
import "../voice/chat_voice_composer.dart";
import "../voice/voice_report_validation.dart";
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
                      _BroadcastPrototypeSummary(item: item!),
                      const SizedBox(height: 14),
                      _BroadcastPrimaryActions(
                        item: item,
                        policy: policy!,
                        actionInFlight: _actionInFlight,
                        onComments: () => Navigator.of(context).pushNamed(
                          "${BroadcastRoutes.center}/${widget.broadcastId}/comments",
                        ),
                        onSighting: () => Navigator.of(context).pushNamed(
                          "${BroadcastRoutes.center}/${widget.broadcastId}/sighting",
                          arguments: item,
                        ),
                        onShare: () => Navigator.of(context).pushNamed(
                          "${BroadcastRoutes.center}/${widget.broadcastId}/share",
                          arguments: item,
                        ),
                      ),
                      if (policy.canReportBroadcast ||
                          policy.canResolve ||
                          policy.canWithdraw) ...[
                        const SizedBox(height: 12),
                        Wrap(
                          alignment: WrapAlignment.end,
                          spacing: 8,
                          runSpacing: 8,
                          children: [
                            if (policy.canReportBroadcast)
                              OutlinedButton.icon(
                                style: _compactBroadcastOutlinedStyle(),
                                onPressed: _actionInFlight
                                    ? null
                                    : () => Navigator.of(context).pushNamed(
                                          "${BroadcastRoutes.center}/${widget.broadcastId}/report",
                                          arguments: item,
                                        ),
                                icon: const Icon(Icons.flag_outlined),
                                label: Text(l10n.broadcastReport),
                              ),
                            if (policy.canResolve)
                              FilledButton.icon(
                                style: _compactBroadcastFilledStyle(),
                                onPressed: _actionInFlight ? null : _resolve,
                                icon: const Icon(Icons.check_circle_outline),
                                label: Text(l10n.broadcastResolve),
                              ),
                            if (policy.canWithdraw)
                              OutlinedButton.icon(
                                style: _compactBroadcastOutlinedStyle(),
                                onPressed: _actionInFlight ? null : _withdraw,
                                icon: const Icon(Icons.unpublished_outlined),
                                label: Text(l10n.broadcastWithdraw),
                              ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 20),
                      Divider(color: EyeSemanticColors.of(context).border),
                      const SizedBox(height: 20),
                      _BroadcastDetailBody(item: item),
                    ],
                  ),
      ),
    );
  }
}

class _BroadcastPrototypeSummary extends StatelessWidget {
  const _BroadcastPrototypeSummary({required this.item});

  final BroadcastFeedItem item;

  String? _metaAny(List<String> keys) {
    for (final key in keys) {
      final value = item.metadata[key]?.toString().trim();
      if (value != null && value.isNotEmpty) return value;
    }
    return null;
  }

  String? _location() {
    const keys = [
      "locationDisplay",
      "displayLocation",
      "lastSeenAddress",
      "lastKnownLocation",
      "lastKnownAddress",
      "address",
      "city",
      "lga",
    ];
    for (final key in keys) {
      final value = item.metadata[key]?.toString().trim();
      if (value != null && value.isNotEmpty) return value;
    }
    final fallback = [item.state, item.country]
        .whereType<String>()
        .map((value) => value.trim())
        .where((value) => value.isNotEmpty)
        .join(", ");
    return fallback.isEmpty ? null : fallback;
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final presentation = CitizenBroadcastPresenter.present(
      item,
      AppLocalizations.of(context),
    );
    final expiry = BroadcastExpiryPresenter.present(
      backendStatus: item.status,
      expiresAt: item.expiresAt,
    );
    final normalizedType = item.type.toLowerCase();
    final isVehicle = normalizedType.contains("vehicle") ||
        _metaAny(const ["make", "vehicleMake"]) != null;
    final isMissingPerson = normalizedType.contains("missing") ||
        _metaAny(const ["fullName"]) != null;
    final vehicleName = [
      _metaAny(const ["make", "vehicleMake"]),
      _metaAny(const ["model", "vehicleModel"]),
    ].whereType<String>().join(" ");
    final title = isVehicle && vehicleName.isNotEmpty
        ? "Stolen Vehicle: $vehicleName"
        : isMissingPerson
            ? (_metaAny(const ["fullName"]) ?? item.title)
            : item.title;
    final plate = isVehicle
        ? _metaAny(const [
            "registrationNumber",
            "plateNumber",
            "licensePlate",
            "registrationMasked",
          ])
        : null;
    final statusColor = switch (presentation.statusLabel.toLowerCase()) {
      "active" => colors.verified,
      "resolved" => colors.information,
      "cancelled" || "withdrawn" => colors.error,
      _ => colors.warning,
    };
    final sourceLabel = item.authorLabel?.trim().isNotEmpty == true
        ? item.authorLabel!.trim()
        : "Citizen Broadcast";
    final location = _location();

    return Container(
      key: const Key("broadcast-prototype-summary"),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: colors.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: colors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.center,
            children: [
              Expanded(
                child: Text(
                  presentation.typeLabel,
                  style: Theme.of(context).textTheme.titleSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
              Container(
                key: const Key("broadcast-status-chip"),
                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                decoration: BoxDecoration(
                  color: statusColor.withValues(alpha: 0.14),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  presentation.statusLabel,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: statusColor,
                        fontWeight: FontWeight.w800,
                      ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 8),
          Text(
            title,
            style: Theme.of(context).textTheme.titleMedium?.copyWith(
                  fontWeight: FontWeight.w800,
                  height: 1.25,
                ),
          ),
          if (item.body.trim().isNotEmpty && item.body.trim() != title) ...[
            const SizedBox(height: 4),
            Text(
              item.body.trim(),
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.secondaryText,
                    height: 1.4,
                  ),
            ),
          ],
          if (plate != null) ...[
            const SizedBox(height: 4),
            SelectableText(
              "Plate: $plate",
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: colors.secondaryText,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
          const SizedBox(height: 10),
          Text(
            [
              if (item.publishedAt != null)
                CitizenDateTimeFormatter.formatDateTime(item.publishedAt!),
              if (location != null) location,
            ].join(" · "),
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: colors.mutedText,
                ),
          ),
          if (expiry.detailLine != null) ...[
            const SizedBox(height: 2),
            Text(
              "$sourceLabel · ${expiry.detailLine!}",
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: colors.mutedText,
                  ),
            ),
          ],
        ],
      ),
    );
  }
}

class _BroadcastPrimaryActions extends StatelessWidget {
  const _BroadcastPrimaryActions({
    required this.item,
    required this.policy,
    required this.actionInFlight,
    required this.onComments,
    required this.onSighting,
    required this.onShare,
  });

  final BroadcastFeedItem item;
  final BroadcastActionPolicy policy;
  final bool actionInFlight;
  final VoidCallback onComments;
  final VoidCallback onSighting;
  final VoidCallback onShare;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final actions = <Widget>[
      if (policy.canComment)
        _BroadcastDetailActionTile(
          key: const Key("broadcast-action-comments"),
          icon: Icons.chat_bubble_outline_rounded,
          iconColor: colors.information,
          label: "Comments",
          detail: item.commentsCount > 0 ? "${item.commentsCount}" : null,
          onPressed: actionInFlight ? null : onComments,
        ),
      if (policy.canReportSighting)
        _BroadcastDetailActionTile(
          key: const Key("broadcast-action-sighting"),
          icon: Icons.check_rounded,
          iconColor: colors.verified,
          label: "Report Sighting",
          onPressed: actionInFlight ? null : onSighting,
        ),
      if (policy.canShare)
        _BroadcastDetailActionTile(
          key: const Key("broadcast-action-share"),
          icon: Icons.ios_share_rounded,
          iconColor: colors.primaryAction,
          label: "Share",
          onPressed: actionInFlight ? null : onShare,
        ),
    ];

    return SizedBox(
      height: 104,
      child: Row(
        key: const Key("broadcast-prototype-actions"),
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          for (var index = 0; index < actions.length; index++) ...[
            if (index > 0) const SizedBox(width: 8),
            Expanded(child: actions[index]),
          ],
        ],
      ),
    );
  }
}

class _BroadcastDetailActionTile extends StatelessWidget {
  const _BroadcastDetailActionTile({
    super.key,
    required this.icon,
    required this.iconColor,
    required this.label,
    required this.onPressed,
    this.detail,
  });

  final IconData icon;
  final Color iconColor;
  final String label;
  final String? detail;
  final VoidCallback? onPressed;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Material(
      color: colors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(8),
        side: BorderSide(color: colors.border),
      ),
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: onPressed,
        child: ConstrainedBox(
          constraints: const BoxConstraints(minHeight: 92),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    color: iconColor.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Icon(icon, size: 20, color: iconColor),
                ),
                const SizedBox(height: 7),
                Text(
                  label,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                        height: 1.15,
                      ),
                ),
                if (detail != null) ...[
                  const SizedBox(height: 2),
                  Text(
                    detail!,
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: colors.mutedText,
                        ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}

ButtonStyle _compactBroadcastOutlinedStyle() => OutlinedButton.styleFrom(
      minimumSize: const Size(0, 48),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );

ButtonStyle _compactBroadcastFilledStyle() => FilledButton.styleFrom(
      minimumSize: const Size(0, 48),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
    );

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
    final semantics = EyeSemanticColors.of(context);
    final muted = semantics.mutedText;
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
        if (isMissingPerson) ...[
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
          if (age != null) ...[
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
          _BroadcastDetailSection(
            title: "Vehicle Information",
            child: _VehicleInformationGrid(
              year: vehicleYear,
              color: vehicleColor,
              plate: vehiclePlate,
              vin: vehicleVin,
            ),
          ),
          if (distinguishingFeatures != null) ...[
            const _BroadcastSectionDivider(),
            _BroadcastDetailSection(
              title: "Distinguishing Features",
              child: SelectableText(
                distinguishingFeatures,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      height: 1.45,
                    ),
              ),
            ),
          ],
          const _BroadcastSectionDivider(),
          _BroadcastDetailSection(
            title: "Vehicle Photos",
            child: _BroadcastPhotoGallery(
              items: _evidenceItems(_vehiclePhotos),
              emptyMessage: "No vehicle reference photos attached.",
            ),
          ),
          if (vehicleLastSeenAt != null || vehicleLastSeenAddress != null) ...[
            const _BroadcastSectionDivider(),
            _BroadcastDetailSection(
              title: "Last Seen",
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  if (vehicleLastSeenAt != null)
                    Text(_formatDateTimeWithMeridiem(vehicleLastSeenAt)),
                  if (vehicleLastSeenAt != null &&
                      vehicleLastSeenAddress != null)
                    const SizedBox(height: 4),
                  if (vehicleLastSeenAddress != null)
                    Text(vehicleLastSeenAddress),
                ],
              ),
            ),
          ],
          if (theftDescription != null ||
              (item?.body ?? "").trim().isNotEmpty) ...[
            const _BroadcastSectionDivider(),
            _BroadcastDetailSection(
              title: "Description of Theft",
              child: Text(
                theftDescription ?? item?.body ?? "",
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      height: 1.45,
                    ),
              ),
            ),
          ],
          const _BroadcastSectionDivider(),
          _BroadcastDetailSection(
            title: "Incident Evidence",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: _buildEvidenceWidgets(context, muted).skip(1).toList(),
            ),
          ),
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

class _BroadcastDetailSection extends StatelessWidget {
  const _BroadcastDetailSection({required this.title, required this.child});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          title,
          style: Theme.of(context).textTheme.titleMedium?.copyWith(
                fontWeight: FontWeight.w800,
              ),
        ),
        const SizedBox(height: 10),
        child,
      ],
    );
  }
}

class _BroadcastSectionDivider extends StatelessWidget {
  const _BroadcastSectionDivider();

  @override
  Widget build(BuildContext context) => Padding(
        padding: const EdgeInsets.symmetric(vertical: 20),
        child: Divider(height: 1, color: EyeSemanticColors.of(context).divider),
      );
}

class _VehicleInformationGrid extends StatelessWidget {
  const _VehicleInformationGrid({
    this.year,
    this.color,
    this.plate,
    this.vin,
  });

  final String? year;
  final String? color;
  final String? plate;
  final String? vin;

  @override
  Widget build(BuildContext context) {
    final fields = <_VehicleInformationField>[
      if (year != null) _VehicleInformationField(label: "Year", value: year!),
      if (color != null)
        _VehicleInformationField(label: "Color", value: color!),
      if (plate != null)
        _VehicleInformationField(
          label: "Plate Number",
          value: plate!,
          copyTooltip: "Copy plate number",
        ),
      if (vin != null)
        _VehicleInformationField(
          label: "VIN",
          value: vin!,
          copyTooltip: "Copy VIN",
        ),
    ];
    if (fields.isEmpty) {
      return Text(
        "Vehicle details are not available.",
        style: TextStyle(color: EyeSemanticColors.of(context).mutedText),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 16.0;
        final columns = constraints.maxWidth >= 340 ? 2 : 1;
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          key: const Key("vehicle-information-grid"),
          spacing: gap,
          runSpacing: 16,
          children: [
            for (final field in fields) SizedBox(width: width, child: field),
          ],
        );
      },
    );
  }
}

class _VehicleInformationField extends StatelessWidget {
  const _VehicleInformationField({
    required this.label,
    required this.value,
    this.copyTooltip,
  });

  final String label;
  final String value;
  final String? copyTooltip;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: semantics.mutedText,
                fontWeight: FontWeight.w600,
              ),
        ),
        const SizedBox(height: 4),
        Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Flexible(
              fit: FlexFit.loose,
              child: SelectableText(
                value,
                style: Theme.of(context).textTheme.bodyLarge?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
              ),
            ),
            if (copyTooltip != null) ...[
              const SizedBox(width: 2),
              IconButton(
                tooltip: copyTooltip,
                visualDensity: VisualDensity.compact,
                constraints: const BoxConstraints(minWidth: 44, minHeight: 44),
                onPressed: () => Clipboard.setData(ClipboardData(text: value)),
                icon: const Icon(Icons.copy_outlined, size: 20),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _BroadcastPhotoGallery extends StatelessWidget {
  const _BroadcastPhotoGallery({
    required this.items,
    required this.emptyMessage,
  });

  final List<EvidenceItem> items;
  final String emptyMessage;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Text(
        emptyMessage,
        style: TextStyle(color: EyeSemanticColors.of(context).mutedText),
      );
    }
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final columns = constraints.maxWidth >= 640 ? 3 : 2;
        final width = (constraints.maxWidth - gap * (columns - 1)) / columns;
        return Wrap(
          key: const Key("broadcast-photo-gallery"),
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final evidence in items)
              SizedBox(
                width: width,
                height: width * 0.75,
                child: EvidenceMediaTile(item: evidence),
              ),
          ],
        );
      },
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
  final _commentFocusNode = FocusNode();
  final _replyController = TextEditingController();
  final _replyFocusNode = FocusNode();
  List<BroadcastCommentItem> _comments = const [];
  bool _didLoad = false;
  bool _loading = true;
  bool _submitting = false;
  bool _recordingVoice = false;
  bool _sendingVoice = false;
  BroadcastCommentItem? _replyTo;
  String? _error;
  String? _voiceError;

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
    _commentFocusNode.dispose();
    _replyController.dispose();
    _replyFocusNode.dispose();
    super.dispose();
  }

  void _recordVoiceComment() {
    _commentFocusNode.unfocus();
    setState(() {
      _recordingVoice = true;
      _voiceError = null;
    });
  }

  Future<void> _sendVoiceComment(VoiceRecordingResult recording) async {
    if (_sendingVoice) return;
    final session = BroadcastSession.require(context);
    final accessToken = session.accessToken;
    if (accessToken == null) return;
    setState(() {
      _sendingVoice = true;
      _voiceError = null;
    });
    try {
      final uploaded = await BroadcastMediaUploadService(
        apiClient: session.apiClient,
      ).uploadAttachments(
        attachments: [recording.attachment],
        accessToken: accessToken,
      );
      if (uploaded.isEmpty) {
        throw BroadcastMediaUploadFailure("Voice upload did not complete.");
      }
      await session.broadcastSubmissionService.addComment(
        accessToken: accessToken,
        broadcastId: widget.broadcastId,
        body: "",
        voiceNote: uploaded.first,
      );
      if (!mounted) return;
      setState(() => _recordingVoice = false);
      await _load();
      if (mounted) showBroadcastSnackBar(context, "Voice comment posted.");
    } on BroadcastMediaUploadFailure catch (error) {
      if (mounted) setState(() => _voiceError = error.message);
      rethrow;
    } on IncidentApiException catch (error) {
      if (mounted) setState(() => _voiceError = error.userMessage);
      rethrow;
    } catch (_) {
      if (mounted) {
        setState(
            () => _voiceError = "Unable to post voice comment. Try again.");
      }
      rethrow;
    } finally {
      if (mounted) setState(() => _sendingVoice = false);
    }
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

  void _startReply(BroadcastCommentItem comment) {
    _replyController.clear();
    setState(() => _replyTo = comment);
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _replyFocusNode.requestFocus();
    });
  }

  Future<void> _submit({BroadcastCommentItem? replyTo}) async {
    final controller = replyTo == null ? _commentController : _replyController;
    final body = controller.text.trim();
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
        parentId: replyTo?.id,
      );
      controller.clear();
      if (replyTo != null) setState(() => _replyTo = null);
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
    final roots = <BroadcastCommentItem>[];
    final replies = <String, List<BroadcastCommentItem>>{};
    final knownIds = _comments.map((comment) => comment.id).toSet();
    for (final comment in _comments) {
      final parentId = comment.parentId;
      if (parentId == null || !knownIds.contains(parentId)) {
        roots.add(comment);
      } else {
        replies.putIfAbsent(parentId, () => []).add(comment);
      }
    }
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
                                padding:
                                    const EdgeInsets.fromLTRB(24, 72, 24, 24),
                                children: [
                                  Icon(
                                    Icons.forum_outlined,
                                    size: 44,
                                    color:
                                        EyeSemanticColors.of(context).mutedText,
                                  ),
                                  const SizedBox(height: 16),
                                  Text(
                                    "No comments yet",
                                    textAlign: TextAlign.center,
                                    style:
                                        Theme.of(context).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: 6),
                                  Text(
                                    "Be the first to share relevant information about this broadcast.",
                                    textAlign: TextAlign.center,
                                    style: TextStyle(
                                      color: EyeSemanticColors.of(context)
                                          .mutedText,
                                    ),
                                  ),
                                ],
                              )
                            : ListView.separated(
                                padding:
                                    const EdgeInsets.fromLTRB(16, 14, 16, 20),
                                itemCount: roots.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(height: 18),
                                itemBuilder: (context, index) {
                                  final comment = roots[index];
                                  final currentUserId =
                                      BroadcastSession.require(
                                    context,
                                  ).cachedCitizenProfile?.id;
                                  final isOwner = currentUserId != null &&
                                      currentUserId == comment.authorUserId;
                                  return _BroadcastCommentThread(
                                    comment: comment,
                                    replies: replies[comment.id] ?? const [],
                                    isOwner: isOwner,
                                    onHelpful: () => unawaited(
                                      _react(comment, "Helpful"),
                                    ),
                                    onThanks: () => unawaited(
                                      _react(comment, "Thanks"),
                                    ),
                                    onReply: () => _startReply(comment),
                                    onEdit: isOwner
                                        ? () => unawaited(_edit(comment))
                                        : null,
                                    onDelete: isOwner
                                        ? () => unawaited(_delete(comment))
                                        : null,
                                    replyComposer: _replyTo?.id == comment.id
                                        ? _BroadcastInlineReplyComposer(
                                            controller: _replyController,
                                            focusNode: _replyFocusNode,
                                            submitting: _submitting,
                                            onCancel: () => setState(
                                              () => _replyTo = null,
                                            ),
                                            onSend: () => unawaited(
                                              _submit(replyTo: comment),
                                            ),
                                          )
                                        : null,
                                  );
                                },
                              ),
                      ),
          ),
          SafeArea(
            top: false,
            child: Container(
              decoration: BoxDecoration(
                color: EyeSemanticColors.of(context).elevatedSurface,
                border: Border(
                  top: BorderSide(
                    color: Theme.of(context).dividerColor,
                  ),
                ),
              ),
              padding: const EdgeInsets.fromLTRB(12, 8, 12, 10),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  if (_recordingVoice)
                    ChatVoiceComposer(
                      sending: _sendingVoice,
                      onCancel: () => setState(() {
                        _recordingVoice = false;
                        _voiceError = null;
                      }),
                      onSend: _sendVoiceComment,
                    )
                  else
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Expanded(
                          child: TextField(
                            key: const Key("broadcast-comment-input"),
                            controller: _commentController,
                            focusNode: _commentFocusNode,
                            enabled: !_submitting,
                            minLines: 1,
                            maxLines: 4,
                            maxLength: 2000,
                            autocorrect: true,
                            enableSuggestions: true,
                            keyboardType: TextInputType.multiline,
                            textCapitalization: TextCapitalization.sentences,
                            decoration: InputDecoration(
                              hintText: "Write a comment...",
                              counterText: "",
                              isDense: true,
                              filled: true,
                              fillColor:
                                  EyeSemanticColors.of(context).inputFill,
                              contentPadding: const EdgeInsets.symmetric(
                                horizontal: 16,
                                vertical: 11,
                              ),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(22),
                                borderSide: BorderSide(
                                  color: EyeSemanticColors.of(context).border,
                                ),
                              ),
                              enabledBorder: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(22),
                                borderSide: BorderSide(
                                  color: EyeSemanticColors.of(context).border,
                                ),
                              ),
                            ),
                            onSubmitted: (_) => unawaited(_submit()),
                          ),
                        ),
                        const SizedBox(width: 8),
                        ValueListenableBuilder<TextEditingValue>(
                          valueListenable: _commentController,
                          builder: (context, value, _) {
                            if (_submitting) {
                              return const IconButton.filled(
                                tooltip: "Posting comment",
                                onPressed: null,
                                icon: SizedBox.square(
                                  dimension: 18,
                                  child: CircularProgressIndicator(
                                    strokeWidth: 2,
                                  ),
                                ),
                              );
                            }
                            if (value.text.trim().isEmpty) {
                              return IconButton.filled(
                                tooltip: "Record voice comment",
                                onPressed: _recordVoiceComment,
                                icon: const Icon(Icons.mic_rounded),
                              );
                            }
                            return IconButton.filled(
                              tooltip: "Send comment",
                              onPressed: _submit,
                              icon: const Icon(Icons.send_rounded),
                            );
                          },
                        ),
                      ],
                    ),
                  if (_voiceError != null) ...[
                    const SizedBox(height: 6),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: Text(
                        _voiceError!,
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: EyeSemanticColors.of(context).error,
                            ),
                      ),
                    ),
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

class _BroadcastCommentTile extends StatelessWidget {
  const _BroadcastCommentTile({
    required this.comment,
    required this.isOwner,
    required this.onHelpful,
    required this.onThanks,
    this.compact = false,
    this.onReply,
    this.onEdit,
    this.onDelete,
  });

  final BroadcastCommentItem comment;
  final bool isOwner;
  final VoidCallback onHelpful;
  final VoidCallback onThanks;
  final VoidCallback? onReply;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final showBody = comment.body.isNotEmpty &&
        !(comment.voiceNoteUrl != null &&
            comment.body == broadcastVoiceCommentCompatibilityBody);
    final initial = comment.authorName.trim().isEmpty
        ? "?"
        : comment.authorName.trim().characters.first.toUpperCase();
    return Padding(
      padding: EdgeInsets.zero,
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          CircleAvatar(
            radius: compact ? 13 : 16,
            backgroundColor: isOwner
                ? BrandColors.orange.withValues(alpha: 0.12)
                : semantics.elevatedSurface,
            child: Text(
              initial,
              style: TextStyle(
                color: isOwner ? BrandColors.orange : semantics.mutedText,
                fontSize: compact ? 10 : 12,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
          SizedBox(width: compact ? 8 : 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        comment.authorName,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style:
                            Theme.of(context).textTheme.labelMedium?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                      ),
                    ),
                    if (comment.createdAt != null)
                      Text(
                        formatBroadcastAge(comment.createdAt!),
                        style: Theme.of(context).textTheme.labelSmall?.copyWith(
                              color: semantics.mutedText,
                            ),
                      ),
                    if (isOwner)
                      PopupMenuButton<String>(
                        tooltip: "Comment options",
                        padding: EdgeInsets.zero,
                        iconSize: 18,
                        constraints: const BoxConstraints.tightFor(
                          width: 36,
                          height: 36,
                        ),
                        onSelected: (value) {
                          if (value == "edit") onEdit?.call();
                          if (value == "delete") onDelete?.call();
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(value: "edit", child: Text("Edit")),
                          PopupMenuItem(
                            value: "delete",
                            child: Text("Delete"),
                          ),
                        ],
                      ),
                  ],
                ),
                if (comment.isPinned || comment.isSighting) ...[
                  const SizedBox(height: 2),
                  Text(
                    comment.isPinned ? "Pinned update" : "Sighting update",
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                          color: semantics.warning,
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                ],
                if (showBody) ...[
                  const SizedBox(height: 4),
                  Text(
                    comment.body,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          height: 1.45,
                        ),
                  ),
                ],
                if (comment.voiceNoteUrl != null) ...[
                  if (showBody) const SizedBox(height: 8),
                  ChatVoiceNotePlayer(
                    url: comment.voiceNoteUrl!,
                    durationSeconds: comment.voiceNoteDurationSeconds,
                    semanticLabel: "Voice comment",
                    bubbleKey: const Key("broadcast-voice-message-bubble"),
                  ),
                ],
                if (!compact) const SizedBox(height: 2),
                if (!compact)
                  Wrap(
                    spacing: 12,
                    runSpacing: 0,
                    children: [
                      _CommentAction(
                        onPressed: onHelpful,
                        icon: Icons.thumb_up_outlined,
                        label: "${comment.helpfulReactions}",
                      ),
                      _CommentAction(
                        onPressed: onThanks,
                        icon: Icons.volunteer_activism_outlined,
                        label: "${comment.thanksReactions}",
                      ),
                      if (onReply != null)
                        _CommentAction(
                          onPressed: onReply,
                          icon: Icons.reply_rounded,
                          label: "Reply",
                        ),
                    ],
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _BroadcastCommentThread extends StatelessWidget {
  const _BroadcastCommentThread({
    required this.comment,
    required this.replies,
    required this.isOwner,
    required this.onHelpful,
    required this.onThanks,
    required this.onReply,
    this.onEdit,
    this.onDelete,
    this.replyComposer,
  });

  final BroadcastCommentItem comment;
  final List<BroadcastCommentItem> replies;
  final bool isOwner;
  final VoidCallback onHelpful;
  final VoidCallback onThanks;
  final VoidCallback onReply;
  final VoidCallback? onEdit;
  final VoidCallback? onDelete;
  final Widget? replyComposer;

  @override
  Widget build(BuildContext context) {
    return Column(
      key: ValueKey("broadcast-comment-thread-${comment.id}"),
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _BroadcastCommentTile(
          comment: comment,
          isOwner: isOwner,
          onHelpful: onHelpful,
          onThanks: onThanks,
          onReply: onReply,
          onEdit: onEdit,
          onDelete: onDelete,
        ),
        if (replyComposer != null)
          Padding(
            padding: const EdgeInsets.only(left: 42, top: 10),
            child: replyComposer!,
          ),
        if (replies.isNotEmpty)
          Container(
            key: ValueKey("broadcast-comment-replies-${comment.id}"),
            margin: const EdgeInsets.only(left: 42, top: 10),
            padding: const EdgeInsets.only(left: 14),
            decoration: BoxDecoration(
              border: Border(
                left: BorderSide(color: EyeSemanticColors.of(context).border),
              ),
            ),
            child: Column(
              children: [
                for (var index = 0; index < replies.length; index++) ...[
                  _BroadcastCommentTile(
                    comment: replies[index],
                    isOwner: false,
                    onHelpful: () {},
                    onThanks: () {},
                    compact: true,
                  ),
                  if (index != replies.length - 1) const SizedBox(height: 12),
                ],
              ],
            ),
          ),
      ],
    );
  }
}

class _CommentAction extends StatelessWidget {
  const _CommentAction({
    required this.onPressed,
    required this.icon,
    required this.label,
  });

  final VoidCallback? onPressed;
  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    final color = EyeSemanticColors.of(context).mutedText;
    return InkWell(
      onTap: onPressed,
      borderRadius: BorderRadius.circular(4),
      child: Padding(
        padding: const EdgeInsets.symmetric(vertical: 8),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: color),
            const SizedBox(width: 5),
            Text(
              label,
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: color,
                    fontWeight: FontWeight.w600,
                  ),
            ),
          ],
        ),
      ),
    );
  }
}

class _BroadcastInlineReplyComposer extends StatelessWidget {
  const _BroadcastInlineReplyComposer({
    required this.controller,
    required this.focusNode,
    required this.submitting,
    required this.onCancel,
    required this.onSend,
  });

  final TextEditingController controller;
  final FocusNode focusNode;
  final bool submitting;
  final VoidCallback onCancel;
  final VoidCallback onSend;

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Row(
      children: [
        Expanded(
          child: TextField(
            key: const Key("broadcast-reply-input"),
            controller: controller,
            focusNode: focusNode,
            enabled: !submitting,
            minLines: 1,
            maxLines: 3,
            decoration: InputDecoration(
              hintText: "Write a reply...",
              isDense: true,
              filled: true,
              fillColor: colors.inputFill,
              suffixIcon: IconButton(
                tooltip: "Cancel reply",
                onPressed: onCancel,
                icon: const Icon(Icons.close, size: 17),
              ),
              border: OutlineInputBorder(
                borderRadius: BorderRadius.circular(18),
                borderSide: BorderSide(color: colors.border),
              ),
            ),
            onSubmitted: (_) => onSend(),
          ),
        ),
        const SizedBox(width: 8),
        IconButton.filled(
          tooltip: "Send reply",
          onPressed: submitting ? null : onSend,
          style: IconButton.styleFrom(
            backgroundColor: BrandColors.orange,
            foregroundColor: BrandColors.command,
            minimumSize: const Size.square(40),
          ),
          icon: const Icon(Icons.send_rounded, size: 18),
        ),
      ],
    );
  }
}

class _BroadcastVoiceNotePlayer extends StatefulWidget {
  const _BroadcastVoiceNotePlayer({
    required this.url,
    required this.durationSeconds,
  });

  final String url;
  final int? durationSeconds;

  @override
  State<_BroadcastVoiceNotePlayer> createState() =>
      _BroadcastVoiceNotePlayerState();
}

class _BroadcastVoiceNotePlayerState extends State<_BroadcastVoiceNotePlayer> {
  final AudioPlayer _player = AudioPlayer();
  StreamSubscription<PlayerState>? _subscription;
  StreamSubscription<Duration>? _positionSubscription;
  bool _loading = false;
  bool _playing = false;
  bool _failed = false;
  String? _loadedUrl;
  Duration _position = Duration.zero;

  @override
  void initState() {
    super.initState();
    _subscription = _player.playerStateStream.listen((state) {
      if (!mounted) return;
      setState(() {
        _playing = state.playing;
        if (state.processingState == ProcessingState.completed) {
          _playing = false;
        }
      });
    });
    _positionSubscription = _player.positionStream.listen((position) {
      if (mounted) setState(() => _position = position);
    });
  }

  @override
  void didUpdateWidget(covariant _BroadcastVoiceNotePlayer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.url != widget.url) {
      _loadedUrl = null;
      _position = Duration.zero;
    }
  }

  @override
  void dispose() {
    final subscription = _subscription;
    if (subscription != null) unawaited(subscription.cancel());
    final positionSubscription = _positionSubscription;
    if (positionSubscription != null) unawaited(positionSubscription.cancel());
    unawaited(_player.dispose());
    super.dispose();
  }

  Future<void> _toggle() async {
    if (_loading) return;
    if (_playing) {
      await _player.pause();
      return;
    }
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      if (_loadedUrl != widget.url) {
        await _player.setUrl(widget.url);
        _loadedUrl = widget.url;
      }
      if (_player.processingState == ProcessingState.completed) {
        await _player.seek(Duration.zero);
      }
      unawaited(_player.play());
    } catch (_) {
      if (mounted) setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    final seconds = widget.durationSeconds ?? 0;
    final elapsedSeconds = _position.inSeconds.clamp(0, seconds);
    final progress = seconds <= 0 ? 0.0 : elapsedSeconds / seconds;
    final duration =
        "${(elapsedSeconds ~/ 60).toString().padLeft(2, "0")}:${(elapsedSeconds % 60).toString().padLeft(2, "0")} / ${(seconds ~/ 60).toString().padLeft(2, "0")}:${(seconds % 60).toString().padLeft(2, "0")}";
    return Semantics(
      container: true,
      label: "Voice comment, $duration",
      child: DecoratedBox(
        key: const Key("broadcast-voice-message-bubble"),
        decoration: BoxDecoration(
          color: colors.elevatedSurface,
          borderRadius: BorderRadius.circular(18),
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 4, 12, 4),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              IconButton(
                tooltip:
                    _playing ? "Pause voice comment" : "Play voice comment",
                onPressed: _toggle,
                icon: _loading
                    ? const SizedBox.square(
                        dimension: 18,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Icon(_playing
                        ? Icons.pause_rounded
                        : Icons.play_arrow_rounded),
              ),
              SizedBox(
                width: 112,
                height: 28,
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                  children: List.generate(18, (index) {
                    final filled = index / 18 <= progress;
                    return Container(
                      width: 3,
                      height: 7.0 + ((index * 5) % 18),
                      decoration: BoxDecoration(
                        color: filled ? colors.primaryAction : colors.border,
                        borderRadius: BorderRadius.circular(2),
                      ),
                    );
                  }),
                ),
              ),
              const SizedBox(width: 8),
              Text(_failed ? "Retry" : duration),
            ],
          ),
        ),
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
                      child: Builder(
                        builder: (context) {
                          final location = CitizenLocationPresentation(
                            streetAddress: _capturedLocation?.street,
                            subLocality: _capturedLocation?.subLocality,
                            cityTown: _capturedLocation?.locality,
                            lga: _capturedLocation?.lga,
                            state: _capturedLocation?.state,
                          );
                          return CitizenLocationDetails(
                            address: location.specificLine,
                            secondaryLocation: location.administrativeLine,
                            accuracyMeters: _capturedLocation?.accuracyMeters,
                            capturedAt: _capturedLocation?.capturedAt,
                          );
                        },
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
                            : CitizenLocationPresentation(
                                streetAddress:
                                    location["streetAddress"]?.toString(),
                                subLocality:
                                    location["subLocality"]?.toString(),
                              ).specificLine,
                        secondaryLocation: CitizenLocationPresentation(
                          cityTown: location["cityTown"]?.toString(),
                          lga: location["lga"]?.toString(),
                          state: location["state"]?.toString(),
                          country: location["country"]?.toString(),
                        ).administrativeLine,
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
