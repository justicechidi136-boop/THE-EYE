import "dart:async";

import "package:flutter/material.dart";
import "package:flutter/semantics.dart";

import "../design_system/eye_semantic_colors.dart";
import "../emergency/active_emergency_navigation.dart";
import "../incidents/incident_submission_service.dart";
import "activity_history_cache.dart";
import "activity_history_service.dart";
import "activity_navigation.dart";

class ActivityHistoryScreen extends StatefulWidget {
  const ActivityHistoryScreen({
    required this.accessToken,
    required this.controller,
    this.onRefreshDrafts,
    this.composeDrafts = const [],
    this.pendingDrafts = const [],
    this.loadingDrafts = false,
    this.draftError,
    this.onRetryPending,
    this.syncingPending = false,
    this.online = true,
    super.key,
  });

  final String? accessToken;
  final ActiveEmergencyNavigationController controller;
  final Future<void> Function()? onRefreshDrafts;
  final List<dynamic> composeDrafts;
  final List<dynamic> pendingDrafts;
  final bool loadingDrafts;
  final String? draftError;
  final Future<void> Function()? onRetryPending;
  final bool syncingPending;
  final bool online;

  @override
  State<ActivityHistoryScreen> createState() => _ActivityHistoryScreenState();
}

class _ActivityHistoryScreenState extends State<ActivityHistoryScreen> {
  static const _sections = [
    "All",
    "Active",
    "Resolved",
    "Cancelled",
    "Broadcasts",
    "EmergencyReports",
    "SOS",
    "MissingPersons",
    "StolenVehicles",
  ];

  final ActivityHistoryService _service = ActivityHistoryService();
  final ActivityHistoryCache _cache = ActivityHistoryCache();
  final TextEditingController _searchController = TextEditingController();

  String _section = "All";
  List<ActivityHistoryItem> _items = const [];
  bool _loading = true;
  bool _loadingMore = false;
  String? _error;
  String? _nextCursor;
  bool _hasMore = false;
  String? _searchQuery;

  @override
  void initState() {
    super.initState();
    unawaited(_load(refresh: true));
    unawaited(widget.onRefreshDrafts?.call());
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool refresh = false}) async {
    final token = widget.accessToken;
    if (token == null || token.isEmpty) {
      setState(() {
        _loading = false;
        _items = const [];
        _error = "Sign in to view your activity history.";
      });
      return;
    }

    if (refresh) {
      setState(() {
        _loading = true;
        _error = null;
        _nextCursor = null;
      });
      final cached = await _cache.load(scope: _cacheScope(token), section: _section);
      if (cached != null && mounted) {
        setState(() {
          _items = cached.items;
          _nextCursor = cached.nextCursor;
          _hasMore = cached.hasMore;
        });
      }
    } else {
      setState(() => _loadingMore = true);
    }

    try {
      final page = await _service.listActivityHistory(
        accessToken: token,
        section: _section,
        query: _searchQuery,
        cursor: refresh ? null : _nextCursor,
      );
      if (!mounted) return;
      setState(() {
        _items = refresh ? page.items : [..._items, ...page.items];
        _nextCursor = page.nextCursor;
        _hasMore = page.hasMore;
        _loading = false;
        _loadingMore = false;
        _error = null;
      });
      await _cache.save(
        scope: _cacheScope(token),
        section: _section,
        items: _items,
        nextCursor: _nextCursor,
        hasMore: _hasMore,
      );
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = _items.isEmpty ? error.userMessage : null;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
        _error = _items.isEmpty ? "Unable to load activity history." : null;
      });
    }
  }

  String _cacheScope(String token) => token.length >= 8 ? token.substring(token.length - 16) : token;

  void _applySection(String section) {
    if (_section == section) return;
    setState(() => _section = section);
    unawaited(_load(refresh: true));
  }

  void _submitSearch() {
    setState(() => _searchQuery = _searchController.text.trim());
    unawaited(_load(refresh: true));
  }

  IconData _iconForKind(String kind) {
    switch (kind) {
      case "SOS":
        return Icons.sos;
      case "SilentSOS":
        return Icons.volume_off;
      case "MissingPersonBroadcast":
        return Icons.person_search;
      case "StolenVehicleBroadcast":
        return Icons.directions_car;
      default:
        return Icons.emergency;
    }
  }

  @override
  Widget build(BuildContext context) {
    return RefreshIndicator(
      onRefresh: () => _load(refresh: true),
      child: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Semantics(
            header: true,
            label: "Activity history search",
            child: TextField(
              controller: _searchController,
              textInputAction: TextInputAction.search,
              decoration: InputDecoration(
                labelText: "Search activity",
                hintText: "ID, name, plate, location, status",
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search),
                  tooltip: "Search activity history",
                  onPressed: _submitSearch,
                ),
              ),
              onSubmitted: (_) => _submitSearch(),
            ),
          ),
          const SizedBox(height: 12),
          Semantics(
            label: "Activity filters",
            child: SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: _sections
                    .map(
                      (section) => Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          label: Text(section.replaceAll("Reports", " reports")),
                          selected: _section == section,
                          onSelected: (_) => _applySection(section),
                        ),
                      ),
                    )
                    .toList(),
              ),
            ),
          ),
          const SizedBox(height: 12),
          if (_loading && _items.isEmpty)
            const Center(
              child: Padding(
                padding: EdgeInsets.all(24),
                child: CircularProgressIndicator(),
              ),
            ),
          if (_error != null)
            ListTile(
              leading: const Icon(Icons.cloud_off),
              title: const Text("History unavailable"),
              subtitle: Text(_error!),
            ),
          if (!_loading && _items.isEmpty && _error == null)
            const ListTile(
              leading: Icon(Icons.history),
              title: Text("No activity yet"),
              subtitle: Text("Emergencies, SOS alerts, and broadcasts you create will appear here."),
            ),
          ..._items.map(
            (item) => _ActivityHistoryCard(
              item: item,
              icon: _iconForKind(item.kind),
              onTap: () => openActivityDestination(
                context,
                widget.controller,
                navigation: item.navigation,
                silent: item.kind == "SilentSOS",
              ),
            ),
          ),
          if (_hasMore)
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 12),
              child: Semantics(
                button: true,
                label: "Load more activity history",
                child: FilledButton(
                  onPressed: _loadingMore ? null : () => _load(refresh: false),
                  child: Text(_loadingMore ? "Loading..." : "Load more"),
                ),
              ),
            ),
        ],
      ),
    );
  }
}

