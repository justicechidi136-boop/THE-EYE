import 'dart:async';

import '../api/field_api_client.dart';
import 'field_workflows_service.dart';

/// Polls `/field/events` with sequence cursor; push fallback is handled by FCM when configured.
class FieldEventsService {
  FieldEventsService({required FieldWorkflowsService workflows})
      : _workflows = workflows;

  final FieldWorkflowsService _workflows;
  Timer? _timer;
  String _afterSequence = '0';
  String? _generationId;
  final StreamController<List<Map<String, dynamic>>> _events =
      StreamController.broadcast();

  Stream<List<Map<String, dynamic>>> get stream => _events.stream;

  void startPolling({Duration interval = const Duration(seconds: 15)}) {
    _timer?.cancel();
    _timer = Timer.periodic(interval, (_) => pollOnce());
    pollOnce();
  }

  void stopPolling() {
    _timer?.cancel();
    _timer = null;
  }

  Future<void> pollOnce() async {
    try {
      final data = await _workflows.pollEvents(
        afterSequence: _afterSequence,
        generationId: _generationId,
      );
      final events = (data['events'] as List?)
              ?.map((e) => Map<String, dynamic>.from(e as Map))
              .toList() ??
          const [];
      if (events.isNotEmpty) {
        _afterSequence = data['lastSequence']?.toString() ?? _afterSequence;
        _generationId = data['generationId']?.toString() ?? _generationId;
        _events.add(events);
      }
    } on FieldApiException {
      // Caller may trigger refresh fallback.
    }
  }

  void dispose() {
    stopPolling();
    _events.close();
  }
}
