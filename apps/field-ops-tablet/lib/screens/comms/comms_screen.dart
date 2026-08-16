import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../services/field_app_services.dart';
import '../../screens/routes.dart';
import '../../theme/field_theme.dart';

/// Incident-scoped communications via `/field/incidents/:id/messages`.
class CommsScreen extends StatefulWidget {
  const CommsScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<CommsScreen> createState() => _CommsScreenState();
}

class _CommsScreenState extends State<CommsScreen> {
  List<Map<String, dynamic>> _assignments = [];
  String? _selectedAssignmentId;
  String? _selectedIncidentId;
  List<Map<String, dynamic>> _messages = [];
  final _messageController = TextEditingController();
  String? _error;
  bool _busy = true;
  int _unreadCount = 0;

  @override
  void initState() {
    super.initState();
    _loadAssignments();
  }

  @override
  void dispose() {
    _messageController.dispose();
    super.dispose();
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
      final assignment = await widget.services.workflows.getAssignment(
        assignmentId,
      );
      final incident = Map<String, dynamic>.from(
        assignment['incident'] as Map? ?? const {},
      );
      final incidentId = incident['id']?.toString();
      if (incidentId == null || incidentId.isEmpty) {
        throw FieldApiException('Assignment has no incident scope');
      }
      final messages = await widget.services.workflows.listIncidentMessages(
        incidentId,
      );
      if (!mounted) return;
      setState(() {
        _selectedIncidentId = incidentId;
        _messages = messages;
        _unreadCount = messages.where((m) => m['readAt'] == null).length;
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

  Future<void> _sendMessage() async {
    final incidentId = _selectedIncidentId;
    final text = _messageController.text.trim();
    if (incidentId == null || text.isEmpty) return;
    setState(() => _busy = true);
    try {
      await widget.services.restoreSession();
      await widget.services.workflows.sendIncidentMessage(incidentId, {
        'messageType': 'Text',
        'body': text,
      });
      _messageController.clear();
      await _loadComms(_selectedAssignmentId!);
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
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.communications),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
        actions: [
          if (_unreadCount > 0)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: Center(
                child: Chip(
                  label: Text(l10n.unreadCount(_unreadCount)),
                  backgroundColor: FieldColors.orange,
                ),
              ),
            ),
        ],
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
                    l10n.activeAssignments,
                    style: Theme.of(context).textTheme.headlineMedium,
                  ),
                ),
                Expanded(
                  child:
                      _busy && _assignments.isEmpty
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
                                      l10n.assignmentId(id),
                                ),
                                subtitle: Text(row['status']?.toString() ?? ''),
                                onTap: id.isEmpty ? null : () => _loadComms(id),
                              );
                            },
                          ),
                ),
              ],
            ),
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child:
                _selectedAssignmentId == null
                    ? Center(
                      child: Text(
                        _error ?? l10n.selectAssignmentToViewComms,
                        style: Theme.of(context).textTheme.bodyLarge,
                      ),
                    )
                    : Column(
                      children: [
                        if (_error != null)
                          Padding(
                            padding: const EdgeInsets.all(12),
                            child: Text(
                              _error!,
                              style: const TextStyle(color: FieldColors.danger),
                            ),
                          ),
                        Expanded(
                          child:
                              _busy
                                  ? const Center(
                                    child: CircularProgressIndicator(),
                                  )
                                  : _CommsList(items: _messages),
                        ),
                        Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Expanded(
                                child: TextField(
                                  controller: _messageController,
                                  decoration: InputDecoration(
                                    hintText: l10n.quickReply,
                                  ),
                                  onSubmitted: (_) => _sendMessage(),
                                ),
                              ),
                              const SizedBox(width: 8),
                              ElevatedButton(
                                onPressed: _busy ? null : _sendMessage,
                                child: Text(l10n.send),
                              ),
                              const SizedBox(width: 8),
                              OutlinedButton(
                                onPressed: () {
                                  Navigator.of(context).pushNamed(
                                    FieldRoutes.incidentWorkspace,
                                    arguments: {
                                      'assignmentId': _selectedAssignmentId,
                                    },
                                  );
                                },
                                child: Text(l10n.workspace),
                              ),
                            ],
                          ),
                        ),
                      ],
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
      return Center(
        child: Text(FieldLocalizations.of(context).noMessagesInIncidentScope),
      );
    }
    return ListView.separated(
      padding: const EdgeInsets.all(16),
      itemCount: items.length,
      separatorBuilder: (_, __) => const Divider(height: 1),
      itemBuilder: (context, index) {
        final row = items[index];
        return ListTile(
          leading: Icon(
            row['messageType'] == 'Voice'
                ? Icons.mic
                : Icons.chat_bubble_outline,
          ),
          title: Text(
            row['body']?.toString() ??
                row['messageType']?.toString() ??
                'Message',
          ),
          subtitle: Text(
            '${row['senderRole'] ?? 'Unknown'} · ${row['createdAt'] ?? ''}',
          ),
          trailing:
              row['readAt'] == null
                  ? const Icon(
                    Icons.mark_email_unread,
                    color: FieldColors.orange,
                    size: 18,
                  )
                  : const Icon(Icons.done_all, size: 18),
        );
      },
    );
  }
}
