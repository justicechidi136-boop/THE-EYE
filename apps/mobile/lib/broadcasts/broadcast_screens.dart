import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/services.dart";
import "package:geolocator/geolocator.dart";

import "../brand.dart";
import "../design_system/components/eye_page_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "../design_system/tokens.dart";
import "../incidents/incident_submission_service.dart";
import "../location/location_permission_service.dart";
import "../presentation/broadcast_expiry_presenter.dart";
import "../presentation/citizen_date_time.dart";
import "../presentation/citizen_presentation.dart";
import "../theme/the_eye_theme.dart";
import "../voice/voice_recorder.dart";
import "../widgets/section_card.dart";
import "broadcast_feed_service.dart";
import "broadcast_navigation.dart";
import "broadcast_session.dart";
import "broadcast_sighting_draft_store.dart";
import "broadcast_submission_service.dart";
import "broadcast_ui_helpers.dart";
import "../incidents/incident_draft_factory.dart";

class BroadcastCreateHubScreen extends StatelessWidget {
  const BroadcastCreateHubScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return _BroadcastShell(
      title: "Create broadcast",
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
  bool _loading = true;
  String? _error;
  String _statusFilter = "All";

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final session = BroadcastSession.require(context);
    if (!session.isAuthenticated || session.accessToken == null) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed("/login");
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final items = await session.broadcastFeedService.listMine(
        accessToken: session.accessToken!,
        status: _statusFilter,
      );
      if (!mounted) return;
      setState(() {
        _items = items;
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
        _error = "Unable to load your broadcasts.";
        _loading = false;
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
                  onSelected: _loading
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
              onRefresh: _load,
              child: _loading
                  ? ListView(
                      physics: const AlwaysScrollableScrollPhysics(),
                      children: const [
                        SizedBox(height: 120),
                        Center(child: CircularProgressIndicator()),
                      ],
                    )
                  : _error != null
                      ? ListView(
                          physics: const AlwaysScrollableScrollPhysics(),
                          padding: const EdgeInsets.all(24),
                          children: [
                            ListTile(
                              leading: const Icon(Icons.cloud_off),
                              title: const Text("Broadcasts unavailable"),
                              subtitle: Text(_error!),
                            ),
                            FilledButton(
                              onPressed: () => unawaited(_load()),
                              child: const Text("Retry"),
                            ),
                          ],
                        )
                      : _items.isEmpty
                          ? ListView(
                              physics: const AlwaysScrollableScrollPhysics(),
                              padding: const EdgeInsets.all(16),
                              children: const [
                                SectionCard(
                                  title: "No broadcasts yet",
                                  child: Text(
                                    "Create a missing person or stolen vehicle alert to reach nearby citizens.",
                                  ),
                                ),
                              ],
                            )
                          : ListView.separated(
                              padding:
                                  const EdgeInsets.fromLTRB(16, 8, 16, 120),
                              itemCount: _items.length,
                              separatorBuilder: (_, __) =>
                                  const SizedBox(height: 12),
                              itemBuilder: (context, index) {
                                final item = _items[index];
                                return _BroadcastActionTile(
                                  icon: item.type
                                          .toLowerCase()
                                          .contains("vehicle")
                                      ? Icons.directions_car
                                      : Icons.person_search,
                                  title: item.title,
                                  subtitle: "${item.status} · ${item.type}",
                                  onTap: () => Navigator.of(context).pushNamed(
                                    broadcastDetailRoute(item.id)!,
                                  ),
                                );
                              },
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
  bool _isOwner = false;
  String? _error;
  bool _loading = true;
  bool _actionInFlight = false;

  @override
  void initState() {
    super.initState();
    unawaited(_loadDetail());
  }

  Future<void> _loadDetail() async {
    final session = BroadcastSession.require(context);
    if (!session.isAuthenticated || session.accessToken == null) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed("/login");
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final item = await session.broadcastFeedService.getDetail(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
      );
      final mine = await session.broadcastFeedService.listMine(
        accessToken: session.accessToken!,
      );
      await session.markBroadcastRead(widget.broadcastId);
      if (!mounted) return;
      setState(() {
        _item = item;
        _isOwner = mine.any((entry) => entry.id == widget.broadcastId);
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
        _error = "Unable to load broadcast detail.";
        _loading = false;
      });
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
    return _BroadcastShell(
      title: "Broadcast detail",
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
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        OutlinedButton.icon(
                          onPressed: _actionInFlight
                              ? null
                              : () => Navigator.of(context).pushNamed(
                                    "${BroadcastRoutes.center}/${widget.broadcastId}/comments",
                                  ),
                          icon: const Icon(Icons.chat_bubble_outline),
                          label: const Text("Comments"),
                        ),
                        OutlinedButton.icon(
                          onPressed: _actionInFlight
                              ? null
                              : () => Navigator.of(context).pushNamed(
                                    "${BroadcastRoutes.center}/${widget.broadcastId}/share",
                                  ),
                          icon: const Icon(Icons.share_outlined),
                          label: const Text("Share"),
                        ),
                        OutlinedButton.icon(
                          onPressed: _actionInFlight
                              ? null
                              : () => Navigator.of(context).pushNamed(
                                    "${BroadcastRoutes.center}/${widget.broadcastId}/sighting",
                                  ),
                          icon: const Icon(Icons.visibility_outlined),
                          label: const Text("Report sighting"),
                        ),
                        if (!_isOwner)
                          OutlinedButton.icon(
                            onPressed: _actionInFlight
                                ? null
                                : () => Navigator.of(context).pushNamed(
                                      "${BroadcastRoutes.center}/${widget.broadcastId}/report",
                                    ),
                            icon: const Icon(Icons.flag_outlined),
                            label: const Text("Report"),
                          ),
                        if (_isOwner &&
                            (item?.status == "Active" ||
                                item?.status == "Published" ||
                                item?.status == "Updated")) ...[
                          FilledButton.icon(
                            onPressed: _actionInFlight ? null : _resolve,
                            icon: const Icon(Icons.check_circle_outline),
                            label: const Text("Resolve"),
                          ),
                          OutlinedButton.icon(
                            onPressed: _actionInFlight ? null : _withdraw,
                            icon: const Icon(Icons.unpublished_outlined),
                            label: const Text("Withdraw"),
                          ),
                        ],
                      ],
                    ),
                  ],
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

  @override
  Widget build(BuildContext context) {
    final muted = BrandColors.lightTextMuted;
    final fullName = _meta("fullName");
    final age = _meta("ageOrApproximateAge");
    final gender = _meta("gender");
    final lastSeenAtRaw = _meta("lastSeenAt");
    final lastSeenAt = lastSeenAtRaw == null
        ? null
        : DateTime.tryParse(lastSeenAtRaw);
    final lastSeenAddress = _meta("lastSeenAddress");
    final physical = _meta("physicalDescription");
    final clothing = _meta("clothingDescription");
    final additional = _meta("additionalDescription");
    final isMissingPerson =
        (item?.type.toLowerCase().contains("missing") ?? false) ||
            fullName != null;

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
          if (fullName != null) ...[
            Text("Missing person",
                style: Theme.of(context).textTheme.titleSmall),
            Text(fullName, style: const TextStyle(fontWeight: FontWeight.w800)),
            const SizedBox(height: 8),
          ],
          if (age != null || gender != null)
            Text(
              [
                if (age != null) "Approx. age $age",
                if (gender != null) gender,
              ].join(" · "),
            ),
          if (lastSeenAt != null || lastSeenAddress != null) ...[
            const SizedBox(height: 8),
            Text("Last seen", style: Theme.of(context).textTheme.titleSmall),
            if (lastSeenAt != null)
              Text(CitizenDateTimeFormatter.formatDateTime(lastSeenAt)),
            if (lastSeenAddress != null) Text(lastSeenAddress),
          ],
          if (physical != null) ...[
            const SizedBox(height: 8),
            Text("Physical description",
                style: Theme.of(context).textTheme.titleSmall),
            Text(physical),
          ],
          if (clothing != null) ...[
            const SizedBox(height: 8),
            Text("Clothing", style: Theme.of(context).textTheme.titleSmall),
            Text(clothing),
          ],
          if (additional != null) ...[
            const SizedBox(height: 8),
            Text("Additional information",
                style: Theme.of(context).textTheme.titleSmall),
            Text(additional),
          ],
        ] else ...[
          Text(item?.body ?? ""),
        ],
        if ((item?.commentsCount ?? 0) > 0) ...[
          const SizedBox(height: 8),
          Text(
            "${item!.commentsCount} community comment${item!.commentsCount == 1 ? "" : "s"}",
            style: TextStyle(color: muted),
          ),
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
  bool _loading = true;
  bool _submitting = false;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  @override
  void dispose() {
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
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
      );
      _commentController.clear();
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
                                      "Be the first to share helpful information.",
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
                                  return SectionCard(
                                    title: comment.isSighting
                                        ? "Sighting report"
                                        : "Comment",
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
                                              color: BrandColors.lightTextMuted,
                                            ),
                                          ),
                                        ],
                                      ],
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
                    child: TextField(
                      controller: _commentController,
                      minLines: 1,
                      maxLines: 3,
                      decoration: const InputDecoration(
                        hintText: "Add a comment",
                      ),
                    ),
                  ),
                  const SizedBox(width: 8),
                  FilledButton(
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
  const BroadcastReportScreen({required this.broadcastId, super.key});

  final String broadcastId;

  @override
  State<BroadcastReportScreen> createState() => _BroadcastReportScreenState();
}

class _BroadcastReportScreenState extends State<BroadcastReportScreen> {
  static const _reasons = [
    "FalseOrMisleading",
    "Duplicate",
    "Harassment",
    "PrivacyViolation",
    "Impersonation",
    "GraphicContent",
    "Spam",
    "PersonAlreadyFound",
    "VehicleAlreadyRecovered",
    "Other",
  ];

