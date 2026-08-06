import 'dart:convert';

import 'package:cryptography/cryptography.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';

/// Ed25519 device identity for field tablet challenge signing.
class DeviceKeystoreService {
  DeviceKeystoreService({
    FlutterSecureStorage? secureStorage,
    Ed25519? algorithm,
    Map<String, String>? memory,
  })  : _secure = secureStorage ?? const FlutterSecureStorage(),
        _algorithm = algorithm ?? Ed25519(),
        _memory = memory;

  static const _privateKeyKey = 'field.device_private_key';
  static const _publicKeyKey = 'field.device_public_key';

  final FlutterSecureStorage _secure;
  final Ed25519 _algorithm;
  final Map<String, String>? _memory;

  Future<void> ensureKeyPair() async {
    final existing = await readPublicKeyBase64();
    if (existing != null && existing.isNotEmpty) return;
    await generateKeyPair();
  }

  Future<void> generateKeyPair() async {
    final keyPair = await _algorithm.newKeyPair();
    final publicKey = await keyPair.extractPublicKey();
    final privateKeyBytes = await keyPair.extractPrivateKeyBytes();
    await _write(_privateKeyKey, base64Encode(privateKeyBytes));
    await _write(_publicKeyKey, base64Encode(publicKey.bytes));
  }

  Future<String?> readPublicKeyBase64() => _read(_publicKeyKey);

  Future<SimpleKeyPair> loadKeyPair() async {
    final privateKeyRaw = await _read(_privateKeyKey);
    if (privateKeyRaw == null || privateKeyRaw.isEmpty) {
      throw StateError('Device key pair is not initialized');
    }
    final seed = base64Decode(privateKeyRaw);
    return _algorithm.newKeyPairFromSeed(seed);
  }

  Future<String> signChallenge(String challenge) async {
    final keyPair = await loadKeyPair();
    final signature = await _algorithm.sign(
      utf8.encode(challenge),
      keyPair: keyPair,
    );
    return base64Encode(signature.bytes);
  }

  Future<void> wipe() async {
    await _delete(_privateKeyKey);
    await _delete(_publicKeyKey);
  }

  Future<String?> _read(String key) async {
    if (_memory != null) return _memory[key];
    return _secure.read(key: key);
  }

  Future<void> _write(String key, String value) async {
    if (_memory != null) {
      _memory[key] = value;
      return;
    }
    await _secure.write(key: key, value: value);
  }

  Future<void> _delete(String key) async {
    if (_memory != null) {
      _memory.remove(key);
      return;
    }
    await _secure.delete(key: key);
  }
}
