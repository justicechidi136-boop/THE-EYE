/// Interface for phone companion pairing protocol (Bluetooth / Data Layer stub).
abstract class CompanionProtocol {
  Future<bool> isPhoneReachable();

  Future<void> sendPairingRequest({
    required String deviceId,
    required String pairingCode,
  });

  Future<Map<String, dynamic>?> awaitPairingConfirmation({
    Duration timeout = const Duration(minutes: 2),
  });
}

class StubCompanionProtocol implements CompanionProtocol {
  @override
  Future<bool> isPhoneReachable() async => false;

  @override
  Future<void> sendPairingRequest({
    required String deviceId,
    required String pairingCode,
  }) async {}

  @override
  Future<Map<String, dynamic>?> awaitPairingConfirmation({
    Duration timeout = const Duration(minutes: 2),
  }) async =>
      null;
}
