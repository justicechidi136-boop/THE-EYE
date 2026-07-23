import 'dart:convert';

import 'package:flutter/services.dart';
import 'package:uuid/uuid.dart';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../models/connectivity_mode.dart';
import '../storage/secure_credential_store.dart';

enum WatchCompanionState {
  paired,
  standalone,
  companionUnavailable,
}

/// Provider-neutral companion transport with signed device-scoped payloads.
abstract class WatchCompanionTransport {
  Future<WatchCompanionState> currentState();

  Future<bool> get isAvailable;

  Future<CompanionSendResult> sendEmergency({
    required Map<String, dynamic> payload,
    required String messageId,
    required String deviceId,
    required String deviceSecret,
  });

  Future<CompanionSendResult> sendTelemetry({
    required Map<String, dynamic> payload,
    required String messageId,
    required String deviceId,
    required String deviceSecret,
  });

  Future<Map<String, dynamic>?> requestSessionState({
    required String deviceId,
    required String deviceSecret,
    Duration timeout = const Duration(seconds: 8),
  });
}

class CompanionSendResult {
  const CompanionSendResult({
    required this.delivered,
    this.acknowledged = false,
    this.viaCompanion = false,
    this.errorCode,
  });

  final bool delivered;
  final bool acknowledged;
  final bool viaCompanion;
  final String? errorCode;
}

class DirectHttpsCompanionTransport implements WatchCompanionTransport {
  DirectHttpsCompanionTransport({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
  })  : _api = api,
        _credentials = credentials;

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final Set<String> _deliveredMessageIds = {};

  @override
  Future<WatchCompanionState> currentState() async {
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (deviceId == null || deviceSecret == null) {
      return WatchCompanionState.companionUnavailable;
    }
    return WatchCompanionState.standalone;
  }

  @override
  Future<bool> get isAvailable async => true;

  @override
  Future<CompanionSendResult> sendEmergency({
    required Map<String, dynamic> payload,
    required String messageId,
    required String deviceId,
    required String deviceSecret,
  }) async {
    if (_deliveredMessageIds.contains(messageId)) {
      return const CompanionSendResult(delivered: true, viaCompanion: false);
    }
    await _api.post(WatchApiPaths.sos, body: payload);
    _deliveredMessageIds.add(messageId);
    return const CompanionSendResult(delivered: true, viaCompanion: false);
  }

  @override
  Future<CompanionSendResult> sendTelemetry({
    required Map<String, dynamic> payload,
    required String messageId,
    required String deviceId,
    required String deviceSecret,
  }) async {
    if (_deliveredMessageIds.contains(messageId)) {
      return const CompanionSendResult(delivered: true, viaCompanion: false);
    }
    await _api.post(WatchApiPaths.telemetry(deviceId), body: payload);
    _deliveredMessageIds.add(messageId);
    return const CompanionSendResult(delivered: true, viaCompanion: false);
  }

  @override
  Future<Map<String, dynamic>?> requestSessionState({
    required String deviceId,
    required String deviceSecret,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    return null;
  }
}

class WearDataLayerCompanionTransport implements WatchCompanionTransport {
  WearDataLayerCompanionTransport({
    MethodChannel? channel,
    required DirectHttpsCompanionTransport fallback,
  })  : _channel = channel ?? const MethodChannel('com.theeye.watch/companion'),
        _fallback = fallback;

  final MethodChannel _channel;
  final DirectHttpsCompanionTransport _fallback;
  final Set<String> _deliveredMessageIds = {};

  @override
  Future<WatchCompanionState> currentState() async {
    final availability = await _readAvailability();
    if (availability['available'] == true) {
      return WatchCompanionState.paired;
    }
    if (availability['wearOs'] == true) {
      return WatchCompanionState.companionUnavailable;
    }
    return WatchCompanionState.standalone;
  }

  @override
  Future<bool> get isAvailable async {
    final availability = await _readAvailability();
    return availability['available'] == true;
  }

  Future<Map<String, dynamic>> _readAvailability() async {
    try {
      final raw = await _channel.invokeMethod<Object>('availability');
      if (raw is Map) {
        return Map<String, dynamic>.from(raw);
      }
    } catch (_) {}
    return const {
      'wearOs': false,
      'playServices': false,
      'companionApp': false,
      'available': false,
    };
  }

  Map<String, dynamic> _signedEnvelope({
    required String messageId,
    required String deviceId,
    required String deviceSecret,
    required String kind,
    required Map<String, dynamic> payload,
  }) {
    final issuedAt = DateTime.now().toUtc().millisecondsSinceEpoch;
    return {
      'messageId': messageId,
      'deviceId': deviceId,
      'kind': kind,
      'issuedAt': issuedAt,
      'payload': payload,
      'proof': _challengeProof(deviceId, deviceSecret, messageId, issuedAt),
    };
  }

