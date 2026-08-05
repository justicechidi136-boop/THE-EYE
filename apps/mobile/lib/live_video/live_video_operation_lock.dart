import "dart:async";

/// Serializes async start/stop operations so they cannot overlap.
class LiveVideoOperationLock {
  Future<void> _tail = Future<void>.value();

  Future<T> run<T>(Future<T> Function() operation) {
    final completer = Completer<T>();
    _tail = _tail.then((_) async {
      try {
        completer.complete(await operation());
      } catch (error, stackTrace) {
        completer.completeError(error, stackTrace);
      }
    });
    _tail = _tail.catchError((_) {});
    return completer.future;
  }

  Future<void> get settled => _tail;
}
