import '../api/field_api_client.dart';
import '../api/field_api_paths.dart';

/// Parses `{ data: ... }` envelopes from field workflow endpoints.
Map<String, dynamic> fieldData(Map<String, dynamic> response) {
  final data = response['data'];
  if (data is Map<String, dynamic>) return data;
  if (data is List) return {'items': data};
  return response;
}

List<Map<String, dynamic>> fieldList(Map<String, dynamic> response) {
  final data = response['data'];
  if (data is List) {
    return data.map((e) => Map<String, dynamic>.from(e as Map)).toList();
  }
  if (data is Map) {
    final items = data['items'] ?? data['assignments'] ?? data['missions'];
    if (items is List) {
      return items.map((e) => Map<String, dynamic>.from(e as Map)).toList();
    }
  }
  return const [];
}

class FieldWorkflowsService {
  FieldWorkflowsService({required FieldApiClient api}) : _api = api;

  final FieldApiClient _api;

  // Dashboard
  Future<Map<String, dynamic>> getDashboard() async {
    final response = await _api.get(FieldApiPaths.dashboard);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> updateTelemetry(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(
      FieldApiPaths.dashboardTelemetry,
      body: body,
    );
    return fieldData(response);
  }

  Future<List<Map<String, dynamic>>> listCountryBroadcasts({
    int limit = 50,
  }) async {
    final response = await _api.get(
      FieldApiPaths.broadcastsCountry,
      query: {'limit': '$limit'},
    );
    return fieldList(response);
  }

  // Shifts
  Future<Map<String, dynamic>?> getActiveShift() async {
    final response = await _api.get(FieldApiPaths.shiftsActive);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> startShift(Map<String, dynamic> body) async {
    final response = await _api.post(FieldApiPaths.shiftsStart, body: body);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> pauseShift() async {
    final response = await _api.post(FieldApiPaths.shiftsPause);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> resumeShift() async {
    final response = await _api.post(FieldApiPaths.shiftsResume);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> endShift(Map<String, dynamic> body) async {
    final response = await _api.post(FieldApiPaths.shiftsEnd, body: body);
    return fieldData(response);
  }

  // Patrols
  Future<Map<String, dynamic>?> getActivePatrol() async {
    final response = await _api.get(FieldApiPaths.patrolsActive);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> startPatrol(Map<String, dynamic> body) async {
    final response = await _api.post(FieldApiPaths.patrolsStart, body: body);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> pausePatrol() async {
    final response = await _api.post(FieldApiPaths.patrolsPause);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> resumePatrol() async {
    final response = await _api.post(FieldApiPaths.patrolsResume);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> endPatrol() async {
    final response = await _api.post(FieldApiPaths.patrolsEnd);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> recordPatrolLocation(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(FieldApiPaths.patrolsLocation, body: body);
    return fieldData(response);
  }

  // Checkpoints
  Future<Map<String, dynamic>?> getActiveCheckpoint() async {
    final response = await _api.get(FieldApiPaths.checkpointsActive);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> startCheckpoint(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(
      FieldApiPaths.checkpointsStart,
      body: body,
    );
    return fieldData(response);
  }

  Future<Map<String, dynamic>> pauseCheckpoint() async {
    final response = await _api.post(FieldApiPaths.checkpointsPause);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> resumeCheckpoint() async {
    final response = await _api.post(FieldApiPaths.checkpointsResume);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> endCheckpoint() async {
    final response = await _api.post(FieldApiPaths.checkpointsEnd);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> updateCheckpointQueue(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.patch(
      FieldApiPaths.checkpointsQueue,
      body: body,
    );
    return fieldData(response);
  }

  Future<List<Map<String, dynamic>>> searchCheckpoint({
    String? q,
    String? type,
    int? limit,
  }) async {
    final response = await _api.get(
      FieldApiPaths.checkpointsSearch,
      query: {
        if (q != null && q.isNotEmpty) 'q': q,
        if (type != null && type.isNotEmpty) 'type': type,
        if (limit != null) 'limit': '$limit',
      },
    );
    return fieldList(response);
  }

  // Assignments
  Future<List<Map<String, dynamic>>> listMyAssignments({
    String? status,
    int? limit,
  }) async {
    final response = await _api.get(
      FieldApiPaths.assignmentsMine,
      query: {
        if (status != null && status.isNotEmpty) 'status': status,
        if (limit != null) 'limit': '$limit',
      },
    );
    return fieldList(response);
  }

  Future<Map<String, dynamic>> getAssignment(String id) async {
    final response = await _api.get(FieldApiPaths.assignment(id));
    return fieldData(response);
  }

  Future<Map<String, dynamic>> updateAssignment(
    String id,
    Map<String, dynamic> body,
  ) async {
    final response = await _api.patch(FieldApiPaths.assignment(id), body: body);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> recordAssignmentLocation(
    String id,
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(
      FieldApiPaths.assignmentLocation(id),
      body: body,
    );
    return fieldData(response);
  }

  Future<Map<String, dynamic>> getAssignmentLiveLocation(String id) async {
    final response = await _api.get(FieldApiPaths.assignmentLiveLocation(id));
    return fieldData(response);
  }

  Future<Map<String, dynamic>> requestBackup(String id, String reason) async {
    final response = await _api.post(
      FieldApiPaths.assignmentBackup(id),
      body: {'reason': reason},
    );
    return fieldData(response);
  }

  Future<List<Map<String, dynamic>>> getAssignmentTimeline(String id) async {
    final response = await _api.get(FieldApiPaths.assignmentTimeline(id));
    return fieldList(response);
  }

  // Responses
  Future<Map<String, dynamic>> recordResponse(Map<String, dynamic> body) async {
    final response = await _api.post(FieldApiPaths.responses, body: body);
    return fieldData(response);
  }

  Future<List<Map<String, dynamic>>> listResponsesForAssignment(
    String assignmentId,
  ) async {
    final response = await _api.get(
      FieldApiPaths.responsesForAssignment(assignmentId),
    );
    return fieldList(response);
  }

  // BOLO
  Future<List<Map<String, dynamic>>> searchBolo({
    String? q,
    String? sightingType,
    double? latitude,
    double? longitude,
    int? radiusMeters,
    int? limit,
  }) async {
    final response = await _api.get(
      FieldApiPaths.boloSearch,
      query: {
        if (q != null && q.isNotEmpty) 'q': q,
        if (sightingType != null && sightingType.isNotEmpty)
          'sightingType': sightingType,
        if (latitude != null) 'latitude': '$latitude',
        if (longitude != null) 'longitude': '$longitude',
        if (radiusMeters != null) 'radiusMeters': '$radiusMeters',
        if (limit != null) 'limit': '$limit',
      },
    );
    return fieldList(response);
  }

  Future<Map<String, dynamic>> createBoloSighting(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(FieldApiPaths.boloSightings, body: body);
    return fieldData(response);
  }

  // Drone
  Future<List<Map<String, dynamic>>> listDroneMissions() async {
    final response = await _api.get(FieldApiPaths.droneMissions);
    return fieldList(response);
  }

  Future<Map<String, dynamic>> getDroneMission(String id) async {
    final response = await _api.get(FieldApiPaths.droneMission(id));
    return fieldData(response);
  }

  Future<Map<String, dynamic>> requestDrone({
    String? incidentId,
    String? reason,
  }) async {
    final response = await _api.post(
      FieldApiPaths.droneRequest,
      body: {
        if (incidentId != null) 'incidentId': incidentId,
        if (reason != null) 'reason': reason,
      },
    );
    return fieldData(response);
  }

  // Sync
  Future<Map<String, dynamic>> syncBatch(
    List<Map<String, dynamic>> items, {
    String? generationId,
    int? offlineQueueDepth,
  }) async {
    final response = await _api.post(
      FieldApiPaths.syncBatch,
      body: {
        'items': items,
        if (generationId != null) 'generationId': generationId,
        if (offlineQueueDepth != null) 'offlineQueueDepth': offlineQueueDepth,
      },
    );
    return fieldData(response);
  }

  // Sprint 3 — GIS
  Future<Map<String, dynamic>> getMapContext({
    double? latitude,
    double? longitude,
    int? radiusMeters,
    String? layers,
  }) async {
    final response = await _api.get(
      FieldApiPaths.mapContext,
      query: {
        if (latitude != null) 'latitude': '$latitude',
        if (longitude != null) 'longitude': '$longitude',
        if (radiusMeters != null) 'radiusMeters': '$radiusMeters',
        if (layers != null && layers.isNotEmpty) 'layers': layers,
      },
    );
    return fieldData(response);
  }

  // Realtime events
  Future<Map<String, dynamic>> pollEvents({
    String? afterSequence,
    String? generationId,
    int? limit,
  }) async {
    final response = await _api.get(
      FieldApiPaths.eventsPoll,
      query: {
        if (afterSequence != null) 'afterSequence': afterSequence,
        if (generationId != null) 'generationId': generationId,
        if (limit != null) 'limit': '$limit',
      },
    );
    return fieldData(response);
  }

  // Officer safety
  Future<Map<String, dynamic>> triggerPanic(Map<String, dynamic> body) async {
    final response = await _api.post(FieldApiPaths.safetyPanic, body: body);
    return fieldData(response);
  }

  Future<Map<String, dynamic>> triggerOfficerDown(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(
      FieldApiPaths.safetyOfficerDown,
      body: body,
    );
    return fieldData(response);
  }

  Future<Map<String, dynamic>> triggerDistress(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(FieldApiPaths.safetyDistress, body: body);
    return fieldData(response);
  }

  // Backup
  Future<Map<String, dynamic>> createBackupRequest(
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(FieldApiPaths.backupCreate, body: body);
    return fieldData(response);
  }

  Future<List<Map<String, dynamic>>> listMyBackupRequests() async {
    final response = await _api.get(FieldApiPaths.backupMine);
    return fieldList(response);
  }

  // Incident comms (Phase 6 bridge)
  Future<Map<String, dynamic>> getIncidentConversation(
    String incidentId,
  ) async {
    final response = await _api.get(
      FieldApiPaths.incidentConversation(incidentId),
    );
    return fieldData(response);
  }

  Future<List<Map<String, dynamic>>> listIncidentMessages(
    String incidentId, {
    String? cursor,
    int? limit,
  }) async {
    final response = await _api.get(
      FieldApiPaths.incidentMessages(incidentId),
      query: {
        if (cursor != null) 'cursor': cursor,
        if (limit != null) 'limit': '$limit',
      },
    );
    return fieldList(response);
  }

  Future<Map<String, dynamic>> sendIncidentMessage(
    String incidentId,
    Map<String, dynamic> body,
  ) async {
    final response = await _api.post(
      FieldApiPaths.incidentMessages(incidentId),
      body: body,
    );
    return fieldData(response);
  }

  Future<void> markIncidentMessageRead(
    String incidentId,
    String messageId,
  ) async {
    await _api.patch(FieldApiPaths.incidentMessageRead(incidentId, messageId));
  }
}
