import 'dart:async';
import 'dart:math';

import '../api/watch_api_client.dart';
import '../api/watch_api_paths.dart';
import '../config/watch_flavor.dart';
import '../models/pairing_state.dart';
import '../storage/secure_credential_store.dart';
import 'companion_protocol.dart';

class PairingService {
  PairingService({
    required WatchApiClient api,
    required SecureCredentialStore credentials,
    required PreferencesStore preferences,
    CompanionProtocol? companion,
  })  : _api = api,
        _credentials = credentials,
        _preferences = preferences,
        _companion = companion ?? StubCompanionProtocol();

  final WatchApiClient _api;
  final SecureCredentialStore _credentials;
  final PreferencesStore _preferences;
  final CompanionProtocol _companion;
  final _random = Random.secure();

  PairingState _state = const PairingState(phase: PairingPhase.unpaired);
  Timer? _pollTimer;

  PairingState get state => _state;

  Future<void> initialize() async {
    final paired = await _preferences.isPaired();
    final deviceId = await _credentials.readDeviceId();
    final deviceSecret = await _credentials.readDeviceSecret();
    if (paired && deviceId != null && deviceSecret != null) {
      _state = PairingState(
        phase: PairingPhase.paired,
        pairedAt: DateTime.now(),
      );
      return;
    }
    _state = const PairingState(phase: PairingPhase.unpaired);
  }

  Future<PairingState> beginPairing() async {
    final code = _generatePairingCode();
    final deviceId = await _ensureDeviceId();
    await _preferences.savePairingCode(code);
    _state = PairingState(
      phase: PairingPhase.awaitingCode,
      pairingCode: code,
    );

    await _api.post(
      WatchApiPaths.issuePairingCode,
      body: {
        'deviceId': deviceId,
        'pairingCode': code,
        'firebaseEnv': WatchFlavor.envName,
      },
    );

    if (await _companion.isPhoneReachable()) {
      _state = _state.transition(PairingPhase.awaitingPhoneConfirmation);
      await _companion.sendPairingRequest(
          deviceId: deviceId, pairingCode: code);
      final confirmation = await _companion.awaitPairingConfirmation();
      if (confirmation != null) {
        return completePairing(
          deviceSecret: confirmation['deviceSecret'] as String? ?? '',
        );
      }
    }

    _state = _state.transition(PairingPhase.awaitingPhoneConfirmation);
    _startPairingPoll(deviceId);
    return _state;
  }

  Future<PairingState> completePairing({required String deviceSecret}) async {
    if (deviceSecret.isEmpty) {
      _state = _state.transition(
        PairingPhase.failed,
        errorMessage: 'Device secret missing from pairing response',
      );
      return _state;
    }

    final deviceId = await _ensureDeviceId();
    await _credentials.saveDeviceCredentials(
      deviceId: deviceId,
      deviceSecret: deviceSecret,
    );
    await _preferences.setPaired(true);
    await _preferences.savePairingCode(null);
    _stopPairingPoll();
    _state = PairingState(
      phase: PairingPhase.paired,
      pairedAt: DateTime.now(),
    );
    return _state;
  }

  Future<PairingState> markFailed(String message) async {
    _stopPairingPoll();
    _state = _state.transition(PairingPhase.failed, errorMessage: message);
    return _state;
  }

  Future<void> unpair() async {
    _stopPairingPoll();
    try {
      final accessToken = await _credentials.readAccessToken();
      final deviceId = await _credentials.readDeviceId();
      if (accessToken != null && deviceId != null) {
        _api.accessToken = accessToken;
        await _api.patch(
          WatchApiPaths.pushTokensDeactivateAll,
          body: {'deviceId': deviceId},
        );
      }
    } catch (_) {
      // Best-effort server revoke before local wipe.
    }
    await _credentials.wipe();
    await _preferences.setPaired(false);
    await _preferences.savePairingCode(null);
    _state = const PairingState(phase: PairingPhase.unpaired);
  }

  void dispose() => _stopPairingPoll();

  void _startPairingPoll(String deviceId) {
    _stopPairingPoll();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) async {
      try {
        final response = await _api.get(WatchApiPaths.pairingStatus(deviceId));
        final data = response['data'] as Map<String, dynamic>? ?? response;
        final status = data['status']?.toString();
        if (status == 'paired') {
          final secret = data['deviceSecret']?.toString() ?? '';
          if (secret.isNotEmpty) {
            await completePairing(deviceSecret: secret);
          }
        } else if (status == 'expired') {
          await markFailed('Pairing code expired. Generate a new code.');
        }
      } catch (_) {
        // Keep polling until timeout or explicit failure.
      }
    });
  }

  void _stopPairingPoll() {
    _pollTimer?.cancel();
    _pollTimer = null;
  }

  Future<String> _ensureDeviceId() async {
    final existing = await _credentials.readDeviceId();
    if (existing != null && existing.isNotEmpty) return existing;
    final generated =
        'watch-${DateTime.now().millisecondsSinceEpoch}-${_random.nextInt(99999)}';
    final secret = await _credentials.readDeviceSecret() ?? '';
    await _credentials.saveDeviceCredentials(
      deviceId: generated,
      deviceSecret: secret,
    );
    return generated;
  }

  String _generatePairingCode() {
    return List.generate(6, (_) => _random.nextInt(10)).join();
  }
}
