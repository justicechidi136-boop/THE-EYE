import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";

import "../app/app_scope.dart";
import "../design_system/components/eye_page_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "../location/location_permission_service.dart";
import "../theme/the_eye_theme.dart";
import "../widgets/section_card.dart";
import "../incidents/incident_submission_service.dart";
import "neighborhood_watch_destinations.dart";
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
      setState(() {
        _context = stripLivePresence(cached.context);
        _contextIsStale = true;
        _contextCachedAt = cached.cachedAt;
      });
      _syncSelectedCommunity(cached.context);
    }
    await _refreshContext();
  }

  Future<void> _refreshContext() async {
    final session = AppScope.of(context);
    final token = session.accessToken;
    if (token == null) return;

    if (!session.online) {
      if (_context != null) {
        if (!mounted) return;
        setState(() {
          _contextIsStale = true;
          _loadError = null;
        });
      } else {
        if (!mounted) return;
        setState(() {
          _loadError = "You are offline and no saved neighborhood context is available.";
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
        setState(() {
          _contextIsStale = true;
          _loadError = error.userMessage;
        });
      } else {
        setState(() {
          _context = null;
          _loadError = error.userMessage;
        });
      }
    } catch (_) {
      if (!mounted) return;
      if (_context != null) {
        setState(() {
          _contextIsStale = true;
          _loadError = "Unable to refresh neighborhood context.";
        });
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
      setState(
          () => _homeCommunityMessage = "Unable to set home community.");
    } finally {
      if (mounted) setState(() => _settingHomeCommunity = false);
    }
  }

  void _syncSelectedCommunity(NwContextResponse contextResponse) {
    final community = contextResponse.publicCommunity;
    if (community == null || community.id.isEmpty) return;
    final session = AppScope.of(context);
    final nwSession =
        session is NeighborhoodWatchSession ? session as NeighborhoodWatchSession : null;
    nwSession?.selectCommunity(
      community.toCommunitySummary(
        activeAlertsCount: contextResponse.safetySummary.activeAlerts,
      ),
    );
  }
  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Scaffold(
      backgroundColor: semantics.background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const EyePageHeader.root(title: "NEIGHBORHOOD WATCH"),
          Expanded(
            child: RefreshIndicator(
              onRefresh: _refreshContext,
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 120),
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
          ),
        ],
      ),
    );
  }

  List<Widget> _buildContextBody(
    BuildContext context,
    NwContextResponse ctx,
    EyeSemanticColors semantics,
  ) {
    if (!ctx.isConfirmed) {
      return [
        if (_contextIsStale)
          _LocationIssueCard(
            title: "Saved context (STALE)",
            message: _loadError ??
                "Refresh your location when you are back online.",
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
        if (ctx.locationStatus == NwLocationStatus.noPublicCommunity &&
            ctx.privateCommunitiesNearby.isNotEmpty) ...[
          const SizedBox(height: 16),
          SectionCard(
            title: "Private communities nearby",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: ctx.privateCommunitiesNearby
                  .map(
                    (item) => ListTile(
                      contentPadding: EdgeInsets.zero,
                      title: Text(item.name),
                      subtitle: Text(
                        "${item.approximateDistanceMeters}m away • ${item.accessHint ?? "Membership required"}",
                      ),
                      trailing: const Icon(Icons.lock_outline),
                      onTap: () => Navigator.of(context).pushNamed(
                        NeighborhoodWatchDestinations.privateCommunityMembership(
                            item.id),
                      ),
                    ),
                  )
                  .toList(),
            ),
          ),
        ],
      ];
    }

    final community = ctx.publicCommunity!;
    final summary = ctx.safetySummary;
    final presence = _contextIsStale ? null : ctx.presence;
    final isHomeCommunity = ctx.homeCommunity?.id == community.id;

    return [
      if (!_contextIsStale &&
          presence?.switchMessage != null &&
          presence!.switchMessage!.isNotEmpty)
        _AreaChangedBanner(message: presence.switchMessage!),
      SectionCard(
        title: "Current area",
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              community.name,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    color: semantics.bodyText,
                    fontWeight: FontWeight.w600,
                  ),
            ),
            const SizedBox(height: 4),
            Text(community.areaLabel),
            const SizedBox(height: 8),
            _StatusChip(
              label: _contextIsStale
                  ? "STALE"
                  : nwLocationStatusLabel(ctx.locationStatus),
              tone: _contextIsStale
                  ? _StatusChipTone.warning
                  : _StatusChipTone.success,
            ),
            if (!_contextIsStale && presence?.accuracyM != null) ...[
              const SizedBox(height: 8),
              Text("GPS accuracy: ${presence!.accuracyM!.round()}m"),
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
              Text(
                "Home community",
                style: TextStyle(color: semantics.success),
              ),
            ],
          ],
        ),
      ),
      if (!_contextIsStale && !isHomeCommunity) ...[
        const SizedBox(height: 12),
        OutlinedButton.icon(
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
        if (_homeCommunityMessage != null) ...[
          const SizedBox(height: 8),
          Text(_homeCommunityMessage!),
        ],
      ],
      const SizedBox(height: 16),
      SectionCard(
        title: "Safety summary",
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
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
            Text("Active alerts: ${summary.activeAlerts}"),
            Text("Verified incidents (7d): ${summary.recentVerifiedIncidents}"),
            Text("Road hazards: ${summary.roadHazards}"),
            Text("Community warnings: ${summary.communityWarnings}"),
            if (summary.publicBroadcasts > 0)
              Text("Public broadcasts: ${summary.publicBroadcasts}"),
          ],
        ),
      ),
      const SizedBox(height: 16),
      FilledButton.icon(
        style: FilledButton.styleFrom(
          backgroundColor: semantics.error,
          foregroundColor: semantics.textOnPrimary,
          padding: const EdgeInsets.symmetric(vertical: 16),
        ),
        onPressed: () => Navigator.of(context).pushNamed("/report/emergency"),
        icon: const Icon(Icons.emergency),
        label: const Text("Report emergency"),
      ),
      const SizedBox(height: 16),
      SectionCard(
        title: "Explore",
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
          ],
        ),
      ),
      if (ctx.permissions.canPost) ...[
        const SizedBox(height: 12),
        FilledButton.icon(
          onPressed: () => Navigator.of(context)
              .pushNamed(NeighborhoodWatchDestinations.create),
          icon: const Icon(Icons.forum_outlined),
          label: const Text("Start Conversation"),
        ),
        const SizedBox(height: 8),
        OutlinedButton.icon(
          onPressed: () =>
              Navigator.of(context).pushNamed("/report/emergency"),
          icon: const Icon(Icons.emergency),
          label: const Text("Report Emergency"),
        ),
      ],
      if (ctx.privateCommunitiesNearby.isNotEmpty) ...[
        const SizedBox(height: 16),
        SectionCard(
          title: "Private communities nearby",
          child: Column(
            children: ctx.privateCommunitiesNearby
                .map(
                  (item) => ListTile(
                    contentPadding: EdgeInsets.zero,
                    title: Text(item.name),
                    subtitle: Text("${item.approximateDistanceMeters}m away"),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.of(context).pushNamed(
                      NeighborhoodWatchDestinations.privateCommunityMembership(
                          item.id),
                    ),
                  ),
                )
                .toList(),
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