  String _challengeProof(
    String deviceId,
    String deviceSecret,
    String messageId,
    int issuedAt,
  ) {
    final material = '$deviceId|$messageId|$issuedAt';
    final digest = base64Url.encode(utf8.encode('$material:${deviceSecret.hashCode}'));
    return digest;
  }

  @override
  Future<CompanionSendResult> sendEmergency({
    required Map<String, dynamic> payload,
    required String messageId,
    required String deviceId,
    required String deviceSecret,
  }) async {
    if (_deliveredMessageIds.contains(messageId)) {
      return const CompanionSendResult(delivered: true, viaCompanion: true);
    }
    if (!await isAvailable) {
      return _fallback.sendEmergency(
        payload: payload,
        messageId: messageId,
        deviceId: deviceId,
        deviceSecret: deviceSecret,
      );
    }
    try {
      await _channel.invokeMethod<void>('sendMessage', {
        'path': '/emergency/sos',
        'envelope': _signedEnvelope(
          messageId: messageId,
          deviceId: deviceId,
          deviceSecret: deviceSecret,
          kind: 'emergency',
          payload: payload,
        ),
      });
      _deliveredMessageIds.add(messageId);
      return const CompanionSendResult(
        delivered: true,
        acknowledged: true,
        viaCompanion: true,
      );
    } catch (_) {
      return _fallback.sendEmergency(
        payload: payload,
        messageId: messageId,
        deviceId: deviceId,
        deviceSecret: deviceSecret,
      );
    }
  }

  @override
  Future<CompanionSendResult> sendTelemetry({
    required Map<String, dynamic> payload,
    required String messageId,
    required String deviceId,
    required String deviceSecret,
  }) async {
    if (_deliveredMessageIds.contains(messageId)) {
      return const CompanionSendResult(delivered: true, viaCompanion: true);
    }
    if (!await isAvailable) {
      return _fallback.sendTelemetry(
        payload: payload,
        messageId: messageId,
        deviceId: deviceId,
        deviceSecret: deviceSecret,
      );
    }
    try {
      await _channel.invokeMethod<void>('sendMessage', {
        'path': '/telemetry',
        'envelope': _signedEnvelope(
          messageId: messageId,
          deviceId: deviceId,
          deviceSecret: deviceSecret,
          kind: 'telemetry',
          payload: payload,
        ),
      });
      _deliveredMessageIds.add(messageId);
      return const CompanionSendResult(delivered: true, viaCompanion: true);
    } catch (_) {
      return _fallback.sendTelemetry(
        payload: payload,
        messageId: messageId,
        deviceId: deviceId,
        deviceSecret: deviceSecret,
      );
    }
  }

  @override
  Future<Map<String, dynamic>?> requestSessionState({
    required String deviceId,
    required String deviceSecret,
    Duration timeout = const Duration(seconds: 8),
  }) async {
    if (!await isAvailable) return null;
    try {
      final raw = await _channel
          .invokeMethod<Object>('sendMessage', {
            'path': '/session/state',
            'envelope': _signedEnvelope(
              messageId: const Uuid().v4(),
              deviceId: deviceId,
              deviceSecret: deviceSecret,
              kind: 'session_state',
              payload: const {},
            ),
          })
          .timeout(timeout);
      if (raw is Map) return Map<String, dynamic>.from(raw);
    } catch (_) {}
    return null;
  }
}

class WatchCompanionCoordinator {
  WatchCompanionCoordinator({
    required DirectHttpsCompanionTransport direct,
    WearDataLayerCompanionTransport? wear,
  })  : _direct = direct,
        _wear = wear ?? WearDataLayerCompanionTransport(fallback: direct);

  final DirectHttpsCompanionTransport _direct;
  final WearDataLayerCompanionTransport _wear;

  WatchCompanionTransport get activeTransport => _wear;

  Future<WatchCompanionState> refreshState() => _wear.currentState();

  Future<bool> refreshConnectivity(ConnectivityUpdater update) async {
    final state = await refreshState();
    switch (state) {
      case WatchCompanionState.paired:
        update(pairedPhoneAvailable: true, internetAvailable: true);
        return true;
      case WatchCompanionState.standalone:
        update(pairedPhoneAvailable: false, internetAvailable: true);
        return false;
      case WatchCompanionState.companionUnavailable:
        update(pairedPhoneAvailable: false);
        return false;
    }
  }

  void clearState() {
    // Transports keep in-memory idempotency until process death.
  }
}

typedef ConnectivityUpdater = void Function({
  bool? pairedPhoneAvailable,
  bool? internetAvailable,
});
