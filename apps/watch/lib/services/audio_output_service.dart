import 'package:flutter/services.dart';

class AudioOutputService {
  AudioOutputService({MethodChannel? channel})
      : _channel = channel ?? const MethodChannel('com.theeye.watch/audio_output');

  final MethodChannel _channel;

  Future<bool> isHeadphoneConnected() async {
    try {
      final result = await _channel.invokeMethod<bool>('isHeadphoneConnected');
      return result ?? false;
    } catch (_) {
      return false;
    }
  }
}
