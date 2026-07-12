enum OfflineEventType {
  gps('GPS'),
  sos('SOS'),
  heartbeat('Heartbeat'),
  incidentAcknowledgement('IncidentAcknowledgement');

  const OfflineEventType(this.apiValue);
  final String apiValue;
}

class OfflineEvent {
  OfflineEvent({
    required this.id,
    required this.type,
    required this.payload,
    required this.occurredAt,
    this.idempotencyKey,
    this.uploaded = false,
  });

  final String id;
  final OfflineEventType type;
  final Map<String, dynamic> payload;
  final DateTime occurredAt;
  final String? idempotencyKey;
  final bool uploaded;

  Map<String, dynamic> toSyncJson() => {
        'eventType': type.apiValue,
        'occurredAt': occurredAt.toUtc().toIso8601String(),
        'payload': payload,
      };

  Map<String, dynamic> toStorageJson() => {
        'id': id,
        'type': type.apiValue,
        'payload': payload,
        'occurredAt': occurredAt.toUtc().toIso8601String(),
        'idempotencyKey': idempotencyKey,
        'uploaded': uploaded,
      };

  factory OfflineEvent.fromStorageJson(Map<String, dynamic> json) {
    return OfflineEvent(
      id: json['id'] as String,
      type: OfflineEventType.values.firstWhere(
        (value) => value.apiValue == json['type'],
        orElse: () => OfflineEventType.sos,
      ),
      payload: Map<String, dynamic>.from(json['payload'] as Map),
      occurredAt: DateTime.parse(json['occurredAt'] as String),
      idempotencyKey: json['idempotencyKey'] as String?,
      uploaded: json['uploaded'] as bool? ?? false,
    );
  }
}