class _ActivityHistoryCard extends StatelessWidget {
  const _ActivityHistoryCard({
    required this.item,
    required this.icon,
    required this.onTap,
  });

  final ActivityHistoryItem item;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final tint = EyeSemanticColors.verificationTint(context, item.verificationStatus);
    final preview = item.timelinePreview.take(3).map((entry) => entry.label).join(", ");
    final semanticsLabel = [
      item.category,
      item.id,
      item.statusBadge,
      item.dateLabel,
      item.timeLabel,
      if (item.locationAddress != null) item.locationAddress,
      if (item.agency != null) "Agency ${item.agency}",
      if (item.verificationConfidence != null) "${item.verificationConfidence}% confidence",
      if (item.broadcastReach != null) "${item.broadcastReach} people reached",
      if (item.latestUpdateLabel != null) "Latest update ${item.latestUpdateLabel}",
      if (item.unreadUpdatesCount > 0) "${item.unreadUpdatesCount} unread updates",
      if (preview.isNotEmpty) "Timeline preview $preview",
    ].join(". ");

    return Semantics(
      button: true,
      label: semanticsLabel,
      child: Card(
        margin: const EdgeInsets.only(bottom: 12),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(12),
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Icon(icon, size: 28),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item.title, style: const TextStyle(fontWeight: FontWeight.w800)),
                          Text("${item.category} • ${item.id}"),
                          Text("${item.dateLabel} ${item.timeLabel}"),
                          if (item.locationAddress != null) Text(item.locationAddress!),
                        ],
                      ),
                    ),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.end,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: tint.withValues(alpha: 0.12),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(item.statusBadge, style: const TextStyle(fontWeight: FontWeight.w700)),
                        ),
                        if (item.unreadUpdatesCount > 0)
                          Padding(
                            padding: const EdgeInsets.only(top: 8),
                            child: Badge(label: Text("${item.unreadUpdatesCount}")),
                          ),
                      ],
                    ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  [
                    if (item.agency != null) "Agency: ${item.agency}",
                    "Verification: ${item.verificationStatus}",
                    if (item.broadcastReach != null) "Reach: ${item.broadcastReach}",
                    if (item.latestUpdateLabel != null) "Latest: ${item.latestUpdateLabel}",
                  ].join(" • "),
                ),
                if (preview.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text("Timeline: $preview", style: Theme.of(context).textTheme.bodySmall),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
