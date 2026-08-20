import "package:flutter/material.dart";

import "../app/app_scope.dart";
import "../contracts/the_eye_api_client.dart";
import "../widgets/eye_scaffold.dart";
import "neighborhood_watch_service.dart";

class PrivateCommunityMembershipScreen extends StatefulWidget {
  const PrivateCommunityMembershipScreen({
    required this.accessToken,
    required this.communityId,
    super.key,
  });

  final String accessToken;
  final String communityId;

  @override
  State<PrivateCommunityMembershipScreen> createState() =>
      _PrivateCommunityMembershipScreenState();
}

class _PrivateCommunityMembershipScreenState
    extends State<PrivateCommunityMembershipScreen> {
  late final NeighborhoodWatchService _service;
  CommunitySummary? _community;
  String? _error;
  bool _loading = false;
  bool _joining = false;
  String? _actionMessage;
  bool _initialized = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialized) return;
    _initialized = true;
    _service = NeighborhoodWatchService(
      apiClient: AppScope.of(context).apiClient,
    );
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final community = await _service.getCommunity(
        accessToken: widget.accessToken,
        communityId: widget.communityId,
      );
      if (!mounted) return;
      setState(() {
        _community = community;
        _error = null;
      });
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _error = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() => _error = "Unable to load community membership.");
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  Future<void> _join() async {
    setState(() {
      _joining = true;
      _actionMessage = null;
    });
    try {
      await _service.joinCommunity(
        accessToken: widget.accessToken,
        communityId: widget.communityId,
      );
      if (!mounted) return;
      setState(() {
        _actionMessage = _community?.visibility == "Private"
            ? "Membership request submitted."
            : "You joined this community.";
      });
      await _load();
    } on IncidentApiException catch (error) {
      if (!mounted) return;
      setState(() => _actionMessage = error.userMessage);
    } catch (_) {
      if (!mounted) return;
      setState(() => _actionMessage = "Unable to update membership.");
    } finally {
      if (mounted) setState(() => _joining = false);
    }
  }

  String _membershipLabel(CommunitySummary community) {
    if (community.isMember) return "Approved member";
    if (community.isPending) return "Membership pending review";
    return community.visibility == "Private"
        ? "Membership required"
        : "Not a member yet";
  }

  @override
  Widget build(BuildContext context) {
    final community = _community;
    return EyeScaffold(
      title: "Community membership",
      useNavigateBackOrHome: true,
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
          physics: const AlwaysScrollableScrollPhysics(),
          children: [
            if (_loading && community == null)
              const Center(child: CircularProgressIndicator())
            else if (_error != null && community == null)
              ListTile(
                leading: const Icon(Icons.cloud_off),
                title: const Text("Membership unavailable"),
                subtitle: Text(_error!),
                trailing: IconButton(
                  icon: const Icon(Icons.refresh),
                  onPressed: _load,
                ),
              )
            else if (community != null) ...[
              ListTile(
                leading: Icon(
                  community.visibility == "Private"
                      ? Icons.lock_outline
                      : Icons.public,
                ),
                title: Text(community.name),
                subtitle: Text(
                  "${community.visibility} • ${_membershipLabel(community)}",
                ),
              ),
              if (_actionMessage != null) ...[
                const SizedBox(height: 8),
                Text(_actionMessage!),
              ],
              const SizedBox(height: 16),
              if (!community.isMember && !community.isPending)
                FilledButton(
                  onPressed: _joining ? null : _join,
                  child: _joining
                      ? const SizedBox(
                          width: 20,
                          height: 20,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : Text(
                          community.visibility == "Private"
                              ? "Request membership"
                              : "Join community",
                        ),
                )
              else if (community.isPending)
                const OutlinedButton(
                  onPressed: null,
                  child: Text("Awaiting approval"),
                )
              else
                const OutlinedButton(
                  onPressed: null,
                  child: Text("You are a member"),
                ),
            ],
          ],
        ),
      ),
    );
  }
}
