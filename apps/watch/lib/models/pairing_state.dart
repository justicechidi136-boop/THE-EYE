enum PairingPhase {
  unpaired,
  awaitingCode,
  awaitingPhoneConfirmation,
  paired,
  failed,
}

class PairingState {
  const PairingState({
    required this.phase,
    this.pairingCode,
    this.errorMessage,
    this.pairedAt,
  });

  final PairingPhase phase;
  final String? pairingCode;
  final String? errorMessage;
  final DateTime? pairedAt;

  bool get isPaired => phase == PairingPhase.paired;

  PairingState copyWith({
    PairingPhase? phase,
    String? pairingCode,
    String? errorMessage,
    DateTime? pairedAt,
  }) {
    return PairingState(
      phase: phase ?? this.phase,
      pairingCode: pairingCode ?? this.pairingCode,
      errorMessage: errorMessage,
      pairedAt: pairedAt ?? this.pairedAt,
    );
  }

  PairingState transition(PairingPhase next, {String? errorMessage}) {
    return copyWith(
      phase: next,
      errorMessage: errorMessage,
      pairedAt: next == PairingPhase.paired ? DateTime.now() : pairedAt,
    );
  }
}
