import "package:flutter/material.dart";

import "../contracts/the_eye_api_client.dart";
import "neighborhood_watch_service.dart";

class CommunityMembersScreen extends StatefulWidget {
  const CommunityMembersScreen({
    required this.accessToken,
    required this.communityId,
    required this.communityName,
    super.key,
  });

  final String accessToken;
  final String communityId;
  final String communityName;

  @override
  State<CommunityMembersScreen> createState() => _CommunityMembersScreenState();
}

class _CommunityMembersScreenState extends State<CommunityMembersScreen> {
  final NeighborhoodWatchService _service = NeighborhoodWatchService();
  final _searchController = TextEditingController();
  final List<CommunityMemberItem> _members = [];
  String? _nextCursor;
  String? _error;
  bool _loading = false;
  bool _loadingMore = false;

  @override
  void initState() {
    super.initState();
    _load(refresh: true);
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load({bool refresh = false}) async {
    if (_loading || _loadingMore) return;
    if (refresh) {
      setState(() {
        _loading = true;
        _error = null;
        _nextCursor = null;
      });
    } else {
      if (_nextCursor == null) return;
      setState(() => _loadingMore = true);
    }
    try {
      final page = await _service.listMembers(
        accessToken: widget.accessToken,
        communityId: widget.communityId,
        search: _searchController.text.trim(),
        cursor: refresh ? null : _nextCursor,
      );
      if (!mounted) return;
      setState(() {
        if (refresh) _members.clear();
        _members.addAll(page.items);
        _nextCursor = page.nextCursor;
        _error = null;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = "Unable to load members.");
    } finally {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _loadingMore = false;
      });
    }
  }

  Color _badgeColor(String badge) {
    switch (badge) {
      case "Moderator":
        return Colors.deepPurple;
      case "Volunteer":
        return Colors.green;
      case "PatrolLead":
        return Colors.orange;
      default:
        return Colors.blueGrey;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text("${widget.communityName} members")),
      body: RefreshIndicator(
        onRefresh: () => _load(refresh: true),
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            TextField(
              controller: _searchController,
              decoration: InputDecoration(
                labelText: "Search members",
                suffixIcon: IconButton(
                  icon: const Icon(Icons.search),
                  onPressed: () => _load(refresh: true),
                ),
              ),
              onSubmitted: (_) => _load(refresh: true),
            ),
            const SizedBox(height: 12),
            if (_loading && _members.isEmpty)
              const Center(child: CircularProgressIndicator())
            else if (_error != null && _members.isEmpty)
              ListTile(
                leading: const Icon(Icons.cloud_off),
                title: const Text("Members unavailable"),
                subtitle: Text(_error!),
              )
            else if (_members.isEmpty)
              const ListTile(
                leading: Icon(Icons.groups),
                title: Text("No members found"),
              )
            else
              ..._members.map((member) {
                final badges = member.badges.isNotEmpty
                    ? member.badges
                    : [
                        member.role
                            .replaceAll(RegExp(r"([a-z])([A-Z])"), r"$1 $2")
                      ];
                return Card(
                  child: ListTile(
                    leading: CircleAvatar(
                      child: Text(
                        member.displayName.isNotEmpty
                            ? member.displayName[0].toUpperCase()
                            : "?",
                      ),
                    ),
                    title: Text(member.displayName),
                    subtitle: Wrap(
                      spacing: 6,
                      runSpacing: 4,
                      children: badges
                          .map(
                            (badge) => Chip(
                              label: Text(
                                badge,
                                style: const TextStyle(fontSize: 11),
                              ),
                              backgroundColor:
                                  _badgeColor(badge).withValues(alpha: 0.15),
                              side: BorderSide(color: _badgeColor(badge)),
                              visualDensity: VisualDensity.compact,
                            ),
                          )
                          .toList(),
                    ),
                    trailing: IconButton(
                      icon: const Icon(Icons.flag_outlined),
                      onPressed: () {
                        Navigator.of(context).pushNamed(
                          "/neighborhood-watch/report",
                          arguments: CommunityReportRouteArgs(
                            communityId: widget.communityId,
                            targetType: "Member",
                            targetId: member.userId ?? member.id,
                            targetLabel: member.displayName,
                          ),
                        );
                      },
                    ),
                  ),
                );
              }),
            if (_nextCursor != null)
              Padding(
                padding: const EdgeInsets.symmetric(vertical: 12),
                child: Center(
                  child: _loadingMore
                      ? const CircularProgressIndicator()
                      : OutlinedButton(
                          onPressed: () => _load(refresh: false),
                          child: const Text("Load more"),
                        ),
                ),
              ),
          ],
        ),
      ),
    );
  }
}

class CommunityReportRouteArgs {
  const CommunityReportRouteArgs({
    required this.communityId,
    required this.targetType,
    required this.targetId,
    required this.targetLabel,
  });

  final String communityId;
  final String targetType;
  final String targetId;
  final String targetLabel;
}
