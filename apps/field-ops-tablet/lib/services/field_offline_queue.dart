import 'dart:convert';
import 'dart:io';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../api/field_api_client.dart';
import 'field_workflows_service.dart';

/// Offline action types aligned with `/field/sync/batch` item types.
enum FieldOfflineActionType {
  shift('shift'),
  patrol('patrol'),
  checkpoint('checkpoint'),
  response('response'),
  sighting('sighting'),
  patrolLocation('patrolLocation');

  const FieldOfflineActionType(this.apiValue);
  final String apiValue;
}

class FieldOfflineAction {
  const FieldOfflineAction({
    required this.clientActionId,
    required this.type,
    required this.payload,
    this.capturedAt,
  });

  factory FieldOfflineAction.fromJson(Map<String, dynamic> json) {
    return FieldOfflineAction(
      clientActionId: json['clientActionId'] as String,
      type: FieldOfflineActionType.values.firstWhere(
        (t) => t.apiValue == json['type'],
        orElse: () => FieldOfflineActionType.response,
      ),
      payload: Map<String, dynamic>.from(json['payload'] as Map? ?? const {}),
      capturedAt: json['capturedAt'] as String?,
    );
  }

  Map<String, dynamic> toJson() => {
        'clientActionId': clientActionId,
        'type': type.apiValue,
        'capturedAt': capturedAt ?? DateTime.now().toUtc().toIso8601String(),
        'payload': payload,
      };

  Map<String, dynamic> toSyncItem() => toJson();

  final String clientActionId;
  final FieldOfflineActionType type;
  final Map<String, dynamic> payload;
  final String? capturedAt;
}

class FieldOfflineQueue {
  FieldOfflineQueue({
    FieldApiClient? api,
    FieldWorkflowsService? workflows,
    Connectivity? connectivity,
    Uuid? uuid,
    Future<Directory> Function()? queueDirectory,
    Future<bool> Function()? connectivityProbe,
  })  : _workflows = workflows ?? FieldWorkflowsService(api: api!),
        _connectivity = connectivity ?? Connectivity(),
        _uuid = uuid ?? const Uuid(),
        _queueDirectory = queueDirectory ?? _defaultQueueDirectory,
        _connectivityProbe = connectivityProbe;

  final FieldWorkflowsService _workflows;
  final Connectivity _connectivity;
  final Uuid _uuid;
  final Future<Directory> Function() _queueDirectory;
  final Future<bool> Function()? _connectivityProbe;

  static const _fileName = 'field_offline_queue.json';

  static Future<Directory> _defaultQueueDirectory() async {
    final dir = await getApplicationDocumentsDirectory();
    final queueDir = Directory('${dir.path}/field_ops');
    if (!await queueDir.exists()) {
      await queueDir.create(recursive: true);
    }
    return queueDir;
  }

  Future<File> _queueFile() async {
    final dir = await _queueDirectory();
    return File('${dir.path}/$_fileName');
  }

  Future<List<FieldOfflineAction>> readAll() async {
    final file = await _queueFile();
    if (!await file.exists()) return [];
    try {
      final raw = await file.readAsString();
      final decoded = jsonDecode(raw);
      if (decoded is! List) return [];
      return decoded
          .map((e) => FieldOfflineAction.fromJson(Map<String, dynamic>.from(e as Map)))
          .toList();
    } catch (_) {
      return [];
    }
  }

  Future<void> _writeAll(List<FieldOfflineAction> actions) async {
    final file = await _queueFile();
    final encoded = jsonEncode(actions.map((a) => a.toJson()).toList());
    await file.writeAsString(encoded);
  }

  String newClientActionId() => _uuid.v4();

  Future<FieldOfflineAction> enqueue({
    required FieldOfflineActionType type,
    required Map<String, dynamic> payload,
    String? clientActionId,
  }) async {
    final action = FieldOfflineAction(
      clientActionId: clientActionId ?? newClientActionId(),
      type: type,
      payload: {
        ...payload,
        if (!payload.containsKey('clientActionId'))
          'clientActionId': clientActionId ?? newClientActionId(),
      },
      capturedAt: DateTime.now().toUtc().toIso8601String(),
    );
    final pending = await readAll();
    pending.add(action);
    await _writeAll(pending);
    return action;
  }

  Future<bool> get isOnline async {
    final probe = _connectivityProbe;
    if (probe != null) return probe();
    final result = await _connectivity.checkConnectivity();
    return !result.contains(ConnectivityResult.none);
  }

  Future<Map<String, dynamic>> flushIfOnline() async {
    if (!await isOnline) {
      return {'synced': 0, 'skipped': true, 'reason': 'offline'};
    }
    final pending = await readAll();
    if (pending.isEmpty) {
      return {'synced': 0, 'skipped': false};
    }

    final result = await _workflows.syncBatch(
      pending.map((a) => a.toSyncItem()).toList(),
    );

    final syncedIds = <String>{};
    final results = result['results'];
    if (results is List) {
      for (final row in results) {
        if (row is Map) {
          final id = row['clientActionId']?.toString();
          final ok = row['success'] == true || row['status'] == 'applied';
          if (id != null && ok) syncedIds.add(id);
        }
      }
    }

    // If server did not return per-item results, assume full batch success.
    if (syncedIds.isEmpty && results == null) {
      syncedIds.addAll(pending.map((a) => a.clientActionId));
    }

    final remaining =
        pending.where((a) => !syncedIds.contains(a.clientActionId)).toList();
    await _writeAll(remaining);

    return {
      'synced': syncedIds.length,
      'remaining': remaining.length,
      'result': result,
    };
  }

  Future<int> pendingCount() async => (await readAll()).length;
}
