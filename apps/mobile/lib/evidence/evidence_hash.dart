import "dart:convert";
import "dart:io";
import "dart:typed_data";

import "package:crypto/crypto.dart";

Future<String> sha256FileHash(String path) async {
  final stream = File(path).openRead();
  final digest = await sha256.bind(stream).first;
  return "sha256:${digest.toString()}";
}

String sha256BytesHash(Uint8List bytes) {
  return "sha256:${sha256.convert(bytes).toString()}";
}
