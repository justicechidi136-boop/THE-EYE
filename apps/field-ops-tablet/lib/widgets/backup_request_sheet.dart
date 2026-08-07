import 'package:flutter/material.dart';
import 'package:geolocator/geolocator.dart';

import '../api/field_api_client.dart';
import '../services/field_app_services.dart';
import '../services/field_offline_queue.dart';
import '../theme/field_theme.dart';

const _backupTypes = [
  'Immediate',
  'Medical',
  'Fire',
  'Armed',
  'Traffic',
  'Supervisor',
  'Tow',
  'Drone',
];

class BackupRequestSheet extends StatefulWidget {
  const BackupRequestSheet({
    super.key,
    required this.services,
    this.incidentId,
    this.assignmentId,
  });

  final FieldAppServices services;
  final String? incidentId;
  final String? assignmentId;

  @override
  State<BackupRequestSheet> createState() => _BackupRequestSheetState();
}

class _BackupRequestSheetState extends State<BackupRequestSheet> {
  String _requestType = 'Immediate';
  final _reasonController = TextEditingController();
  bool _busy = false;

  @override
  void dispose() {
    _reasonController.dispose();
    super.dispose();
  }

  Future<void> _submit() async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await widget.services.restoreSession();
      Position? position;
      try {
        position = await Geolocator.getCurrentPosition();
      } on Object {
        // GPS optional.
      }
      final clientActionId = widget.services.offlineQueue.newClientActionId();
      final body = {
        'requestType': _requestType,
        'reason': _reasonController.text.trim(),
        'clientActionId': clientActionId,
        if (widget.incidentId != null) 'incidentId': widget.incidentId,
        if (widget.assignmentId != null) 'assignmentId': widget.assignmentId,
        if (position != null) ...{
          'latitude': position.latitude,
          'longitude': position.longitude,
        },
      };

      try {
        await widget.services.workflows.createBackupRequest(body);
        if (!mounted) return;
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('$_requestType backup requested')),
        );
      } on FieldApiException {
        await widget.services.offlineQueue.enqueue(
          type: FieldOfflineActionType.backup,
          clientActionId: clientActionId,
          payload: body,
        );
        if (!mounted) return;
        Navigator.of(context).pop(true);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Backup queued for sync')),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: EdgeInsets.only(
        left: 16,
        right: 16,
        top: 16,
        bottom: MediaQuery.of(context).viewInsets.bottom + 16,
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text('Request backup', style: Theme.of(context).textTheme.headlineMedium),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            value: _requestType,
            decoration: const InputDecoration(labelText: 'Backup type'),
            items: _backupTypes
                .map((t) => DropdownMenuItem(value: t, child: Text(t)))
                .toList(),
            onChanged: _busy ? null : (v) => setState(() => _requestType = v ?? 'Immediate'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: _reasonController,
            decoration: const InputDecoration(labelText: 'Reason'),
            maxLines: 2,
          ),
          const SizedBox(height: 16),
          ElevatedButton(
            style: ElevatedButton.styleFrom(
              minimumSize: const Size.fromHeight(52),
              backgroundColor: FieldColors.orange,
              foregroundColor: FieldColors.dark,
            ),
            onPressed: _busy ? null : _submit,
            child: _busy
                ? const SizedBox(
                    height: 20,
                    width: 20,
                    child: CircularProgressIndicator(strokeWidth: 2),
                  )
                : const Text('Submit backup request'),
          ),
        ],
      ),
    );
  }
}
