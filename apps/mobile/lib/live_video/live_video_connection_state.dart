enum LiveVideoConnectionState {
  idle,
  previewing,
  connecting,
  connected,
  reconnecting,
  disconnected,
  failed,
}

String liveVideoConnectionLabel(LiveVideoConnectionState state) {
  switch (state) {
    case LiveVideoConnectionState.idle:
      return "Ready";
    case LiveVideoConnectionState.previewing:
      return "Camera preview";
    case LiveVideoConnectionState.connecting:
      return "Connecting";
    case LiveVideoConnectionState.connected:
      return "Connected";
    case LiveVideoConnectionState.reconnecting:
      return "Reconnecting";
    case LiveVideoConnectionState.disconnected:
      return "Disconnected";
    case LiveVideoConnectionState.failed:
      return "Connection failed";
  }
}
