import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:share_plus/share_plus.dart";

import "../app/app_scope.dart";
import "../design_system/eye_semantic_colors.dart";
import "../location/device_location_state.dart";
import "../location/location_permission_service.dart";
import "../location/location_reverse_geocode.dart";
import "../widgets/section_card.dart";
import "../incidents/incident_submission_service.dart";
import "community_post_detail_screen.dart";
import "neighborhood_watch_prototype_chrome.dart";
import "neighborhood_watch_destinations.dart";
import "neighborhood_community_state.dart";
import "neighborhood_watch_service.dart";
import "neighborhood_watch_session.dart";
import "nw_context_cache.dart";

String formatNeighborhoodPostAge(DateTime? createdAt, {DateTime? now}) {
  if (createdAt == null) return "Recently";
  final reference = now ?? DateTime.now();
  final difference = reference.difference(createdAt.toLocal());
  if (difference.isNegative || difference.inMinutes < 1) return "Just now";
  if (difference.inHours < 1) return "${difference.inMinutes}m ago";
  if (difference.inDays < 1) return "${difference.inHours}h ago";
  if (difference.inDays < 7) return "${difference.inDays}d ago";
  final local = createdAt.toLocal();
  return "${local.day}/${local.month}/${local.year}";
}

String neighborhoodVerificationLabel(String status) {
  return switch (status.trim().toLowerCase()) {
    "verified" => "Verified",
    "confirmed" => "Confirmed",
    "rejected" || "false" => "Unverified",
    _ => "Unverified",
  };
}

class NeighborhoodWatchHomeScreen extends StatefulWidget {
  const NeighborhoodWatchHomeScreen({
    this.openChatWhenReady = false,
    super.key,
  });

  final bool openChatWhenReady;

  @override
  State<NeighborhoodWatchHomeScreen> createState() =>
      _NeighborhoodWatchHomeScreenState();
}

