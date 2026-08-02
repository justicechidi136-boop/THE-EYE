import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "support_models.dart";

class SupportService {
  SupportService({TheEyeApiClient? client}) : _client = client ?? TheEyeApiClient();

  final TheEyeApiClient _client;

  void _ensureSuccess(dynamic response) {
    if (response.statusCode >= 200 && response.statusCode < 300) return;
    throw IncidentApiException.fromResponse(response);
  }

  Map<String, dynamic> _decodeBody(dynamic response) {
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    if (decoded is Map && decoded["data"] != null) {
      return Map<String, dynamic>.from(decoded["data"] as Map);
    }
    return Map<String, dynamic>.from(decoded as Map);
  }

  Future<List<SupportConversationSummary>> listConversations({
    required String accessToken,
    String? cursor,
  }) async {
    final response = await _client.getJson(
      TheEyeSupportApiPaths.chats,
      accessToken: accessToken,
      query: cursor == null ? null : {"cursor": cursor},
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] : null;
    if (data is! List) return [];
    return data
        .map((item) =>
            SupportConversationSummary.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<SupportConversationDetail> getConversation({
    required String accessToken,
    required String conversationId,
  }) async {
    final response = await _client.getJson(
      TheEyeSupportApiPaths.chat(conversationId),
      accessToken: accessToken,
    );
    return SupportConversationDetail.fromJson(_decodeBody(response));
  }

  Future<SupportConversationDetail> createConversation({
    required String accessToken,
    required SupportCategory category,
    required String subject,
    String? body,
    String? incidentId,
    String? clientMessageId,
    String? attachmentKey,
    String messageType = "Text",
    Map<String, dynamic>? diagnosticMetadata,
    bool anonymousMode = false,
    String? preferredLanguage,
  }) async {
    final response = await _client.postJson(
      TheEyeSupportApiPaths.chats,
      {
        "category": category.apiValue,
        "subject": subject,
        if (body != null && body.trim().isNotEmpty) "body": body.trim(),
        if (incidentId != null) "incidentId": incidentId,
        if (clientMessageId != null) "clientMessageId": clientMessageId,
        if (attachmentKey != null) "attachmentKey": attachmentKey,
        "messageType": messageType,
        if (diagnosticMetadata != null && diagnosticMetadata.isNotEmpty)
          "diagnosticMetadata": diagnosticMetadata,
        "anonymousMode": anonymousMode,
        if (preferredLanguage != null) "preferredLanguage": preferredLanguage,
      },
      accessToken: accessToken,
    );
    return SupportConversationDetail.fromJson(_decodeBody(response));
  }

  Future<SupportMessageItem> sendMessage({
    required String accessToken,
    required String conversationId,
    String? body,
    String? clientMessageId,
    String? attachmentKey,
    String messageType = "Text",
    String? attachmentMimeType,
    int? attachmentDurationSeconds,
  }) async {
    final response = await _client.postJson(
      TheEyeSupportApiPaths.chatMessages(conversationId),
      {
        if (body != null && body.trim().isNotEmpty) "body": body.trim(),
        if (clientMessageId != null) "clientMessageId": clientMessageId,
        if (attachmentKey != null) "attachmentKey": attachmentKey,
        "messageType": messageType,
        if (attachmentMimeType != null) "attachmentMimeType": attachmentMimeType,
        if (attachmentDurationSeconds != null)
          "attachmentDurationSeconds": attachmentDurationSeconds,
      },
      accessToken: accessToken,
    );
    return SupportMessageItem.fromJson(_decodeBody(response));
  }

  Future<void> markRead({
    required String accessToken,
    required String conversationId,
  }) async {
    final response = await _client.patchJson(
      TheEyeSupportApiPaths.chatRead(conversationId),
      {},
      accessToken: accessToken,
    );
    _ensureSuccess(response);
  }

  Future<Map<String, dynamic>> presignAttachment({
    required String accessToken,
    required String conversationId,
    required String fileName,
    required String contentType,
    int? sizeBytes,
  }) async {
    final response = await _client.postJson(
      TheEyeSupportApiPaths.chatAttachmentPresign(conversationId),
      {
        "fileName": fileName,
        "contentType": contentType,
        if (sizeBytes != null) "sizeBytes": sizeBytes,
      },
      accessToken: accessToken,
    );
    return _decodeBody(response);
  }

  Future<List<Map<String, String>>> listRecentIncidents({
    required String accessToken,
  }) async {
    final response = await _client.getJson(
      TheEyeApiPaths.incidents,
      accessToken: accessToken,
    );
    _ensureSuccess(response);
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] : null;
    if (data is! List) return [];
    return data.take(10).map((item) {
      final map = Map<String, dynamic>.from(item as Map);
      return {
        "id": map["id"] as String,
        "title": map["title"] as String? ?? "Incident",
      };
    }).toList();
  }
}
