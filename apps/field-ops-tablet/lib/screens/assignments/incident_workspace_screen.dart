import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class IncidentWorkspaceScreen extends StatefulWidget {
  const IncidentWorkspaceScreen({
    super.key,
    required this.services,
    required this.assignmentId,
  });

  final FieldAppServices services;
  final String assignmentId;

  @override
  State<IncidentWorkspaceScreen> createState() =>
      _IncidentWorkspaceScreenState();
}

class _IncidentWorkspaceScreenState extends State<IncidentWorkspaceScreen> {
  Map<String, dynamic>? _assignment;
  List<Map<String, dynamic>> _timeline = [];
  List<Map<String, dynamic>> _responses = [];
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final assignment = await widget.services.workflows.getAssignment(
        widget.assignmentId,
      );
      final timeline = await widget.services.workflows.getAssignmentTimeline(
        widget.assignmentId,
      );
      final responses = await widget.services.workflows
          .listResponsesForAssignment(widget.assignmentId);
      if (!mounted) return;
      setState(() {
        _assignment = assignment;
        _timeline = timeline;
        _responses = responses;
        _busy = false;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _busy = false;
      });
    }
  }

  Future<void> _requestBackup() async {
    await widget.services.restoreSession();
    await widget.services.workflows.requestBackup(
      widget.assignmentId,
      'Officer requested backup from field tablet',
    );
    if (!mounted) return;
    final l10n = FieldLocalizations.of(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.backupRequestSent)));
  }

  Future<void> _recordEnRoute() async {
    await widget.services.restoreSession();
    await widget.services.workflows.recordResponse({
      'responseType': 'EnRoute',
      'assignmentId': widget.assignmentId,
      'note': 'En route from field tablet',
    });
    await _load();
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    final incident = Map<String, dynamic>.from(
      _assignment?['incident'] as Map? ?? const {},
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(incident['title']?.toString() ?? l10n.incidentWorkspace),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body:
          _busy
              ? const Center(child: CircularProgressIndicator())
              : _error != null
              ? Center(child: Text(_error!))
              : Row(
                children: [
                  Expanded(
                    flex: 2,
                    child: Padding(
                      padding: const EdgeInsets.all(20),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            incident['description']?.toString() ??
                                l10n.noDescription,
                            style: Theme.of(context).textTheme.bodyLarge,
                          ),
                          const SizedBox(height: 16),
                          _InfoRow(
                            label: l10n.status,
                            value: _assignment?['status']?.toString() ?? '-',
                          ),
                          _InfoRow(
                            label: l10n.priority,
                            value: incident['priority']?.toString() ?? '-',
                          ),
                          const Spacer(),
                          ElevatedButton(
                            onPressed: _recordEnRoute,
                            child: Text(l10n.markEnRoute),
                          ),
                          const SizedBox(height: 12),
                          OutlinedButton(
                            onPressed: _requestBackup,
                            child: Text(l10n.requestBackup),
                          ),
                        ],
                      ),
                    ),
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(
                    flex: 3,
                    child: DefaultTabController(
                      length: 2,
                      child: Column(
                        children: [
                          TabBar(
                            tabs: [
                              Tab(text: l10n.timeline),
                              Tab(text: l10n.responses),
                            ],
                          ),
                          Expanded(
                            child: TabBarView(
                              children: [
                                _EventList(
                                  items: _timeline,
                                  emptyLabel: l10n.noTimelineEvents,
                                ),
                                _EventList(
                                  items: _responses,
                                  emptyLabel: l10n.noResponsesRecorded,
                                ),
                              ],
                            ),
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

class _InfoRow extends StatelessWidget {
  const _InfoRow({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Row(
        children: [
          SizedBox(
            width: 120,
            child: Text(label, style: Theme.of(context).textTheme.bodySmall),
          ),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodyMedium),
          ),
        ],
      ),
    );
  }
}

class _EventList extends StatelessWidget {
  const _EventList({required this.items, required this.emptyLabel});

  final List<Map<String, dynamic>> items;
  final String emptyLabel;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return Center(child: Text(emptyLabel));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = items[index];
        return ListTile(
          title: Text(
            row['message']?.toString() ??
                row['responseType']?.toString() ??
                row['title']?.toString() ??
                'Event',
          ),
          subtitle: Text(
            row['createdAt']?.toString() ?? row['recordedAt']?.toString() ?? '',
          ),
        );
      },
    );
  }
}
