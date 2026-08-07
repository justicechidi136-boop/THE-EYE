import 'dart:convert';
import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:the_eye_field_ops/api/field_api_paths.dart';
import 'package:the_eye_field_ops/screens/routes.dart';
import 'package:the_eye_field_ops/services/field_offline_queue.dart';
import 'package:the_eye_field_ops/services/field_workflows_service.dart';

import 'package:the_eye_field_ops/api/field_api_client.dart';

class _RecordingClient extends FieldApiClient {
  _RecordingClient({required this.handler})
      : super(baseUrl: 'http://127.0.0.1:4000/v1', skipEnvGuard: true);

  final Future<Map<String, dynamic>> Function(String method, String path, Map<String, dynamic>? body) handler;

  String? lastMethod;
  String? lastPath;
  Map<String, dynamic>? lastBody;

  @override
  Future<Map<String, dynamic>> get(String path, {Map<String, String>? headers, Map<String, String>? query}) async {
    lastMethod = 'GET';
    lastPath = path;
    return handler('GET', path, null);
  }

  @override
  Future<Map<String, dynamic>> post(String path, {Map<String, dynamic>? body, Map<String, String>? headers, Map<String, String>? query}) async {
    lastMethod = 'POST';
    lastPath = path;
    lastBody = body;
    return handler('POST', path, body);
  }

  @override
  Future<Map<String, dynamic>> patch(String path, {Map<String, dynamic>? body, Map<String, String>? headers, Map<String, String>? query}) async {
    lastMethod = 'PATCH';
    lastPath = path;
    lastBody = body;
    return handler('PATCH', path, body);
  }
}

void main() {
  TestWidgetsFlutterBinding.ensureInitialized();

  test('field workflow paths cover sprint 2 and sprint 3 endpoints', () {
    expect(FieldApiPaths.dashboard, '/field/dashboard');
    expect(FieldApiPaths.patrolsStart, '/field/patrols/start');
    expect(FieldApiPaths.checkpointsSearch, '/field/checkpoints/search');
    expect(FieldApiPaths.assignment('abc'), '/field/assignments/abc');
    expect(FieldApiPaths.responsesForAssignment('abc'),
        '/field/responses/assignments/abc');
    expect(FieldApiPaths.syncBatch, '/field/sync/batch');
    expect(FieldApiPaths.mapContext, '/field/map/context');
    expect(FieldApiPaths.eventsPoll, '/field/events');
    expect(FieldApiPaths.safetyPanic, '/field/safety/panic');
    expect(FieldApiPaths.backupCreate, '/field/backup');
    expect(FieldApiPaths.incidentMessages('inc-1'), '/field/incidents/inc-1/messages');
  });

  test('operational routes are registered', () {
    expect(FieldRoutes.patrol, '/patrol');
    expect(FieldRoutes.checkpoint, '/checkpoint');
    expect(FieldRoutes.assignments, '/assignments');
    expect(FieldRoutes.incidentWorkspace, '/incident-workspace');
    expect(FieldRoutes.bolo, '/bolo');
    expect(FieldRoutes.drone, '/drone');
    expect(FieldRoutes.comms, '/comms');
  });

  test('workflows service calls dashboard endpoint', () async {
    final client = _RecordingClient(
      handler: (method, path, body) async => {
        'data': {'officer': {'displayName': 'Officer A'}},
      },
    );
    final service = FieldWorkflowsService(api: client);

    final dashboard = await service.getDashboard();

    expect(client.lastMethod, 'GET');
    expect(client.lastPath, FieldApiPaths.dashboard);
    expect(dashboard['officer'], isA<Map>());
  });

  test('offline queue persists and sync batch clears applied items', () async {
    final tempDir = await Directory.systemTemp.createTemp('field_queue_test');
    final synced = <String>[];

    final client = _RecordingClient(
      handler: (method, path, body) async {
        expect(path, FieldApiPaths.syncBatch);
        final items = body?['items'] as List? ?? [];
        return {
          'data': {
            'results': items
                .map((item) => {
                      'clientActionId': (item as Map)['clientActionId'],
                      'success': true,
                    })
                .toList(),
          },
        };
      },
    );

    final queue = FieldOfflineQueue(
      api: client,
      queueDirectory: () async => tempDir,
      connectivityProbe: () async => true,
    );

    final action = await queue.enqueue(
      type: FieldOfflineActionType.patrolLocation,
      payload: {'latitude': 6.5, 'longitude': 3.4},
    );
    expect(await queue.pendingCount(), 1);

    final result = await queue.flushIfOnline();
    expect(result['synced'], 1);
    expect(await queue.pendingCount(), 0);
    expect(synced, isEmpty);

    final file = File('${tempDir.path}/field_offline_queue.json');
    expect(await file.exists(), isTrue);
    final stored = jsonDecode(await file.readAsString()) as List;
    expect(stored, isEmpty);

    await tempDir.delete(recursive: true);
    expect(action.clientActionId, isNotEmpty);
  });
}
