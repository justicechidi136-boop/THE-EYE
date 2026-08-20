import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";

import "../app/app_scope.dart";
import "../design_system/eye_semantic_colors.dart";
import "../location/location_permission_service.dart";
import "../theme/the_eye_theme.dart";
import "../widgets/section_card.dart";
import "../incidents/incident_submission_service.dart";
import "neighborhood_watch_prototype_chrome.dart";
import "neighborhood_watch_destinations.dart";
import "neighborhood_community_state.dart";
import "neighborhood_watch_service.dart";
import "neighborhood_watch_session.dart";
import "nw_context_cache.dart";

class NeighborhoodWatchHomeScreen extends StatefulWidget {
  const NeighborhoodWatchHomeScreen({super.key});

  @override
  State<NeighborhoodWatchHomeScreen> createState() =>
      _NeighborhoodWatchHomeScreenState();
}

class _NeighborhoodWatchHomeScreenState
    extends State<NeighborhoodWatchHomeScreen> {
  final NeighborhoodWatchService _service = NeighborhoodWatchService();
  final NwContextCache _contextCache = NwContextCache();

  NwContextResponse? _context;
  String? _loadError;
  bool _loading = false;
  bool _capturingLocation = false;
  String? _locationCaptureMessage;
  bool _contextIsStale = false;
  DateTime? _contextCachedAt;
  bool _settingHomeCommunity = false;
  String? _homeCommunityMessage;
  bool _joiningCommunity = false;
  String? _membershipMessage;

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
      } else {
        _locationCaptureMessage = locationFailureMessage(outcome.result);
      }
    } catch (_) {
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

  Future<void> _setHomeCommunity(NwPublicCommunityCard community) async {
    final token = AppScope.of(context).accessToken;
    if (token == null) return;
    setState(() {
      _settingHomeCommunity = true;
      _homeCommunityMessage = null;
    });
    try {
      await _service.setHomeCommunity(
        accessToken: token,
        communityId: community.id,
      );
      if (!mounted) return;
      setState(() {
        _homeCommunityMessage = "${community.name} is now your home community.";
      });
      await _refreshContext();
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _homeCommunityMessage = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() => _homeCommunityMessage = "Unable to set home community.");
    } finally {
      if (mounted) setState(() => _settingHomeCommunity = false);
    }
  }

  Future<void> _joinCurrentCommunity(
    NwPublicCommunityCard community,
  ) async {
    final token = AppScope.of(context).accessToken;
    if (token == null || _joiningCommunity) return;
    setState(() {
      _joiningCommunity = true;
      _membershipMessage = null;
    });
    try {
      await _service.joinCommunity(
        accessToken: token,
        communityId: community.id,
      );
      if (!mounted) return;
      setState(() => _membershipMessage = "Community membership updated.");
      await _refreshContext();
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _membershipMessage = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(
          () => _membershipMessage = "Unable to update community membership.");
    } finally {
      if (mounted) setState(() => _joiningCommunity = false);
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

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return NwPrototypeScaffold(
      title: "Neighborhood Watch",
      actions: [
        NwPrototypeIconButton(
          icon: Icons.groups_2_outlined,
          onPressed: () => Navigator.of(context)
              .pushNamed(NeighborhoodWatchDestinations.communities),
        ),
        NwPrototypeIconButton(
          icon: Icons.notifications_none,
          hasDot: true,
          onPressed: () => Navigator.of(context).pushNamed("/notifications"),
        ),
      ],
      tabs: NwPrototypeSegmentTabs(
        labels: const ["Home", "Feed", "Broadcasts", "Community"],
        selectedIndex: 0,
        onSelected: (index) {
          final route = switch (index) {
            1 => NeighborhoodWatchDestinations.feed,
            2 => NeighborhoodWatchDestinations.broadcasts,
            3 => NeighborhoodWatchDestinations.communities,
            _ => null,
          };
          if (route != null) {
            Navigator.of(context).pushReplacementNamed(route);
          }
        },
      ),
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
        if (ctx.privateCommunitiesNearby.isNotEmpty) ...[
          const SizedBox(height: 16),
          NwPrototypeCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const NwPrototypeSectionHeading(
                  title: "Private communities nearby",
                ),
                const SizedBox(height: 10),
                ...ctx.privateCommunitiesNearby.map(
                  (item) => Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: NwPrototypeListCard(
                      leading:
                          Icon(Icons.lock_outline, color: semantics.warning),
                      title: item.name,
                      subtitle:
                          "${item.approximateDistanceMeters}m away • ${item.accessHint ?? "Membership required"}",
                      onTap: () => Navigator.of(context).pushNamed(
                        NeighborhoodWatchDestinations
                            .privateCommunityMembership(item.id),
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ];
    }

    final presentation = NeighborhoodWatchContextPresentation.from(
      ctx,
      isStale: _contextIsStale,
    );
    final isDynamic = presentation.isAmbient;
    final community = ctx.publicCommunity;
    final areaTitle = presentation.areaTitle;
    final areaSubtitle = presentation.areaSubtitle;
    final summary = ctx.safetySummary;
    final presence = _contextIsStale ? null : ctx.presence;
    final isHomeCommunity = !isDynamic &&
        community != null &&
        ctx.homeCommunity?.id == community.id;
    final canPost = !_contextIsStale && ctx.permissions.canPost;
    final areaBadgeColor = presentation.isAmbient
        ? semantics.secondaryText
        : presentation.isMember
            ? semantics.success
            : semantics.warning;

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
      NwPrototypeCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            NwPrototypeSectionHeading(
              title: isDynamic ? "Current area" : "Current community",
              actionLabel: !isDynamic && community != null ? "Preview" : null,
              onAction: !isDynamic && community != null
                  ? () => Navigator.of(context).pushNamed(
                        NeighborhoodWatchDestinations.previewCommunity,
                        arguments: community.toCommunitySummary(
                          activeAlertsCount: ctx.safetySummary.activeAlerts,
                        ),
                      )
                  : null,
            ),
            const SizedBox(height: 10),
            NwPrototypePill(
              label: presentation.stateLabel,
              selected: true,
              color: areaBadgeColor,
            ),
            if (_contextIsStale) ...[
              const SizedBox(height: 8),
              NwPrototypePill(
                label: "Saved context",
                selected: true,
                color: semantics.warning,
              ),
            ],
            const SizedBox(height: 10),
            Text(
              isDynamic ? "CURRENT AREA" : "REGISTERED COMMUNITY",
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: semantics.secondaryText,
                    fontWeight: FontWeight.w700,
                    letterSpacing: 0.6,
                  ),
            ),
            const SizedBox(height: 4),
            Text(
              areaTitle,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: semantics.bodyText,
                    fontWeight: FontWeight.w800,
                  ),
            ),
            if (areaSubtitle.isNotEmpty) ...[
              const SizedBox(height: 4),
              Text(areaSubtitle),
            ],
            if (isDynamic) ...[
              const SizedBox(height: 8),
              Text(
                "No registered community has been created for this area yet.\n"
                "You can still participate in Neighborhood Watch for your current area.",
                style: TextStyle(color: semantics.mutedText),
              ),
            ],
            if (_contextIsStale && _contextCachedAt != null) ...[
              const SizedBox(height: 8),
              Text(
                "Saved at ${formatNwContextCachedAt(_contextCachedAt!)} — not current GPS.",
                style: TextStyle(color: semantics.mutedText),
              ),
            ],
            if (isHomeCommunity) ...[
              const SizedBox(height: 8),
              NwPrototypePill(
                label: "Home community",
                selected: true,
                color: semantics.success,
              ),
            ],
          ],
        ),
      ),
      if (!_contextIsStale && isDynamic) ...[
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => Navigator.of(context).pushNamed(
              NeighborhoodWatchDestinations.requestCommunity,
            ),
            icon: const Icon(Icons.add_home_work_outlined),
            label: const Text("Request community"),
          ),
        ),
      ],
      if (!_contextIsStale && !isDynamic && community != null) ...[
        if (!presentation.isMember) ...[
          const SizedBox(height: 12),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: presentation.canJoin && !_joiningCommunity
                  ? () => _joinCurrentCommunity(community)
                  : null,
              icon: _joiningCommunity
                  ? const SizedBox.square(
                      dimension: 18,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : Icon(
                      presentation.joinPending
                          ? Icons.schedule
                          : presentation.membershipRestricted
                              ? Icons.block
                              : Icons.group_add_outlined,
                    ),
              label: Text(
                _joiningCommunity
                    ? "Joining..."
                    : presentation.joinPending
                        ? "Request pending"
                        : presentation.membershipRestricted
                            ? "Membership unavailable"
                            : "Join community",
              ),
            ),
          ),
        ],
        if (_membershipMessage != null) ...[
          const SizedBox(height: 8),
          Text(_membershipMessage!),
        ],
      ],
      if (!_contextIsStale &&
          !isDynamic &&
          community != null &&
          !isHomeCommunity) ...[
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: _settingHomeCommunity
                ? null
                : () => _setHomeCommunity(community),
            icon: _settingHomeCommunity
                ? const SizedBox(
                    width: 16,
                    height: 16,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Icon(Icons.home_outlined),
            label: Text(_settingHomeCommunity
                ? "Saving home community..."
                : "Set as home community"),
          ),
        ),
        if (_homeCommunityMessage != null) ...[
          const SizedBox(height: 8),
          Text(_homeCommunityMessage!),
        ],
      ],
      const SizedBox(height: 16),
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
                  "STALE summary",
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
            if (summary.publicBroadcasts > 0) ...[
              const SizedBox(height: 10),
              NwPrototypeStatTile(
                value: "${summary.publicBroadcasts}",
                label: "Public broadcasts",
                accent: const Color(0xFF4A9DFF),
              ),
            ],
            if (summary.activeAlerts == 0 &&
                summary.roadHazards == 0 &&
                summary.communityWarnings == 0)
              Padding(
                padding: const EdgeInsets.only(top: 8),
                child: Text(
                  "No local safety alerts in the last 7 days.",
                  style: TextStyle(color: semantics.mutedText),
                ),
              ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      if (canPost) ...[
        const NwPrototypeSectionHeading(title: "Share with your area"),
        const SizedBox(height: 10),
        Row(
          children: [
            NwPrototypeActionTile(
              icon: Icons.tips_and_updates_outlined,
              label: "Share Security Tip",
              primary: true,
              onTap: () => Navigator.of(context).pushNamed(
                NeighborhoodWatchDestinations.create,
                arguments: const {"type": "SafetyTip"},
              ),
            ),
            const SizedBox(width: 10),
            NwPrototypeActionTile(
              icon: Icons.report_outlined,
              label: "Report Activity",
              color: const Color(0xFF4A9DFF),
              onTap: () => Navigator.of(context).pushNamed(
                NeighborhoodWatchDestinations.create,
                arguments: const {"type": "SuspiciousActivity"},
              ),
            ),
            const SizedBox(width: 10),
            NwPrototypeActionTile(
              icon: Icons.warning_amber_outlined,
              label: "Report Road Hazard",
              color: semantics.success,
              onTap: () => Navigator.of(context).pushNamed(
                NeighborhoodWatchDestinations.create,
                arguments: const {"type": "RoadHazard"},
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: () => Navigator.of(context)
                .pushNamed(NeighborhoodWatchDestinations.create),
            icon: const Icon(Icons.edit_outlined),
            label: const Text("Start Conversation"),
          ),
        ),
        const SizedBox(height: 12),
      ],
      NwPrototypeCard(
        highlight: true,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              "Switch to Active Emergency",
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                    color: semantics.error,
                  ),
            ),
            const SizedBox(height: 6),
            Text(
              "If the situation is immediate or dangerous, move into the canonical emergency reporting flow.",
              style: TextStyle(color: semantics.mutedText),
            ),
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                style: FilledButton.styleFrom(
                  backgroundColor: semantics.error,
                  foregroundColor: semantics.textOnPrimary,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                ),
                onPressed: () =>
                    Navigator.of(context).pushNamed("/report/emergency"),
                icon: const Icon(Icons.emergency),
                label: const Text("Report Emergency"),
              ),
            ),
          ],
        ),
      ),
      const SizedBox(height: 16),
      NwPrototypeCard(
        child: GridView.count(
          crossAxisCount: 2,
          shrinkWrap: true,
          physics: const NeverScrollableScrollPhysics(),
          mainAxisSpacing: 12,
          crossAxisSpacing: 12,
          childAspectRatio: 1.35,
          children: [
            _NavTile(
              label: "Feed",
              icon: Icons.dynamic_feed,
              color: semantics.interactiveText,
              onTap: () => Navigator.of(context)
                  .pushNamed(NeighborhoodWatchDestinations.feed),
            ),
            _NavTile(
              label: "Alerts",
              icon: Icons.campaign,
              color: semantics.interactiveText,
              onTap: () => Navigator.of(context)
                  .pushNamed(NeighborhoodWatchDestinations.alerts),
            ),
            _NavTile(
              label: "Community",
              icon: Icons.groups,
              color: semantics.interactiveText,
              onTap: () => Navigator.of(context)
                  .pushNamed(NeighborhoodWatchDestinations.communities),
            ),
            _NavTile(
              label: "Patrol",
              icon: Icons.security,
              color: semantics.interactiveText,
              onTap: () => Navigator.of(context)
                  .pushNamed(NeighborhoodWatchDestinations.patrols),
            ),
            _NavTile(
              label: "Broadcasts",
              icon: Icons.campaign_outlined,
              color: semantics.interactiveText,
              onTap: () => Navigator.of(context)
                  .pushNamed(NeighborhoodWatchDestinations.broadcasts),
            ),
          ],
        ),
      ),
      if (ctx.privateCommunitiesNearby.isNotEmpty) ...[
        const SizedBox(height: 16),
        NwPrototypeCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const NwPrototypeSectionHeading(
                  title: "Private community nearby"),
              const SizedBox(height: 10),
              ...ctx.privateCommunitiesNearby.map(
                (item) => Padding(
                  padding: const EdgeInsets.only(bottom: 10),
                  child: NwPrototypeListCard(
                    leading: Icon(Icons.lock_outline, color: semantics.warning),
                    title: item.name,
                    subtitle:
                        "${item.approximateDistanceMeters}m away • Request membership",
                    onTap: () => Navigator.of(context).pushNamed(
                      NeighborhoodWatchDestinations.privateCommunityMembership(
                          item.id),
                    ),
                  ),
                ),
              ),
            ],
          ),
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

