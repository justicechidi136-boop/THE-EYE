/// Incident communication contract for Active Emergency messaging.
library;

class IncidentCommunicationSummary {
  const IncidentCommunicationSummary({
    required this.conversationAvailable,
    required this.unreadMessageCount,
    required this.conversationStatus,
    required this.allowedCommunicationActions,
    this.lastMessagePreview,
    this.lastMessageAt,
    this.pendingInformationRequestCount = 0,
  });

  final bool conversationAvailable;
  final int unreadMessageCount;
  final String? lastMessagePreview;
  final DateTime? lastMessageAt;
  final int pendingInformationRequestCount;
  final String conversationStatus;
  final IncidentCommunicationAllowedActions allowedCommunicationActions;

  factory IncidentCommunicationSummary.fromJson(Map<String, dynamic>? json) {
    if (json == null) {
      return IncidentCommunicationSummary(
        conversationAvailable: false,
        unreadMessageCount: 0,
        conversationStatus: "Active",
        allowedCommunicationActions: const IncidentCommunicationAllowedActions(
          sendText: false,
          sendVoice: false,
          sendPhoto: false,
          sendVideo: false,
          sendLocation: false,
          quickReply: false,
          openThread: false,
        ),
      );
    }
    return IncidentCommunicationSummary(
      conversationAvailable: json["conversationAvailable"] == true,
      unreadMessageCount: (json["unreadMessageCount"] as num?)?.toInt() ?? 0,
      lastMessagePreview: json["lastMessagePreview"]?.toString(),
      lastMessageAt: json["lastMessageAt"] == null
          ? null
          : DateTime.tryParse(json["lastMessageAt"].toString()),
      pendingInformationRequestCount:
          (json["pendingInformationRequestCount"] as num?)?.toInt() ?? 0,
      conversationStatus: json["conversationStatus"]?.toString() ?? "Active",
      allowedCommunicationActions: IncidentCommunicationAllowedActions.fromJson(
        (json["allowedCommunicationActions"] as Map<String, dynamic>?) ?? const {},
      ),
    );
  }
}

class IncidentCommunicationAllowedActions {
  const IncidentCommunicationAllowedActions({
    required this.sendText,
    required this.sendVoice,
    required this.sendPhoto,
    required this.sendVideo,
    required this.sendLocation,
    required this.quickReply,
    required this.openThread,
  });

  final bool sendText;
  final bool sendVoice;
  final bool sendPhoto;
  final bool sendVideo;
  final bool sendLocation;
  final bool quickReply;
  final bool openThread;

  factory IncidentCommunicationAllowedActions.empty() {
    return const IncidentCommunicationAllowedActions(
      sendText: false,
      sendVoice: false,
      sendPhoto: false,
      sendVideo: false,
      sendLocation: false,
      quickReply: false,
      openThread: false,
    );
  }

  factory IncidentCommunicationAllowedActions.fromJson(Map<String, dynamic> json) {
    return IncidentCommunicationAllowedActions(
      sendText: json["sendText"] == true,
      sendVoice: json["sendVoice"] == true,
      sendPhoto: json["sendPhoto"] == true,
      sendVideo: json["sendVideo"] == true,
      sendLocation: json["sendLocation"] == true,
      quickReply: json["quickReply"] == true,
      openThread: json["openThread"] == true,
    );
  }
}

class IncidentThreadMessage {
  const IncidentThreadMessage({
    required this.id,
    required this.messageType,
    required this.body,
    required this.senderRole,
    required this.senderLabel,
    required this.createdAt,
    this.deliveryState,
    this.structuredAction,
    this.clientMessageId,
    this.attachmentId,
  });

  final String id;
  final String messageType;
  final String body;
  final String senderRole;
  final String senderLabel;
  final DateTime createdAt;
  final String? deliveryState;
  final Map<String, dynamic>? structuredAction;
  final String? clientMessageId;
  final String? attachmentId;

  factory IncidentThreadMessage.fromJson(Map<String, dynamic> json) {
    return IncidentThreadMessage(
      id: json["id"].toString(),
      messageType: json["messageType"].toString(),
      body: json["body"].toString(),
      senderRole: json["senderRole"].toString(),
      senderLabel: json["senderLabel"]?.toString() ?? json["senderRole"].toString(),
      createdAt: DateTime.parse(json["createdAt"].toString()),
      deliveryState: json["deliveryState"]?.toString(),
      structuredAction: json["structuredAction"] as Map<String, dynamic>?,
      clientMessageId: json["clientMessageId"]?.toString(),
      attachmentId: json["attachmentId"]?.toString(),
    );
  }
}

enum QueuedMessageState {
  queued,
  uploading,
  sending,
  sent,
  delivered,
  read,
  failed,
}

class QueuedIncidentMessage {
  QueuedIncidentMessage({
    required this.clientMessageId,
    required this.incidentId,
    required this.messageType,
    required this.body,
    required this.createdAt,
    this.attachmentId,
    this.attachmentLocalPath,
    this.localAttachment,
    this.structuredAction,
    this.state = QueuedMessageState.queued,
    this.retryCount = 0,
  });

  final String clientMessageId;
  final String incidentId;
  final String messageType;
  final String body;
  final DateTime createdAt;
  String? attachmentId;
  final String? attachmentLocalPath;
  final Map<String, dynamic>? localAttachment;
  final Map<String, dynamic>? structuredAction;
  QueuedMessageState state;
  int retryCount;

  Map<String, dynamic> toJson() => {
        "clientMessageId": clientMessageId,
        "incidentId": incidentId,
        "messageType": messageType,
        "body": body,
        "createdAt": createdAt.toIso8601String(),
        if (attachmentId != null) "attachmentId": attachmentId,
        if (attachmentLocalPath != null) "attachmentLocalPath": attachmentLocalPath,
        if (localAttachment != null) "localAttachment": localAttachment,
        if (structuredAction != null) "structuredAction": structuredAction,
        "state": state.name,
        "retryCount": retryCount,
      };

  factory QueuedIncidentMessage.fromJson(Map<String, dynamic> json) {
    return QueuedIncidentMessage(
      clientMessageId: json["clientMessageId"].toString(),
      incidentId: json["incidentId"].toString(),
      messageType: json["messageType"].toString(),
      body: json["body"].toString(),
      createdAt: DateTime.parse(json["createdAt"].toString()),
      attachmentId: json["attachmentId"]?.toString(),
      attachmentLocalPath: json["attachmentLocalPath"]?.toString(),
      localAttachment: json["localAttachment"] as Map<String, dynamic>?,
      structuredAction: json["structuredAction"] as Map<String, dynamic>?,
      state: QueuedMessageState.values.firstWhere(
        (v) => v.name == json["state"]?.toString(),
        orElse: () => QueuedMessageState.queued,
      ),
      retryCount: (json["retryCount"] as num?)?.toInt() ?? 0,
    );
  }
}
