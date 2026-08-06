import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../evidence/evidence_upload_service.dart";
import "../evidence/local_evidence_attachment.dart";
import "incident_communication_contract.dart";

class IncidentCommunicationService {
  IncidentCommunicationService(this._client);

  final TheEyeApiClient _client;
  static const _queueKey = "incident_message_offline_queue";

  Future<Map<String, dynamic>> fetchConversation(String incidentId, String accessToken) async {
    final response = await _client.getJson(
      TheEyeApiPaths.incidentConversation(incidentId),
      accessToken: accessToken,
    );
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return (decoded["data"] as Map<String, dynamic>?) ?? {};
  }

  Future<List<IncidentThreadMessage>> fetchMessages(String incidentId, String accessToken) async {
    final response = await _client.getJson(
      TheEyeApiPaths.incidentMessages(incidentId),
      accessToken: accessToken,
    );
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    final rows = decoded["data"];
    if (rows is! List) return const [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(IncidentThreadMessage.fromJson)
        .toList(growable: false);
  }

  Future<IncidentThreadMessage> sendMessage({
    required String incidentId,
    required String accessToken,
    required String clientMessageId,
    required String messageType,
    String? body,
    String? attachmentId,
    Map<String, dynamic>? structuredAction,
  }) async {
    final response = await _client.postJson(
      TheEyeApiPaths.incidentMessages(incidentId),
      {
        "clientMessageId": clientMessageId,
        "messageType": messageType,
        if (body != null) "body": body,
        if (attachmentId != null) "attachmentId": attachmentId,
        if (structuredAction != null) "structuredAction": structuredAction,
      },
      accessToken: accessToken,
    );
    final decoded = jsonDecode(response.body) as Map<String, dynamic>;
    return IncidentThreadMessage.fromJson(decoded["data"] as Map<String, dynamic>);
  }

  Future<void> markRead(String incidentId, String messageId, String accessToken) async {
    await _client.patchJson(
      TheEyeApiPaths.incidentMessageRead(incidentId, messageId),
      {},
      accessToken: accessToken,
    );
  }

  Future<List<QueuedIncidentMessage>> loadQueue() async {
    final prefs = await SharedPreferences.getInstance();
    final raw = prefs.getString(_queueKey);
    if (raw == null || raw.isEmpty) return const [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return const [];
    return decoded
        .whereType<Map<String, dynamic>>()
        .map(QueuedIncidentMessage.fromJson)
        .toList(growable: true);
  }

  Future<void> saveQueue(List<QueuedIncidentMessage> queue) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(
      _queueKey,
      jsonEncode(queue.map((item) => item.toJson()).toList(growable: false)),
    );
  }

  Future<void> enqueueOffline(QueuedIncidentMessage message) async {
    final queue = await loadQueue();
    if (queue.any((item) => item.clientMessageId == message.clientMessageId)) return;
    queue.add(message);
    await saveQueue(queue);
  }

  Future<void> flushQueue(
    String incidentId,
    String accessToken, {
    EvidenceUploadService? uploadService,
  }) async {
    final queue = await loadQueue();
    final remaining = <QueuedIncidentMessage>[];
    for (final item in queue) {
      if (item.incidentId != incidentId) {
        remaining.add(item);
        continue;
      }
      try {
        var attachmentId = item.attachmentId;
        if (attachmentId == null && item.localAttachment != null) {
          if (uploadService == null) {
            remaining.add(item);
            continue;
          }
          item.state = QueuedMessageState.uploading;
          final attachment = LocalEvidenceAttachment.fromJson(item.localAttachment!);
          final uploaded = await uploadService.uploadForIncident(
            incidentId: item.incidentId,
            attachments: [attachment],
            accessToken: accessToken,
            fallbackLatitude: attachment.latitude,
            fallbackLongitude: attachment.longitude,
          );
          attachmentId = uploaded.first.id;
          if (attachmentId == null || attachmentId.isEmpty) {
            throw StateError("Uploaded media did not return an id");
          }
          item.attachmentId = attachmentId;
        }
        item.state = QueuedMessageState.sending;
        await sendMessage(
          incidentId: item.incidentId,
          accessToken: accessToken,
          clientMessageId: item.clientMessageId,
          messageType: item.messageType,
          body: item.body,
          attachmentId: attachmentId,
          structuredAction: item.structuredAction,
        );
        item.state = QueuedMessageState.sent;
      } catch (_) {
        item.retryCount += 1;
        item.state = QueuedMessageState.failed;
        remaining.add(item);
      }
    }
    await saveQueue(remaining);
  }
}