  String _reason = _reasons.first;
  final _detailsController = TextEditingController();
  bool _submitting = false;

  @override
  void dispose() {
    _detailsController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
    setState(() => _submitting = true);
    try {
      await session.broadcastSubmissionService.report(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        reason: _reason,
        details: _reason == "Other"
            ? _detailsController.text.trim()
            : (_detailsController.text.trim().isEmpty
                ? null
                : _detailsController.text.trim()),
      );
      if (!mounted) return;
      showBroadcastSnackBar(
        context,
        "Thank you. This broadcast has been reported for review.",
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
    return _BroadcastShell(
      title: "Report broadcast",
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          const SectionCard(
            title: "Why are you reporting this?",
            child: Text(
              "Reports are reviewed by moderators. Misuse may affect account standing.",
            ),
          ),
          const SizedBox(height: 16),
          ..._reasons.map(
            (reason) => RadioListTile<String>(
              value: reason,
              groupValue: _reason,
              onChanged: _submitting
                  ? null
                  : (value) => setState(() => _reason = value ?? _reason),
              title: Text(broadcastReportReasonLabels[reason] ?? reason),
            ),
          ),
          const SizedBox(height: 8),
          TextField(
            controller: _detailsController,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: "Additional details (optional)",
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
    super.key,
  });

  final String broadcastId;
  final BroadcastFeedItem? fallbackSource;

  @override
  State<BroadcastShareScreen> createState() => _BroadcastShareScreenState();
}

class _BroadcastShareScreenState extends State<BroadcastShareScreen> {
  BroadcastSharePayload? _payload;
  bool _loading = true;
  String? _error;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  Future<void> _load() async {
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final payload = await session.broadcastFeedService.getSharePayload(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        fallbackSource: widget.fallbackSource,
      );
      if (!mounted) return;
      setState(() {
        _payload = payload;
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
        _error = "Unable to prepare share content.";
        _loading = false;
      });
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
                      onPressed: _copyShareText,
                      icon: const Icon(Icons.copy),
                      label: const Text("Copy share text"),
                    ),
                  ],
                ),
    );
  }
}