class _NeighborhoodWatchHomeScreenState
    extends State<NeighborhoodWatchHomeScreen> {
  late final NeighborhoodWatchService _service;
  final NwContextCache _contextCache = NwContextCache();
  final LocationReverseGeocoder _reverseGeocoder =
      CachedLocationReverseGeocoder();

  NwContextResponse? _context;
  String? _loadError;
  bool _loading = false;
  bool _capturingLocation = false;
  String? _locationCaptureMessage;
  String? _preciseLocationLabel;
  bool _contextIsStale = false;
  DateTime? _contextCachedAt;
  List<CommunityPostItem> _feed = const [];
  bool _feedLoading = false;
  String? _feedError;
  bool _serviceInitialized = false;
  bool _openedChat = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_serviceInitialized) return;
    _serviceInitialized = true;
    _service = NeighborhoodWatchService(
      apiClient: AppScope.of(context).apiClient,
    );
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _bootstrap());
  }

  String? _userScope() {
    final session = AppScope.of(context);
    return session.cachedCitizenProfile?.id ?? session.accessToken;
  }

  Future<void> _bootstrap() async {
    final session = AppScope.of(context);
    if (!session.isAuthenticated) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed("/login");
      return;
    }
    final cached = await _contextCache.load(_userScope() ?? "anonymous");
    if (cached != null && mounted) {
      final staleContext = stripLivePresence(cached.context);
      setState(() {
        _context = staleContext;
        _contextIsStale = true;
        _contextCachedAt = cached.cachedAt;
      });
      _syncSelectedCommunity(staleContext);
    }
    await _refreshContext();
  }

  Future<void> _refreshContext() async {
    final session = AppScope.of(context);
    final token = session.accessToken;
    if (token == null) return;

    if (!session.online) {
      if (_context != null) {
        final staleContext = stripLivePresence(_context!);
        if (!mounted) return;
        setState(() {
          _context = staleContext;
          _contextIsStale = true;
          _loadError = null;
        });
        _syncSelectedCommunity(staleContext);
      } else {
        if (!mounted) return;
        setState(() {
          _loadError =
              "You are offline and no saved neighborhood context is available.";
        });
      }
      return;
    }

    setState(() {
      _loading = true;
      _loadError = null;
      _capturingLocation = true;
      _locationCaptureMessage = "Acquiring GPS fix...";
    });

    double? lat;
    double? lng;
    double? accuracy;
    DateTime? capturedAt;

    try {
      final outcome = await captureLocationOutcome(
        accuracy: LocationAccuracy.high,
        requestIfDenied: true,
      );
      if (outcome.position != null) {
        final position = outcome.position!;
        lat = position.latitude;
        lng = position.longitude;
        accuracy = position.accuracy;
        capturedAt = position.timestamp.toUtc();
        _locationCaptureMessage = null;
        final geocode = await _reverseGeocoder.lookup(
          latitude: position.latitude,
          longitude: position.longitude,
        );
        _preciseLocationLabel = geocode.hasAnyLabel
            ? DeviceLocationState(
                status: DeviceLocationStatus.acquired,
                street: geocode.street,
                subLocality: geocode.subLocality,
                locality: geocode.locality,
                lga: geocode.lga,
                state: geocode.state,
              ).displayLocality
            : null;
      } else {
        _preciseLocationLabel = null;
        _locationCaptureMessage = locationFailureMessage(outcome.result);
      }
    } catch (_) {
      _preciseLocationLabel = null;
      _locationCaptureMessage = "Unable to read device location.";
    } finally {
      if (mounted) {
        setState(() => _capturingLocation = false);
      }
    }

    try {
      final contextResponse = await _service.resolveContext(
        accessToken: token,
        lat: lat,
        lng: lng,
        accuracy: accuracy,
        capturedAt: capturedAt,
      );
      if (!mounted) return;
      await _contextCache.save(_userScope() ?? "anonymous", contextResponse);
      setState(() {
        _context = contextResponse;
        _loadError = null;
        _contextIsStale = false;
        _contextCachedAt = null;
      });
      _syncSelectedCommunity(contextResponse);
      await _refreshFeed(contextResponse);
      if (widget.openChatWhenReady && !_openedChat && mounted) {
        _openedChat = true;
        Navigator.of(context).pushReplacementNamed(
          NeighborhoodWatchDestinations.chat,
          arguments: const {"contextResolved": true},
        );
      }
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      if (_context != null) {
        final staleContext = stripLivePresence(_context!);
        setState(() {
          _context = staleContext;
          _contextIsStale = true;
          _loadError = error.userMessage;
        });
        _syncSelectedCommunity(staleContext);
      } else {
        setState(() {
          _context = null;
          _loadError = error.userMessage;
        });
      }
    } catch (_) {
      if (!mounted) return;
      if (_context != null) {
        final staleContext = stripLivePresence(_context!);
        setState(() {
          _context = staleContext;
          _contextIsStale = true;
          _loadError = "Unable to refresh neighborhood context.";
        });
        _syncSelectedCommunity(staleContext);
      } else {
        setState(() {
          _context = null;
          _loadError = "Unable to load neighborhood context.";
        });
      }
    } finally {
      if (mounted) {
        setState(() => _loading = false);
      }
    }
  }

  Future<void> _refreshFeed(NwContextResponse contextResponse) async {
    final token = AppScope.of(context).accessToken;
    final communityId = contextResponse.isMappedPublicCommunity
        ? contextResponse.publicCommunity?.id
        : contextResponse.dynamicArea
            ?.toCommunitySummary(
              activeAlertsCount: contextResponse.safetySummary.activeAlerts,
            )
            .id;
    if (token == null || communityId == null || communityId.isEmpty) {
      if (!mounted) return;
      setState(() {
        _feed = const [];
        _feedError = null;
        _feedLoading = false;
      });
      return;
    }
    setState(() {
      _feedLoading = true;
      _feedError = null;
    });
    try {
      final page = await _service.communityFeed(
        accessToken: token,
        communityId: communityId,
      );
      if (!mounted) return;
      setState(() => _feed = page.items);
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _feedError = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() => _feedError = "Unable to load nearby activity.");
    } finally {
      if (mounted) setState(() => _feedLoading = false);
    }
  }

  void _syncSelectedCommunity(NwContextResponse contextResponse) {
    final session = AppScope.of(context);
    final nwSession = session is NeighborhoodWatchSession
        ? session as NeighborhoodWatchSession
        : null;
    if (contextResponse.isMappedPublicCommunity &&
        contextResponse.publicCommunity != null &&
        contextResponse.publicCommunity!.id.isNotEmpty) {
      nwSession?.applyNeighborhoodWatchContext(
        community: contextResponse.publicCommunity!.toCommunitySummary(
          activeAlertsCount: contextResponse.safetySummary.activeAlerts,
        ),
        canPost: contextResponse.permissions.canPost,
      );
      return;
    }
    if (contextResponse.isDynamicPublicArea &&
        contextResponse.dynamicArea != null &&
        contextResponse.dynamicArea!.areaKey.isNotEmpty) {
      nwSession?.applyNeighborhoodWatchContext(
        community: contextResponse.dynamicArea!.toCommunitySummary(
          activeAlertsCount: contextResponse.safetySummary.activeAlerts,
        ),
        canPost: contextResponse.permissions.canPost,
      );
      return;
    }
    nwSession?.clearNeighborhoodWatchParticipationContext();
  }

  String? _currentCommunityId() {
    final current = _context;
    if (current == null) return null;
    if (current.isMappedPublicCommunity) return current.publicCommunity?.id;
    if (current.isDynamicPublicArea) {
      return current.dynamicArea
          ?.toCommunitySummary(
            activeAlertsCount: current.safetySummary.activeAlerts,
          )
          .id;
    }
    return null;
  }

  void _openPost(CommunityPostItem post) {
    Navigator.of(context).pushNamed(
      NeighborhoodWatchDestinations.post(post.id),
      arguments: CommunityPostDetailRouteArgs(
        postId: post.id,
        postTitle: post.title,
        communityId: post.communityId ?? _currentCommunityId() ?? "",
        currentUserId: AppScope.of(context).cachedCitizenProfile?.id,
      ),
    );
  }

  Future<void> _togglePostReaction(CommunityPostItem post) async {
    final token = AppScope.of(context).accessToken;
    final index = _feed.indexWhere((item) => item.id == post.id);
    if (token == null || index < 0) return;
    final wasReacted = post.viewerReacted;
    setState(() {
      _feed = List<CommunityPostItem>.from(_feed)
        ..[index] = post.copyWith(
          viewerReacted: !wasReacted,
          reactionCount: wasReacted
              ? (post.reactionCount > 0 ? post.reactionCount - 1 : 0)
              : post.reactionCount + 1,
        );
    });
    try {
      if (wasReacted) {
        await _service.removeReaction(accessToken: token, postId: post.id);
      } else {
        await _service.addReaction(accessToken: token, postId: post.id);
      }
    } catch (_) {
      if (!mounted) return;
      setState(() {
        final rollbackIndex = _feed.indexWhere((item) => item.id == post.id);
        if (rollbackIndex >= 0) {
          _feed = List<CommunityPostItem>.from(_feed)..[rollbackIndex] = post;
        }
      });
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Unable to update this reaction.")),
      );
    }
  }

  Future<void> _sharePost(CommunityPostItem post) async {
    final shareLocation = post.approximateLocationLabel?.trim();
    final text = [
      post.title.trim(),
      if (post.body.trim().isNotEmpty) post.body.trim(),
      if (shareLocation != null && shareLocation.isNotEmpty)
        "Location: $shareLocation",
      "Shared from THE EYE Neighborhood Watch",
    ].join("\n\n");
    try {
      await SharePlus.instance.share(
        ShareParams(subject: post.title.trim(), text: text),
      );
    } catch (_) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text("Unable to open the share sheet.")),
      );
    }
  }

  void _returnToAppHome() {
    Navigator.of(context).pushReplacementNamed("/home");
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final current = _context;
    final headerLocation = current != null && current.isUsablePublicContext
        ? NeighborhoodWatchContextPresentation.from(
            current,
            isStale: _contextIsStale,
          )
        : null;
    final preciseLocation = _preciseLocationLabel?.trim();
    final locationParts = preciseLocation != null && preciseLocation.isNotEmpty
        ? [preciseLocation]
        : [
            headerLocation?.areaTitle,
            headerLocation?.areaSubtitle,
          ]
            .whereType<String>()
            .where((part) => part.trim().isNotEmpty)
            .toList();
    return NwPrototypeScaffold(
      title: "Neighborhood Watch",
      subtitle: locationParts.isEmpty
          ? "Finding your neighborhood..."
          : locationParts.join(" · "),
      onBack: _returnToAppHome,
      actions: [
        IconButton(
          tooltip: "Open community chat",
          icon: const Icon(Icons.forum_outlined),
          onPressed: () => Navigator.of(context).pushNamed(
            NeighborhoodWatchDestinations.chat,
            arguments: const {"contextResolved": true},
          ),
        ),
        NwPrototypeIconButton(
          icon: Icons.notifications_none,
          hasDot: true,
          onPressed: () => Navigator.of(context).pushNamed("/notifications"),
        ),
      ],
      floatingActionButton: _context?.permissions.canPost == true
          ? FloatingActionButton(
              tooltip: "Create neighborhood post",
              onPressed: () => Navigator.of(context)
                  .pushNamed(NeighborhoodWatchDestinations.create),
              child: const Icon(Icons.add),
            )
          : null,
      body: RefreshIndicator(
        onRefresh: _refreshContext,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 0, 16, 120),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (_contextIsStale && _contextCachedAt != null)
              _StaleContextBanner(cachedAt: _contextCachedAt!),
            if (_loading && _context == null)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 48),
                child: Center(child: CircularProgressIndicator()),
              )
            else if (_loadError != null && _context == null)
              _LocationIssueCard(
                title: "Unable to load neighborhood watch",
                message: _loadError!,
                onRetry: _refreshContext,
              )
            else if (_context != null)
              ..._buildContextBody(context, _context!, semantics),
          ],
        ),
      ),
    );
  }

  List<Widget> _buildContextBody(
    BuildContext context,
    NwContextResponse ctx,
    EyeSemanticColors semantics,
  ) {
    if (!ctx.isUsablePublicContext) {
      return [
        if (_contextIsStale)
          _LocationIssueCard(
            title: "Saved context (STALE)",
            message:
                _loadError ?? "Refresh your location when you are back online.",
            detail: _locationCaptureMessage,
            onRetry: _refreshContext,
            loading: _loading || _capturingLocation,
          )
        else
          _LocationIssueCard(
            title: nwLocationStatusLabel(ctx.locationStatus),
            message: nwLocationStatusRetryHint(ctx.locationStatus) ??
                "Refresh your location to continue.",
            detail: _locationCaptureMessage,
            onRetry: _refreshContext,
            loading: _loading || _capturingLocation,
          ),
      ];
    }

    final presentation = NeighborhoodWatchContextPresentation.from(
      ctx,
      isStale: _contextIsStale,
    );
    final isDynamic = presentation.isAmbient;
    final areaTitle = presentation.areaTitle;
    final areaSubtitle = presentation.areaSubtitle;
    final summary = ctx.safetySummary;
    final presence = _contextIsStale ? null : ctx.presence;

    return [
      if (!_contextIsStale &&
          presence?.switchMessage != null &&
          presence!.switchMessage!.isNotEmpty)
        Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: NwPrototypeNotice(
            title: "Area updated",
            message: presence.switchMessage!,
            icon: Icons.swap_horiz,
            color: const Color(0xFF4A9DFF),
          ),
        ),
      Text(
        "Eyes · See what is happening around you",
        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: semantics.secondaryText,
              fontWeight: FontWeight.w600,
            ),
      ),
      const SizedBox(height: 12),
      const NwPrototypeSectionHeading(title: "What's happening nearby"),
      const SizedBox(height: 10),
      if (_feedLoading && _feed.isEmpty)
        const Padding(
          padding: EdgeInsets.symmetric(vertical: 32),
          child: Center(child: CircularProgressIndicator()),
        )
      else if (_feedError != null && _feed.isEmpty)
        _LocationIssueCard(
          title: "Unable to load nearby activity",
          message: _feedError!,
          onRetry: () => _refreshFeed(ctx),
        )
      else if (_feed.isEmpty)
        NwPrototypeCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                "Nothing happening nearby right now",
                style: TextStyle(fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 4),
              Text(
                "Share the first local update, or open Community Chat to talk with your neighborhood.",
                style: TextStyle(color: semantics.mutedText),
              ),
            ],
          ),
        )
      else
        ..._feed.map(
          (post) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _NeighborhoodFeedCard(
              post: post,
              onOpen: () => _openPost(post),
              onLike: () => _togglePostReaction(post),
              onComment: () => _openPost(post),
              onShare: () => _sharePost(post),
            ),
          ),
        ),
      const SizedBox(height: 8),
      NwPrototypeCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const NwPrototypeSectionHeading(title: "Safety summary"),
            const SizedBox(height: 10),
            if (_contextIsStale)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: Text(
                  "Saved summary",
                  style: TextStyle(
                    color: semantics.warning,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            Row(
              children: [
                Expanded(
                  child: NwPrototypeStatTile(
                    value: "${summary.activeAlerts}",
                    label: "Active alerts",
                    accent: const Color(0xFFFF9933),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: NwPrototypeStatTile(
                    value: "${summary.recentVerifiedIncidents}",
                    label: "Verified incidents (7d)",
                  ),
                ),
              ],
            ),
            const SizedBox(height: 10),
            Row(
              children: [
                Expanded(
                  child: NwPrototypeStatTile(
                    value: "${summary.roadHazards}",
                    label: "Road hazards",
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: NwPrototypeStatTile(
                    value: "${summary.communityWarnings}",
                    label: "Warnings",
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
      if (isDynamic) ...[
        const SizedBox(height: 12),
        NwPrototypeNotice(
          title: "Current area conversation",
          message: [
            areaTitle,
            if (areaSubtitle.isNotEmpty) areaSubtitle,
            "This geographic room is available without a manual join request.",
          ].join(" · "),
          icon: Icons.location_on_outlined,
          color: semantics.success,
        ),
      ],
      if (_loading)
        const Padding(
          padding: EdgeInsets.only(top: 16),
          child: Center(child: CircularProgressIndicator()),
        ),
    ];
  }
}

class _NeighborhoodFeedCard extends StatelessWidget {
  const _NeighborhoodFeedCard({
    required this.post,
    required this.onOpen,
    required this.onLike,
    required this.onComment,
    required this.onShare,
  });

  final CommunityPostItem post;
  final VoidCallback onOpen;
  final VoidCallback onLike;
  final VoidCallback onComment;
  final VoidCallback onShare;

  String get _initials {
    final parts = post.displayAuthor
        .trim()
        .split(RegExp(r"\s+"))
        .where((part) => part.isNotEmpty)
        .take(2)
        .toList();
    if (parts.isEmpty) return "?";
    return parts.map((part) => part[0].toUpperCase()).join();
  }

  String get _typeLabel => switch (post.type) {
        "SafetyTip" => "Security tip",
        "SuspiciousActivity" => "Suspicious activity",
        "RoadHazard" => "Road hazard",
        "CommunityAnnouncement" => "Community update",
        "Discussion" => "Conversation",
        _ => post.type,
      };

  String? get _locationLabel {
    final label = post.approximateLocationLabel?.trim();
    if (label != null && label.isNotEmpty) return label;
    if (post.hasApproximateLocation) return "Location attached";
    return null;
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final verificationLabel = neighborhoodVerificationLabel(
      post.verificationStatus,
    );
    final imageCount = post.media.where((media) => media.isImage).length;
    final videoCount = post.media.where((media) => media.isVideo).length;
    final audioCount = post.media.where((media) => media.isAudio).length;
    return NwPrototypeCard(
      padding: EdgeInsets.zero,
      child: InkWell(
        onTap: onOpen,
        borderRadius: BorderRadius.circular(8),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(10, 10, 10, 6),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 16,
                    backgroundColor: semantics.elevatedSurface,
                    child: Text(
                      _initials,
                      style: const TextStyle(fontWeight: FontWeight.w800),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          post.displayAuthor,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        Text(
                          "${formatNeighborhoodPostAge(post.createdAt)} · $_typeLabel",
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            color: semantics.secondaryText,
                            fontSize: 11,
                          ),
                        ),
                      ],
                    ),
                  ),
                  NwPrototypePill(
                    label: verificationLabel,
                    selected: true,
                    compact: true,
                    color: verificationLabel == "Verified" ||
                            verificationLabel == "Confirmed"
                        ? semantics.verified
                        : semantics.warning,
                  ),
                ],
              ),
              const SizedBox(height: 8),
              Text(
                post.title,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
              ),
              if (post.body.trim().isNotEmpty) ...[
                const SizedBox(height: 3),
                Text(
                  post.body,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(fontSize: 13, height: 1.25),
                ),
              ],
              if (_locationLabel != null) ...[
                const SizedBox(height: 6),
                Row(
                  children: [
                    const Icon(Icons.place_outlined, size: 17),
                    const SizedBox(width: 5),
                    Expanded(
                      child: Text(
                        _locationLabel!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          color: semantics.secondaryText,
                          fontSize: 12,
                        ),
                      ),
                    ),
                  ],
                ),
              ],
              if (post.media.isNotEmpty) ...[
                const SizedBox(height: 5),
                Wrap(
                  spacing: 12,
                  runSpacing: 6,
                  children: [
                    if (imageCount > 0)
                      _FeedMeta(
                          icon: Icons.image_outlined, label: "$imageCount"),
                    if (videoCount > 0)
                      _FeedMeta(
                        icon: Icons.play_circle_outline,
                        label: "$videoCount",
                      ),
                    if (audioCount > 0)
                      _FeedMeta(icon: Icons.mic_none, label: "$audioCount"),
                  ],
                ),
              ],
              const SizedBox(height: 4),
              Row(
                children: [
                  Expanded(
                    child: TextButton.icon(
                      onPressed: onLike,
                      icon: Icon(
                        post.viewerReacted
                            ? Icons.favorite
                            : Icons.favorite_border,
                        size: 18,
                      ),
                      label: Text("Like ${post.reactionCount}"),
                      style: _actionStyle,
                    ),
                  ),
                  Expanded(
                    child: TextButton.icon(
                      onPressed: onComment,
                      icon: const Icon(Icons.chat_bubble_outline, size: 18),
                      label: Text("Comment ${post.commentCount}"),
                      style: _actionStyle,
                    ),
                  ),
                  Expanded(
                    child: TextButton.icon(
                      onPressed: onShare,
                      icon: const Icon(Icons.share_outlined, size: 18),
                      label: const Text("Share"),
                      style: _actionStyle,
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  ButtonStyle get _actionStyle => TextButton.styleFrom(
        padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 4),
        minimumSize: const Size(0, 34),
        tapTargetSize: MaterialTapTargetSize.shrinkWrap,
        textStyle: const TextStyle(fontSize: 10, fontWeight: FontWeight.w700),
      );
}

class _FeedMeta extends StatelessWidget {
  const _FeedMeta({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 17),
        const SizedBox(width: 4),
        Text(label),
      ],
    );
  }
}

class _StaleContextBanner extends StatelessWidget {
  const _StaleContextBanner({required this.cachedAt});

  final DateTime cachedAt;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: semantics.warning.withValues(alpha: 0.12),
          border: Border.all(color: semantics.warning.withValues(alpha: 0.4)),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.history, color: semantics.warning),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  nwContextStaleBannerMessage(cachedAt),
                  style: TextStyle(color: semantics.bodyText),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _LocationIssueCard extends StatelessWidget {
  const _LocationIssueCard({
    required this.title,
    required this.message,
    required this.onRetry,
    this.detail,
    this.loading = false,
  });

  final String title;
  final String message;
  final String? detail;
  final VoidCallback onRetry;
  final bool loading;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return SectionCard(
      title: title,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(message),
          if (detail != null && detail!.isNotEmpty) ...[
            const SizedBox(height: 8),
            Text(
              detail!,
              style: TextStyle(color: semantics.mutedText),
            ),
          ],
          const SizedBox(height: 16),
          FilledButton.icon(
            onPressed: loading ? null : onRetry,
            icon: loading
                ? SizedBox(
                    width: 18,
                    height: 18,
                    child: CircularProgressIndicator(
                      strokeWidth: 2,
                      color: semantics.textOnPrimary,
                    ),
                  )
                : const Icon(Icons.refresh),
            label: Text(loading ? "Refreshing..." : "Retry location"),
          ),
        ],
      ),
    );
  }
}
