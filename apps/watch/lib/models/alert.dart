class WatchAlert {
  WatchAlert({
    required this.id,
    required this.title,
    required this.body,
    required this.receivedAt,
    this.incidentId,
    this.notificationId,
    this.acknowledged = false,
    this.priority = 'High',
  });

  final String id;
  final String title;
  final String body;
  final DateTime receivedAt;
  final String? incidentId;
  final String? notificationId;
  final bool acknowledged;
  final String priority;

  WatchAlert copyWith({bool? acknowledged}) {
    return WatchAlert(
      id: id,
      title: title,
      body: body,
      receivedAt: receivedAt,
      incidentId: incidentId,
      notificationId: notificationId,
      acknowledged: acknowledged ?? this.acknowledged,
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
      priority: json['priority'] as String? ?? 'High',
    );
  }
}