class SubmitSightingScreen extends StatefulWidget {
  const SubmitSightingScreen({required this.broadcastId, super.key});

  final String broadcastId;

  @override
  State<SubmitSightingScreen> createState() => _SubmitSightingScreenState();
}

class _SubmitSightingScreenState extends State<SubmitSightingScreen> {
  final _descriptionController = TextEditingController();
  final _areaController = TextEditingController();
  final _directionController = TextEditingController();
  final _draftStore = BroadcastSightingDraftStore();
  String _clientActionId = createClientSubmissionId();
  bool _anonymousToReviewers = false;
  bool _submitting = false;
  bool _hasPendingDraft = false;
  String? _pendingDraftMessage;
  Position? _position;
  double? _draftLatitude;
  double? _draftLongitude;
  String? _locationStatus;
  String? _photoReference;
  String? _videoReference;
  String? _voiceReference;

  @override
  void initState() {
    super.initState();
    unawaited(_restoreDraft());
  }

  @override
  void dispose() {
    _descriptionController.dispose();
    _areaController.dispose();
    _directionController.dispose();
    super.dispose();
  }

  String _userScope(BroadcastSession session) =>
      session.accessToken ?? "anonymous";

  Future<void> _restoreDraft() async {
    final session = BroadcastSession.require(context);
    final draft = await _draftStore.load(
      userScope: _userScope(session),
      broadcastId: widget.broadcastId,
    );
    if (!mounted || draft == null) return;
    setState(() {
      _clientActionId = draft.clientActionId.isNotEmpty
          ? draft.clientActionId
          : _clientActionId;
      _descriptionController.text = draft.description;
      _areaController.text = draft.approximateArea ?? "";
      _directionController.text = draft.directionOfTravel ?? "";
      _anonymousToReviewers = draft.anonymousToReviewers;
      _photoReference = draft.photoReference;
      _videoReference = draft.videoReference;
      _voiceReference = draft.voiceReference;
      _draftLatitude = draft.latitude;
      _draftLongitude = draft.longitude;
      if (draft.latitude != null && draft.longitude != null) {
        _position = null;
      }
      _hasPendingDraft = true;
      _pendingDraftMessage =
          "A saved sighting draft is ready to retry. Exact coordinates remain private.";
    });
  }

