import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class CheckpointModeScreen extends StatefulWidget {
  const CheckpointModeScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<CheckpointModeScreen> createState() => _CheckpointModeScreenState();
}

class _CheckpointModeScreenState extends State<CheckpointModeScreen> {
  Map<String, dynamic>? _checkpoint;
  List<Map<String, dynamic>> _searchResults = [];
  String? _error;
  bool _busy = true;
  bool _searching = false;
  final _searchController = TextEditingController();
  int _queueCount = 0;
  int _vehicleChecks = 0;

  @override
  void initState() {
    super.initState();
    _load();
  }

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final checkpoint = await widget.services.workflows.getActiveCheckpoint();
      if (!mounted) return;
      setState(() {
        _checkpoint = checkpoint;
        _queueCount = checkpoint?['queueCount'] as int? ?? 0;
        _vehicleChecks = checkpoint?['vehicleChecks'] as int? ?? 0;
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

  Future<void> _startCheckpoint() async {
    await widget.services.restoreSession();
    await widget.services.workflows.startCheckpoint({
      'checkpointName': 'Field checkpoint',
      'checkpointZoneLabel': 'Primary lane',
    });
    await _load();
  }

  Future<void> _endCheckpoint() async {
    await widget.services.restoreSession();
    await widget.services.workflows.endCheckpoint();
    await _load();
  }

  Future<void> _updateQueue() async {
    await widget.services.restoreSession();
    await widget.services.workflows.updateCheckpointQueue({
      'queueCount': _queueCount,
      'vehicleChecks': _vehicleChecks,
    });
    if (!mounted) return;
    final l10n = FieldLocalizations.of(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.queueUpdated)));
  }

  Future<void> _search(String type) async {
    setState(() => _searching = true);
    try {
      await widget.services.restoreSession();
      final results = await widget.services.workflows.searchCheckpoint(
        q: _searchController.text.trim(),
        type: type,
        limit: 20,
      );
      if (!mounted) return;
      setState(() {
        _searchResults = results;
        _searching = false;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _searching = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.checkpoint),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
      ),
      body:
          _busy
              ? const Center(child: CircularProgressIndicator())
              : Padding(
                padding: const EdgeInsets.all(24),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 2,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Text(
                            _checkpoint == null
                                ? l10n.noActiveCheckpoint
                                : _checkpoint!['checkpointName']?.toString() ??
                                    l10n.checkpointActive,
                            style: Theme.of(context).textTheme.headlineLarge,
                          ),
                          if (_error != null) ...[
                            const SizedBox(height: 8),
                            Text(
                              _error!,
                              style: const TextStyle(color: FieldColors.danger),
                            ),
                          ],
                          const SizedBox(height: 24),
                          Row(
                            children: [
                              Expanded(
                                child: _CounterCard(
                                  label: l10n.queueCount,
                                  value: _queueCount,
                                  onChanged:
                                      (v) => setState(() => _queueCount = v),
                                ),
                              ),
                              const SizedBox(width: 16),
                              Expanded(
                                child: _CounterCard(
                                  label: l10n.vehicleChecks,
                                  value: _vehicleChecks,
                                  onChanged:
                                      (v) => setState(() => _vehicleChecks = v),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 16),
                          if (_checkpoint != null)
                            ElevatedButton(
                              onPressed: _updateQueue,
                              child: Text(l10n.saveQueueStats),
                            ),
                          const SizedBox(height: 16),
                          if (_checkpoint == null)
                            ElevatedButton(
                              onPressed: _startCheckpoint,
                              child: Text(l10n.startCheckpointSession),
                            )
                          else
                            OutlinedButton(
                              onPressed: _endCheckpoint,
                              child: Text(l10n.endCheckpointSession),
                            ),
                        ],
                      ),
                    ),
                    const SizedBox(width: 24),
                    Expanded(
                      flex: 3,
                      child: Card(
                        child: Padding(
                          padding: const EdgeInsets.all(20),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.stretch,
                            children: [
                              Text(
                                l10n.search,
                                style:
                                    Theme.of(context).textTheme.headlineMedium,
                              ),
                              const SizedBox(height: 12),
                              TextField(
                                controller: _searchController,
                                decoration: InputDecoration(
                                  labelText: l10n.plateIdOrName,
                                  prefixIcon: const Icon(Icons.search),
                                ),
                              ),
                              const SizedBox(height: 12),
                              Wrap(
                                spacing: 8,
                                runSpacing: 8,
                                children: [
                                  ElevatedButton(
                                    onPressed:
                                        _searching
                                            ? null
                                            : () => _search('vehicle'),
                                    child: Text(l10n.vehicle),
                                  ),
                                  ElevatedButton(
                                    onPressed:
                                        _searching
                                            ? null
                                            : () => _search('person'),
                                    child: Text(l10n.person),
                                  ),
                                  ElevatedButton(
                                    onPressed:
                                        _searching
                                            ? null
                                            : () => _search('bolo'),
                                    child: const Text('BOLO'),
                                  ),
                                  OutlinedButton(
                                    onPressed:
                                        _searching
                                            ? null
                                            : () => _search('all'),
                                    child: Text(l10n.all),
                                  ),
                                ],
                              ),
                              const SizedBox(height: 16),
                              if (_searching)
                                const Center(child: CircularProgressIndicator())
                              else
                                Expanded(
                                  child:
                                      _searchResults.isEmpty
                                          ? Center(
                                            child: Text(
                                              l10n.searchResultsAppearHere,
                                              style:
                                                  Theme.of(
                                                    context,
                                                  ).textTheme.bodyMedium,
                                            ),
                                          )
                                          : ListView.separated(
                                            itemCount: _searchResults.length,
                                            separatorBuilder:
                                                (_, __) =>
                                                    const Divider(height: 1),
                                            itemBuilder: (context, index) {
                                              final row = _searchResults[index];
                                              return ListTile(
                                                title: Text(
                                                  row['title']?.toString() ??
                                                      row['label']
                                                          ?.toString() ??
                                                      'Result ${index + 1}',
                                                ),
                                                subtitle: Text(
                                                  row['description']
                                                          ?.toString() ??
                                                      row['type']?.toString() ??
                                                      '',
                                                ),
                                              );
                                            },
                                          ),
                                ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
    );
  }
}

class _CounterCard extends StatelessWidget {
  const _CounterCard({
    required this.label,
    required this.value,
    required this.onChanged,
  });

  final String label;
  final int value;
  final ValueChanged<int> onChanged;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(label, style: Theme.of(context).textTheme.bodySmall),
            const SizedBox(height: 8),
            Row(
              children: [
                IconButton(
                  onPressed: value > 0 ? () => onChanged(value - 1) : null,
                  icon: const Icon(Icons.remove_circle_outline),
                ),
                Text(
                  '$value',
                  style: Theme.of(context).textTheme.headlineMedium,
                ),
                IconButton(
                  onPressed: () => onChanged(value + 1),
                  icon: const Icon(Icons.add_circle_outline),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
