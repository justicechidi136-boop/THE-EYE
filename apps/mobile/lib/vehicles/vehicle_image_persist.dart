import "dart:io";
import "dart:typed_data";

import "package:image_picker/image_picker.dart";
import "package:path/path.dart" as p;
import "package:path_provider/path_provider.dart";

/// Persists a picked vehicle photo to app documents.
///
/// Handles Android `content://` / non-file paths by reading bytes
/// (FUNC-010 / FUNC-0XX) instead of assuming a direct filesystem path.
Future<String?> persistPickedVehicleImage(XFile picked) async {
  final documentsDir = await getApplicationDocumentsDirectory();
  final carDir = Directory(p.join(documentsDir.path, "car_profile"));
  if (!await carDir.exists()) {
    await carDir.create(recursive: true);
  }

  final name = picked.name.trim().isNotEmpty
      ? picked.name
      : p.basename(picked.path);
  var extension = p.extension(name);
  if (extension.isEmpty) {
    extension = p.extension(picked.path);
  }
  if (extension.isEmpty) {
    extension = ".jpg";
  }

  final destination = p.join(
    carDir.path,
    "car_photo_${DateTime.now().microsecondsSinceEpoch}$extension",
  );

  final path = picked.path;
  final readableFile = path.isNotEmpty && File(path).existsSync();
  if (readableFile) {
    await File(path).copy(destination);
    return destination;
  }

  Uint8List bytes;
  try {
    bytes = await picked.readAsBytes();
  } catch (_) {
    return null;
  }
  if (bytes.isEmpty) return null;
  await File(destination).writeAsBytes(bytes, flush: true);
  return destination;
}
