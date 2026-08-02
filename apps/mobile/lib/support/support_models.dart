abstract final class TheEyeSupportApiPaths {
  static const chats = "/support/chats";
  static String chat(String id) => "/support/chats/$id";
  static String chatMessages(String id) => "/support/chats/$id/messages";
  static String chatRead(String id) => "/support/chats/$id/read";
  static String chatClose(String id) => "/support/chats/$id/close";
  static String chatReopen(String id) => "/support/chats/$id/reopen";
  static String chatAttachmentPresign(String id) =>
      "/support/chats/$id/attachments/presign";
  static String chatAttachmentConfirm(String id) =>
      "/support/chats/$id/attachments/confirm";
  static String chatAttachmentUrl(String id, String messageId) =>
      "/support/chats/$id/messages/$messageId/attachment-url";
}

enum SupportCategory {
  emergencyReport("EmergencyReport", "Emergency report"),
  liveVideo("LiveVideo", "Live video"),
  accountAccess("AccountAccess", "Account / login"),
  location("Location", "GPS / location"),
  policeLocator("PoliceLocator", "Police locator"),
  smartwatch("Smartwatch", "Smartwatch"),
  whistleblowerReward("WhistleblowerReward", "Whistleblower reward"),
  withdrawal("Withdrawal", "Withdrawal"),
  community("Community", "Community"),
  evidenceUpload("EvidenceUpload", "Evidence upload"),
  notification("Notification", "Notifications"),
  safetyConcern("SafetyConcern", "Safety concern"),
  abuseReport("AbuseReport", "Abuse report"),
  technicalIssue("TechnicalIssue", "Technical issue"),
  other("Other", "Other");

  const SupportCategory(this.apiValue, this.label);
  final String apiValue;
  final String label;
}

class SupportConversationSummary {
  SupportConversationSummary({
    required this.id,
    required this.reference,
    required this.subject,
    required this.status,
    required this.category,
    required this.unreadCount,
    this.lastMessagePreview,
    this.lastMessageAt,
  });

  factory SupportConversationSummary.fromJson(Map<String, dynamic> json) {
    return SupportConversationSummary(
      id: json["id"] as String,
      reference: json["reference"] as String? ?? "",
      subject: json["subject"] as String? ?? "Support",
      status: json["status"] as String? ?? "Open",
      category: json["category"] as String? ?? "Other",
      unreadCount: (json["unreadCount"] as num?)?.toInt() ?? 0,
      lastMessagePreview: json["lastMessagePreview"] as String?,
      lastMessageAt: json["lastMessageAt"] as String?,
    );
  }

  final String id;
  final String reference;
  final String subject;
  final String status;
  final String category;
  final int unreadCount;
  final String? lastMessagePreview;
  final String? lastMessageAt;
}

class SupportMessageItem {
  SupportMessageItem({
    required this.id,
    required this.body,
    required this.senderRole,
    required this.senderName,
    required this.createdAt,
    this.messageType = "Text",
    this.hasAttachment = false,
    this.clientMessageId,
    this.deliveryStatus = "Sent",
  });

  factory SupportMessageItem.fromJson(Map<String, dynamic> json) {
    return SupportMessageItem(
      id: json["id"] as String,
      body: json["body"] as String? ?? "",
      senderRole: json["senderRole"] as String? ?? "Citizen",
      senderName: json["senderName"] as String? ?? "Participant",
      createdAt: json["createdAt"] as String? ?? "",
      messageType: json["messageType"] as String? ?? "Text",
      hasAttachment: json["hasAttachment"] as bool? ?? false,
      clientMessageId: json["clientMessageId"] as String?,
      deliveryStatus: json["deliveryStatus"] as String? ?? "Sent",
    );
  }

  final String id;
  final String body;
  final String senderRole;
  final String senderName;
  final String createdAt;
  final String messageType;
  final bool hasAttachment;
  final String? clientMessageId;
  final String deliveryStatus;
}

class SupportConversationDetail {
  SupportConversationDetail({
    required this.id,
    required this.reference,
    required this.subject,
    required this.status,
    required this.category,
    required this.unreadCount,
    required this.messages,
  });

  factory SupportConversationDetail.fromJson(Map<String, dynamic> json) {
    final rawMessages = json["messages"];
    final messages = rawMessages is List
        ? rawMessages
            .map((item) =>
                SupportMessageItem.fromJson(Map<String, dynamic>.from(item as Map)))
            .toList()
        : <SupportMessageItem>[];
    return SupportConversationDetail(
      id: json["id"] as String,
      reference: json["reference"] as String? ?? "",
      subject: json["subject"] as String? ?? "Support",
      status: json["status"] as String? ?? "Open",
      category: json["category"] as String? ?? "Other",
      unreadCount: (json["unreadCount"] as num?)?.toInt() ?? 0,
      messages: messages,
    );
  }

  final String id;
  final String reference;
  final String subject;
  final String status;
  final String category;
  final int unreadCount;
  final List<SupportMessageItem> messages;
}

class SupportNewChatPrefill {
  const SupportNewChatPrefill({
    this.category = SupportCategory.other,
    this.subject,
    this.incidentId,
    this.diagnosticMetadata = const {},
  });

  final SupportCategory category;
  final String? subject;
  final String? incidentId;
  final Map<String, dynamic> diagnosticMetadata;
}

class SupportConversationRouteArgs {
  const SupportConversationRouteArgs({required this.conversationId});
  final String conversationId;
}
