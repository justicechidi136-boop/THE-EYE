import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../services/field_app_services.dart';
import '../../services/field_offline_queue.dart';
import '../../theme/field_theme.dart';

class BoloScreen extends StatefulWidget {
  const BoloScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<BoloScreen> createState() => _BoloScreenState();
}

class _BoloScreenState extends State<BoloScreen> {
  final _queryController = TextEditingController();
  List<Map<String, dynamic>> _results = [];
  String? _error;
  bool _searching = false;

  @override
  void dispose() {
    _queryController.dispose();
    super.dispose();
  }

  Future<void> _search() async {
    setState(() {
      _searching = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final results = await widget.services.workflows.searchBolo(
        q: _queryController.text.trim(),
        limit: 30,
      );
      if (!mounted) return;
      setState(() {
        _results = results;
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

  Future<void> _reportSighting() async {
    final clientActionId = widget.services.offlineQueue.newClientActionId();
    final body = {
      'sightingType': 'Vehicle',
      'title': 'Field sighting',
      'description': _queryController.text.trim(),
      'searchQuery': _queryController.text.trim(),
      'clientActionId': clientActionId,
    };
    try {
      await widget.services.restoreSession();
      await widget.services.workflows.createBoloSighting(body);
    } on FieldApiException {
      await widget.services.offlineQueue.enqueue(
        type: FieldOfflineActionType.sighting,
        payload: body,
        clientActionId: clientActionId,
      );
    }
    if (!mounted) return;
    final l10n = FieldLocalizations.of(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.sightingRecorded)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.boloSearch),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
      ),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              children: [
                Expanded(
                  child: TextField(
                    controller: _queryController,
                    decoration: InputDecoration(
                      labelText: l10n.searchBolo,
                      prefixIcon: const Icon(Icons.search),
                    ),
                    onSubmitted: (_) => _search(),
                  ),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _searching ? null : _search,
                  child: Text(l10n.search),
                ),
                const SizedBox(width: 12),
                OutlinedButton(
                  onPressed: _reportSighting,
                  child: Text(l10n.reportSighting),
                ),
              ],
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              Text(_error!, style: const TextStyle(color: FieldColors.danger)),
            ],
            const SizedBox(height: 16),
            if (_searching)
              const Expanded(child: Center(child: CircularProgressIndicator()))
            else
              Expanded(
                child:
                    _results.isEmpty
                        ? Center(child: Text(l10n.enterQueryToSearchBolo))
                        : ListView.separated(
                          itemCount: _results.length,
                          separatorBuilder: (_, __) => const Divider(height: 1),
                          itemBuilder: (context, index) {
                            final row = _results[index];
                            return ListTile(
                              leading: const Icon(Icons.warning_amber),
                              title: Text(row['title']?.toString() ?? 'BOLO'),
                              subtitle: Text(
                                row['description']?.toString() ??
                                    row['sightingType']?.toString() ??
                                    '',
                              ),
                            );
                          },
                        ),
              ),
          ],
        ),
      ),
    );
  }
}