  Future<void> _persistDraft() async {
    final session = BroadcastSession.require(context);
    final draft = BroadcastSightingDraft(
      broadcastId: widget.broadcastId,
      clientActionId: _clientActionId,
      description: _descriptionController.text.trim(),
      observedAt: DateTime.now().toUtc().toIso8601String(),
      latitude: _position?.latitude ?? _draftLatitude,
      longitude: _position?.longitude ?? _draftLongitude,
      approximateArea: _areaController.text.trim().isEmpty
          ? null
          : _areaController.text.trim(),
      directionOfTravel: _directionController.text.trim().isEmpty
          ? null
          : _directionController.text.trim(),
      confidence: "ReporterProvided",
      anonymousToReviewers: _anonymousToReviewers,
      photoReference: _photoReference,
      videoReference: _videoReference,
      voiceReference: _voiceReference,
      updatedAt: DateTime.now().toUtc(),
    );
    await _draftStore.save(
      userScope: _userScope(session),
      draft: draft,
    );
    if (!mounted) return;
    setState(() {
      _hasPendingDraft = true;
      _pendingDraftMessage =
          BroadcastSightingUnavailableException.temporaryUnavailableMessage;
    });
  }

  Future<void> _captureLocation() async {
    final outcome = await captureLocationOutcome();
    if (!mounted) return;
    if (outcome.result != LocationCaptureResult.granted ||
        outcome.position == null) {
      setState(() {
        _locationStatus = locationFailureMessage(outcome.result);
      });
      return;
    }
    setState(() {
      _position = outcome.position;
      _draftLatitude = outcome.position?.latitude;
      _draftLongitude = outcome.position?.longitude;
      _locationStatus =
          "Approximate location captured for authorized review only.";
    });
  }