class _AreaChangedBanner extends StatelessWidget {
  const _AreaChangedBanner({required this.message});

  final String message;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 16),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: semantics.elevatedSurface,
          border: Border.all(color: semantics.border),
          borderRadius: BorderRadius.circular(12),
        ),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(Icons.place, color: semantics.interactiveText),
              const SizedBox(width: 12),
              Expanded(
                child: Text(
                  message,
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

enum _StatusChipTone { success, warning, error }

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.label, required this.tone});

  final String label;
  final _StatusChipTone tone;

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    final color = switch (tone) {
      _StatusChipTone.success => semantics.success,
      _StatusChipTone.warning => semantics.warning,
      _StatusChipTone.error => semantics.error,
    };
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: color.withValues(alpha: 0.4)),
      ),
      child: Text(
        label,
        style: TextStyle(color: color, fontWeight: FontWeight.w600),
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

class _NavTile extends StatelessWidget {
  const _NavTile({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: context.eyeSurface,
      borderRadius: BorderRadius.circular(16),
      child: InkWell(
        borderRadius: BorderRadius.circular(16),
        onTap: onTap,
        child: Container(
          decoration: BoxDecoration(
            border: Border.all(color: context.eyeBorder),
            borderRadius: BorderRadius.circular(16),
          ),
          padding: const EdgeInsets.all(12),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: color, size: 28),
              const SizedBox(height: 8),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: EyeSemanticColors.of(context).bodyText,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
