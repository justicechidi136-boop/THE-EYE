import "dart:convert";

import "package:shared_preferences/shared_preferences.dart";

class PendingSupportMessage {
  PendingSupportMessage({
    required this.conversationId,
    required this.clientMessageId,
    this.body,
    this.attachmentKey,
    this.messageType = "Text",
  });

  factory PendingSupportMessage.fromJson(Map<String, dynamic> json) {
    return PendingSupportMessage(
      conversationId: json["conversationId"] as String,
      clientMessageId: json["clientMessageId"] as String,
      body: json["body"] as String?,
      attachmentKey: json["attachmentKey"] as String?,
      messageType: json["messageType"] as String? ?? "Text",
    );
  }

  Map<String, dynamic> toJson() => {
        "conversationId": conversationId,
        "clientMessageId": clientMessageId,
        if (body != null) "body": body,
        if (attachmentKey != null) "attachmentKey": attachmentKey,
        "messageType": messageType,
      };

  final String conversationId;
  final String clientMessageId;
  final String? body;
  final String? attachmentKey;
  final String messageType;
}

class PendingSupportMessageStore {
  PendingSupportMessageStore(this._preferences);

  static const storageKey = "the_eye_pending_support_messages";

  final SharedPreferences _preferences;

  static Future<PendingSupportMessageStore> create() async {
    return PendingSupportMessageStore(await SharedPreferences.getInstance());
  }

  Future<List<PendingSupportMessage>> load() async {
    final raw = _preferences.getString(storageKey);
    if (raw == null || raw.isEmpty) return [];
    final decoded = jsonDecode(raw);
    if (decoded is! List) return [];
    return decoded
        .map((item) =>
            PendingSupportMessage.fromJson(Map<String, dynamic>.from(item as Map)))
        .toList();
  }

  Future<void> save(List<PendingSupportMessage> messages) async {
    await _preferences.setString(
      storageKey,
      jsonEncode(messages.map((message) => message.toJson()).toList()),
    );
  }
}
