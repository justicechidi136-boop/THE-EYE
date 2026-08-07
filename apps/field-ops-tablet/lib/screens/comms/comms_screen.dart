import 'package:flutter/material.dart';

import '../../api/field_api_paths.dart';
import '../../api/field_api_client.dart';
import '../../screens/routes.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

/// Comms shell linking assignment timeline and response API paths.
class CommsScreen extends StatefulWidget {
  const CommsScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<CommsScreen> createState() => _CommsScreenState();
}

class _CommsScreenState extends State<CommsScreen> {
  List<Map<String, dynamic>> _assignments = [];
  String? _selectedAssignmentId;
  List<Map<String, dynamic>> _timeline = [];
  List<Map<String, dynamic>> _responses = [];
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  Future<void> _loadAssignments() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final rows = await widget.services.workflows.listMyAssignments(limit: 20);
      if (!mounted) return;
      setState(() {
        _assignments = rows;
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

  Future<void> _loadComms(String assignmentId) async {
    setState(() {
      _selectedAssignmentId = assignmentId;
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final timeline =
          await widget.services.workflows.getAssignmentTimeline(assignmentId);
      final responses = await widget.services.workflows
          .listResponsesForAssignment(assignmentId);
      if (!mounted) return;
      setState(() {
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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Incident comms'),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
      ),
      body: Row(
        children: [
          SizedBox(
            width: 320,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Active assignments',
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
                Expanded(
                  child: _busy && _assignments.isEmpty
                      ? const Center(child: CircularProgressIndicator())
                      : ListView.builder(
                          itemCount: _assignments.length,
                          itemBuilder: (context, index) {
                            final row = _assignments[index];
                            final id = row['id']?.toString() ?? '';
                            final incident = Map<String, dynamic>.from(
                              row['incident'] as Map? ?? const {},
                            );
                            return ListTile(
                              selected: _selectedAssignmentId == id,
                              title: Text(
                                incident['title']?.toString() ??
                                    'Assignment $id',
                              ),
                              subtitle: Text(row['status']?.toString() ?? ''),
                              onTap: id.isEmpty ? null : () => _loadComms(id),
                            );
                          },
                        ),
                ),
                const Divider(height: 1),
                Padding(
                  padding: const EdgeInsets.all(12),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'API paths',
                        style: Theme.of(context).textTheme.labelLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        FieldApiPaths.responses,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                      if (_selectedAssignmentId != null) ...[
                        const SizedBox(height: 4),
                        Text(
                          FieldApiPaths.assignmentTimeline(_selectedAssignmentId!),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        Text(
                          FieldApiPaths.responsesForAssignment(
                            _selectedAssignmentId!,
                          ),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ],
                    ],
                  ),
                ),
              ],
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: _selectedAssignmentId == null
                ? Center(
                    child: Text(
                      _error ?? 'Select an assignment to view comms',
                      style: Theme.of(context).textTheme.bodyLarge,
                    ),
                  )
                : _busy
                    ? const Center(child: CircularProgressIndicator())
                    : DefaultTabController(
                        length: 2,
                        child: Column(
                          children: [
                            TabBar(
                              tabs: const [
                                Tab(text: 'Timeline'),
                                Tab(text: 'Responses'),
                              ],
                              onTap: (_) {},
                            ),
                            Expanded(
                              child: TabBarView(
                                children: [
                                  _CommsList(items: _timeline),
                                  _CommsList(items: _responses),
                                ],
                              ),
                            ),
                            Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: OutlinedButton(
                                      onPressed: () {
                                        Navigator.of(context).pushNamed(
                                          FieldRoutes.incidentWorkspace,
                                          arguments: {
                                            'assignmentId':
                                                _selectedAssignmentId,
                                          },
                                        );
                                      },
                                      child: const Text('Open workspace'),
                                    ),
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

class _CommsList extends StatelessWidget {
  const _CommsList({required this.items});

  final List<Map<String, dynamic>> items;

  @override
  Widget build(BuildContext context) {
    if (items.isEmpty) {
      return const Center(child: Text('No comms events'));
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = items[index];
        return ListTile(
          leading: const Icon(Icons.chat_bubble_outline),
          title: Text(
            row['message']?.toString() ??
                row['responseType']?.toString() ??
                'Event',
          ),
          subtitle: Text(row['createdAt']?.toString() ?? ''),
        );
      },
    );
  }
}
