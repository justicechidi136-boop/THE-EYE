import "dart:typed_data";

import "package:file_picker/file_picker.dart";
import "package:image_picker/image_picker.dart";

class PickedEvidenceFile {
  const PickedEvidenceFile({
    required this.path,
    required this.fileName,
    this.mimeType,
    this.durationSeconds,
    this.bytes,
  });

  final String path;
  final String fileName;
  final String? mimeType;
  final int? durationSeconds;

  /// In-memory file contents when the platform path is missing or unreliable.
  final Uint8List? bytes;
}

abstract class EvidenceMediaSource {
  Future<PickedEvidenceFile?> takePhoto();
  Future<PickedEvidenceFile?> pickImage();
  Future<PickedEvidenceFile?> recordVideo(
      {Duration maxDuration = const Duration(seconds: 120)});
  Future<PickedEvidenceFile?> pickVideo();
  Future<PickedEvidenceFile?> pickAudio();
}

class ImagePickerEvidenceSource implements EvidenceMediaSource {
  ImagePickerEvidenceSource({ImagePicker? picker})
      : _picker = picker ?? ImagePicker();

  final ImagePicker _picker;

  @override
  Future<PickedEvidenceFile?> takePhoto() async {
    final file =
        await _picker.pickImage(source: ImageSource.camera, imageQuality: 100);
    return _mapXFile(file);
  }

  @override
  Future<PickedEvidenceFile?> pickImage() async {
    final file =
        await _picker.pickImage(source: ImageSource.gallery, imageQuality: 100);
    return _mapXFile(file);
  }

  @override
  Future<PickedEvidenceFile?> recordVideo(
      {Duration maxDuration = const Duration(seconds: 120)}) async {
    final file = await _picker.pickVideo(
      source: ImageSource.camera,
      maxDuration: maxDuration,
    );
    return _mapXFile(file);
  }

  @override
  Future<PickedEvidenceFile?> pickVideo() async {
    final file = await _picker.pickVideo(
        source: ImageSource.gallery, maxDuration: const Duration(seconds: 120));
    return _mapXFile(file);
  }

  @override
  Future<PickedEvidenceFile?> pickAudio() async {
    final result = await FilePicker.platform.pickFiles(
      type: FileType.custom,
      allowedExtensions: const ["mp3", "mpeg", "m4a", "mp4", "webm"],
      withReadStream: false,
      withData: true,
    );
    if (result == null || result.files.isEmpty) return null;
    final picked = result.files.single;
    final path = picked.path ?? "";
    final bytes = picked.bytes;
    if (path.isEmpty && (bytes == null || bytes.isEmpty)) return null;
    return PickedEvidenceFile(
      path: path,
      fileName: picked.name,
      mimeType: picked.extension == null
          ? null
          : _audioMimeForExtension(picked.extension!),
      bytes: bytes == null ? null : Uint8List.fromList(bytes),
    );
  }

  Future<PickedEvidenceFile?> _mapXFile(XFile? file) async {
    if (file == null) return null;
    Uint8List? bytes;
    try {
      bytes = await file.readAsBytes();
    } catch (_) {
      // Gallery picks may not expose a readable path; bytes are preferred.
    }
    return PickedEvidenceFile(
      path: file.path,
      fileName: file.name,
      mimeType: file.mimeType,
      bytes: bytes,
    );
  }

  String _audioMimeForExtension(String extension) {
    return switch (extension.toLowerCase()) {
      "mp3" || "mpeg" => "audio/mpeg",
      "m4a" => "audio/mp4",
      "webm" => "audio/webm",
      "mp4" => "audio/mp4",
      _ => "audio/mpeg",
    };
  }
}

class FakeEvidenceMediaSource implements EvidenceMediaSource {
  PickedEvidenceFile? nextPhoto;
  PickedEvidenceFile? nextImage;
  PickedEvidenceFile? nextVideo;
  PickedEvidenceFile? nextRecordedVideo;
  PickedEvidenceFile? nextAudio;

  @override
  Future<PickedEvidenceFile?> takePhoto() async => nextPhoto;

  @override
  Future<PickedEvidenceFile?> pickImage() async => nextImage;

  @override
  Future<PickedEvidenceFile?> recordVideo(
          {Duration maxDuration = const Duration(seconds: 120)}) async =>
      nextRecordedVideo;

  @override
  Future<PickedEvidenceFile?> pickVideo() async => nextVideo;

  @override
  Future<PickedEvidenceFile?> pickAudio() async => nextAudio;
}
