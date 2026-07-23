class WatchAlert {
  WatchAlert({
    required this.id,
    required this.title,
    required this.body,
    required this.receivedAt,
    this.incidentId,
    this.notificationId,
    this.acknowledged = false,
    this.read = false,
    this.dismissed = false,
    this.expired = false,
    this.category,
    this.locationLabel,
    this.priority = 'High',
  });

  final String id;
  final String title;
  final String body;
  final DateTime receivedAt;
  final String? incidentId;
  final String? notificationId;
  final bool acknowledged;
  final bool read;
  final bool dismissed;
  final bool expired;
  final String? category;
  final String? locationLabel;
  final String priority;

  WatchAlert copyWith({
    bool? acknowledged,
    bool? read,
    bool? dismissed,
    bool? expired,
  }) {
    return WatchAlert(
      id: id,
      title: title,
      body: body,
      receivedAt: receivedAt,
      incidentId: incidentId,
      notificationId: notificationId,
      acknowledged: acknowledged ?? this.acknowledged,
      read: read ?? this.read,
      dismissed: dismissed ?? this.dismissed,
      expired: expired ?? this.expired,
      category: category,
      locationLabel: locationLabel,
      priority: priority,
    );
  }

  Map<String, dynamic> toStorageJson() => {
        'id': id,
        'title': title,
        'body': body,
        'receivedAt': receivedAt.toUtc().toIso8601String(),
        'incidentId': incidentId,
        'notificationId': notificationId,
        'acknowledged': acknowledged,
        'read': read,
        'dismissed': dismissed,
        'expired': expired,
        'category': category,
        'locationLabel': locationLabel,
        'priority': priority,
      };

  factory WatchAlert.fromStorageJson(Map<String, dynamic> json) {
    return WatchAlert(
      id: json['id'] as String,
      title: json['title'] as String,
      body: json['body'] as String,
      receivedAt: DateTime.parse(json['receivedAt'] as String),
      incidentId: json['incidentId'] as String?,
      notificationId: json['notificationId'] as String?,
      acknowledged: json['acknowledged'] as bool? ?? false,
      read: json['read'] as bool? ?? false,
      dismissed: json['dismissed'] as bool? ?? false,
      expired: json['expired'] as bool? ?? false,
      category: json['category'] as String?,
      locationLabel: json['locationLabel'] as String?,
      priority: json['priority'] as String? ?? 'High',
    );
  }

  factory WatchAlert.fromApiJson(Map<String, dynamic> json) {
    return WatchAlert(
      id: json['id'] as String? ?? json['notificationId'] as String? ?? '',
      title: json['title'] as String? ?? 'THE EYE Alert',
      body: json['body'] as String? ?? '',
      receivedAt: DateTime.tryParse(json['receivedAt'] as String? ?? '') ??
          DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
      incidentId: json['incidentId'] as String?,
      notificationId: json['notificationId'] as String? ?? json['id'] as String?,
      acknowledged: json['acknowledged'] as bool? ?? false,
      read: json['read'] as bool? ?? json['isRead'] as bool? ?? false,
      dismissed: json['dismissed'] as bool? ?? false,
      expired: json['expired'] as bool? ?? false,
      category: json['category'] as String? ?? json['type'] as String?,
      locationLabel: json['locationLabel'] as String?,
      priority: json['priority'] as String? ?? 'High',
    );
  }
}
