import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../screens/routes.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class AssignmentsScreen extends StatefulWidget {
  const AssignmentsScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<AssignmentsScreen> createState() => _AssignmentsScreenState();
}

class _AssignmentsScreenState extends State<AssignmentsScreen> {
  List<Map<String, dynamic>> _assignments = [];
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
      final rows = await widget.services.workflows.listMyAssignments(limit: 50);
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

  void _openWorkspace(Map<String, dynamic> assignment) {
    final id = assignment['id']?.toString();
    if (id == null || id.isEmpty) return;
    Navigator.of(context).pushNamed(
      FieldRoutes.incidentWorkspace,
      arguments: {'assignmentId': id},
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Assignments'),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
        actions: [
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body: _busy
          ? const Center(child: CircularProgressIndicator())
          : _error != null
              ? Center(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(_error!),
                      const SizedBox(height: 12),
                      ElevatedButton(onPressed: _load, child: const Text('Retry')),
                    ],
                  ),
                )
              : _assignments.isEmpty
                  ? const Center(child: Text('No assignments'))
                  : RefreshIndicator(
                      onRefresh: _load,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _assignments.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 8),
                        itemBuilder: (context, index) {
                          final row = _assignments[index];
                          final incident = Map<String, dynamic>.from(
                            row['incident'] as Map? ?? const {},
                          );
                          return Card(
                            child: ListTile(
                              leading: Icon(
                                Icons.local_police,
                                color: _priorityColor(
                                  row['priority'] ?? incident['priority'],
                                ),
                              ),
                              title: Text(
                                incident['title']?.toString() ??
                                    'Assignment ${row['id']}',
                              ),
                              subtitle: Text(
                                '${row['status'] ?? 'Unknown'} · '
                                '${incident['priority'] ?? '—'}',
                              ),
                              trailing: const Icon(Icons.chevron_right),
                              onTap: () => _openWorkspace(row),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }

  Color _priorityColor(Object? priority) {
    final value = priority?.toString() ?? '';
    if (value.contains('P1')) return FieldColors.danger;
    if (value.contains('P2')) return FieldColors.orange;
    return FieldColors.muted;
  }
}