  Future<void> _submit() async {
    final description = _descriptionController.text.trim();
    if (description.isEmpty) {
      showBroadcastSnackBar(context, "Describe what you saw.", isError: true);
      return;
    }
    final session = BroadcastSession.require(context);
    if (session.accessToken == null) return;
    setState(() => _submitting = true);
    try {
      await session.broadcastSubmissionService.submitSighting(
        accessToken: session.accessToken!,
        broadcastId: widget.broadcastId,
        clientActionId: _clientActionId,
        description: description,
        observedAt: DateTime.now().toUtc().toIso8601String(),
        latitude: _position?.latitude ?? _draftLatitude,
        longitude: _position?.longitude ?? _draftLongitude,
        approximateArea: _areaController.text.trim().isEmpty
            ? null
            : _areaController.text.trim(),
        directionOfTravel: _directionController.text.trim().isEmpty
            ? null
            : _directionController.text.trim(),
        anonymousToReviewers: _anonymousToReviewers,
        confidence: "ReporterProvided",
        photoReference: _photoReference,
        videoReference: _videoReference,
        voiceReference: _voiceReference,
      );
      await _draftStore.clear(
        userScope: _userScope(session),
        broadcastId: widget.broadcastId,
      );
      if (!mounted) return;
      showBroadcastSnackBar(context, "Sighting submitted securely. Thank you.");
      Navigator.of(context).pop();
    } on BroadcastSightingUnavailableException catch (error) {
      await _persistDraft();
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      showBroadcastSnackBar(context, error.userMessage, isError: true);
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
    return _BroadcastShell(
      title: "Report sighting",
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
        children: [
          SectionCard(
            title: "Submit a private sighting",
            child: Text(
              _hasPendingDraft && _pendingDraftMessage != null
                  ? _pendingDraftMessage!
                  : "Sightings are sent only to authorized reviewers and the broadcast author. They are never posted as public comments.",
              style: TextStyle(
                color: EyeSemanticColors.of(context).mutedText,
              ),
            ),
          ),
          const SizedBox(height: 16),
          TextField(
            controller: _descriptionController,
            maxLines: 4,
            decoration: const InputDecoration(
              labelText: "What did you see?",
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _areaController,
            decoration: const InputDecoration(
              labelText: "Approximate area (optional)",
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _directionController,
            decoration: const InputDecoration(
              labelText: "Direction of travel (optional)",
            ),
          ),
          const SizedBox(height: 12),
          SwitchListTile(
            value: _anonymousToReviewers,
            onChanged: _submitting
                ? null
                : (value) => setState(() => _anonymousToReviewers = value),
            title: const Text("Keep my identity private on authorized review"),
          ),
          Align(
            alignment: Alignment.centerLeft,
            child: OutlinedButton.icon(
              onPressed:
                  _submitting ? null : () => unawaited(_captureLocation()),
              icon: const Icon(Icons.my_location),
              label: const Text("Use current location"),
            ),
          ),
          if (_locationStatus != null) ...[
            const SizedBox(height: 8),
            Text(
              _locationStatus!,
              style: TextStyle(
                color: EyeSemanticColors.of(context).mutedText,
              ),
            ),
          ],
          const SizedBox(height: 12),
          VoiceRecorder(
            enabled: !_submitting,
            onRecordingReady: (result) {
              setState(() {
                _voiceReference = "voice:${result.durationSeconds}s";
              });
              final note = "Voice note attached (${result.durationSeconds}s).";
              final current = _descriptionController.text.trim();
              _descriptionController.text =
                  current.isEmpty ? note : "$current\n\n$note";
            },
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              OutlinedButton.icon(
                onPressed: _submitting
                    ? null
                    : () => setState(
                          () => _photoReference = "photo:attached",
                        ),
                icon: const Icon(Icons.photo_camera_outlined),
                label: Text(_photoReference == null
                    ? "Attach photo"
                    : "Photo attached"),
              ),
              OutlinedButton.icon(
                onPressed: _submitting
                    ? null
                    : () => setState(
                          () => _videoReference = "video:attached",
                        ),
                icon: const Icon(Icons.videocam_outlined),
                label: Text(_videoReference == null
                    ? "Attach video"
                    : "Video attached"),
              ),
            ],
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
                : Text(_hasPendingDraft
                    ? "Retry sighting submission"
                    : "Submit sighting"),
          ),
        ],
      ),
    );
  }
}

class _BroadcastShell extends StatelessWidget {
  const _BroadcastShell({required this.title, required this.child});

  final String title;
  final Widget child;

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
