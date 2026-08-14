import "package:flutter/foundation.dart";

import "../contracts/the_eye_enums.dart";
import "evidence_capture_service.dart";
import "evidence_media_source.dart";
import "evidence_permission_service.dart";
import "evidence_permission_state.dart";
import "evidence_policy.dart";
import "local_evidence_attachment.dart";

typedef EvidenceRationalePresenter = Future<bool> Function({
  required String title,
  required String message,
  required bool showSettingsLink,
});

class EvidenceCaptureController extends ChangeNotifier {
  EvidenceCaptureController({
    required EvidenceCaptureService captureService,
    required EvidenceMediaSource mediaSource,
    required EvidencePermissionService permissionService,
    this.policy = EvidencePolicy.incident,
    this.rationalePresenter,
    this.lowDataMode = false,
    this.latitude,
    this.longitude,
  })  : _captureService = captureService,
        _mediaSource = mediaSource,
        _permissionService = permissionService;

  final EvidenceCaptureService _captureService;
  final EvidenceMediaSource _mediaSource;
  final EvidencePermissionService _permissionService;
  final EvidencePolicy policy;
  final EvidenceRationalePresenter? rationalePresenter;
  bool lowDataMode;
  double? latitude;
  double? longitude;

  final List<LocalEvidenceAttachment> attachments = [];
  bool busy = false;
  String? lastError;

  bool get canAddMore => attachments.length < policy.maxFiles;
  bool canAddMoreFor(String mediaType) =>
      policy.canAddMediaType(attachments, mediaType);

  Future<void> takePhoto() => _capture(
        mediaType: IncidentMediaType.image,
        needsCamera: true,
        action: _mediaSource.takePhoto,
      );

  Future<void> pickImage() => _capture(
        mediaType: IncidentMediaType.image,
        needsPhotos: true,
        action: _mediaSource.pickImage,
      );

  Future<void> pickImages() => _captureMany(
        mediaType: IncidentMediaType.image,
        needsPhotos: true,
        action: _mediaSource.pickImages,
      );

  Future<void> recordVideo() => _capture(
        mediaType: IncidentMediaType.video,
        needsCamera: true,
        needsMicrophone: true,
        action: () => _mediaSource.recordVideo(),
      );

  Future<void> pickVideo() => _capture(
        mediaType: IncidentMediaType.video,
        needsPhotos: true,
        action: _mediaSource.pickVideo,
      );

  Future<void> pickVideos() => _captureMany(
        mediaType: IncidentMediaType.video,
        needsPhotos: true,
        action: _mediaSource.pickVideos,
      );

  Future<void> pickAudio() => _captureMany(
        mediaType: IncidentMediaType.audio,
        needsPhotos: true,
        action: _mediaSource.pickAudioFiles,
      );

  void remove(String localId) {
    attachments.removeWhere((item) => item.localId == localId);
    notifyListeners();
  }

  void addVoiceAttachment(LocalEvidenceAttachment attachment) {
    final message = policy.limitMessageForAttachment(
      existing: attachments,
      incoming: attachment,
    );
    if (message != null) {
      lastError = message;
      notifyListeners();
      return;
    }
    attachments.add(attachment);
    lastError = null;
    notifyListeners();
  }

  Future<void> retake(
      String localId, Future<void> Function() captureAction) async {
    remove(localId);
    await captureAction();
  }

  Future<void> retryFailedUpload(String localId) async {
    final index = attachments.indexWhere((item) => item.localId == localId);
    if (index < 0) return;
    attachments[index] = attachments[index].copyWith(
      state: LocalEvidenceState.captured,
      uploadProgress: 0,
      errorMessage: null,
    );
    notifyListeners();
  }

  void markUploading(String localId, double progress) {
    final index = attachments.indexWhere((item) => item.localId == localId);
    if (index < 0) return;
    attachments[index] = attachments[index].copyWith(
      state: LocalEvidenceState.uploading,
      uploadProgress: progress,
      errorMessage: null,
    );
    notifyListeners();
  }

  void markUploaded(String localId) {
    final index = attachments.indexWhere((item) => item.localId == localId);
    if (index < 0) return;
    attachments[index] = attachments[index].copyWith(
      state: LocalEvidenceState.uploaded,
      uploadProgress: 1,
      errorMessage: null,
    );
    notifyListeners();
  }

  void markUploadFailed(String localId, String message) {
    final index = attachments.indexWhere((item) => item.localId == localId);
    if (index < 0) return;
    attachments[index] = attachments[index].copyWith(
      state: LocalEvidenceState.failed,
      errorMessage: message,
    );
    notifyListeners();
  }

  Future<void> _capture({
    required String mediaType,
    required Future<PickedEvidenceFile?> Function() action,
    bool needsCamera = false,
    bool needsMicrophone = false,
    bool needsPhotos = false,
  }) async {
    final limitMessage = policy.limitMessageForCapture(
      attachments: attachments,
      mediaType: mediaType,
    );
    if (limitMessage != null) {
      lastError = limitMessage;
      notifyListeners();
      return;
    }

    final allowed = await _ensurePermissions(
      needsCamera: needsCamera,
      needsMicrophone: needsMicrophone,
      needsPhotos: needsPhotos,
    );
    if (!allowed) return;

    busy = true;
    lastError = null;
    notifyListeners();

    final picked = await action();
    if (picked == null) {
      busy = false;
      notifyListeners();
      return;
    }

    final result = await _captureService.ingestPickedFile(
      picked: picked,
      mediaType: mediaType,
      lowDataMode: lowDataMode,
      latitude: latitude,
      longitude: longitude,
    );

    busy = false;
    if (result.cancelled) {
      notifyListeners();
      return;
    }
    if (!result.isSuccess) {
      lastError = result.errorMessage;
      notifyListeners();
      return;
    }

    final attachment = result.attachment!;
    final attachmentLimitMessage = policy.limitMessageForAttachment(
      existing: attachments,
      incoming: attachment,
    );
    if (attachmentLimitMessage != null) {
      lastError = attachmentLimitMessage;
      notifyListeners();
      return;
    }
    attachments.add(attachment);
    notifyListeners();
  }

  Future<void> _captureMany({
    required String mediaType,
    required Future<List<PickedEvidenceFile>> Function() action,
    bool needsCamera = false,
    bool needsMicrophone = false,
    bool needsPhotos = false,
  }) async {
    final limitMessage = policy.limitMessageForCapture(
      attachments: attachments,
      mediaType: mediaType,
    );
    if (limitMessage != null) {
      lastError = limitMessage;
      notifyListeners();
      return;
    }

    final allowed = await _ensurePermissions(
      needsCamera: needsCamera,
      needsMicrophone: needsMicrophone,
      needsPhotos: needsPhotos,
    );
    if (!allowed) return;

    busy = true;
    lastError = null;
    notifyListeners();

    final pickedFiles = await action();
    if (pickedFiles.isEmpty) {
      busy = false;
      notifyListeners();
      return;
    }

    final accepted = <LocalEvidenceAttachment>[];
    final skippedMessages = <String>[];

    for (final picked in pickedFiles) {
      final current = [...attachments, ...accepted];
      final captureLimit = policy.limitMessageForCapture(
        attachments: current,
        mediaType: mediaType,
      );
      if (captureLimit != null) {
        skippedMessages.add(captureLimit);
        continue;
      }

      final result = await _captureService.ingestPickedFile(
        picked: picked,
        mediaType: mediaType,
        lowDataMode: lowDataMode,
        latitude: latitude,
        longitude: longitude,
      );
      if (result.cancelled) continue;
      if (!result.isSuccess) {
        skippedMessages.add(
          result.errorMessage ?? "Unable to prepare evidence file.",
        );
        continue;
      }

      final attachment = result.attachment!;
      final attachmentLimitMessage = policy.limitMessageForAttachment(
        existing: current,
        incoming: attachment,
      );
      if (attachmentLimitMessage != null) {
        skippedMessages.add(attachmentLimitMessage);
        continue;
      }
      accepted.add(attachment);
    }

    busy = false;
    if (accepted.isNotEmpty) {
      attachments.addAll(accepted);
    }
    lastError = _batchResultMessage(
      acceptedCount: accepted.length,
      skippedMessages: skippedMessages,
    );
    notifyListeners();
  }

  String? _batchResultMessage({
    required int acceptedCount,
    required List<String> skippedMessages,
  }) {
    if (skippedMessages.isEmpty) return null;
    final firstMessage = skippedMessages.first;
    final skippedCount = skippedMessages.length;
    if (acceptedCount == 0) {
      return "No files added. $firstMessage";
    }
    final addedLabel = acceptedCount == 1 ? "file" : "files";
    final skippedLabel = skippedCount == 1 ? "file" : "files";
    return "$acceptedCount $addedLabel added. "
        "$skippedCount $skippedLabel skipped. $firstMessage";
  }

  Future<bool> _ensurePermissions({
    bool needsCamera = false,
    bool needsMicrophone = false,
    bool needsPhotos = false,
  }) async {
    final checks = <Future<EvidencePermissionState>>[];
    if (needsCamera) checks.add(_permissionService.cameraState());
    if (needsMicrophone) checks.add(_permissionService.microphoneState());
    if (needsPhotos) checks.add(_permissionService.photosState());
    final states = await Future.wait(checks);

    if (states.every((state) => state.canCapture)) {
      if (needsCamera) await _permissionService.requestCamera();
      if (needsMicrophone) await _permissionService.requestMicrophone();
      if (needsPhotos) await _permissionService.requestPhotos();
      return true;
    }

    final needsRationale = states.any((state) =>
        state == EvidencePermissionState.notRequested ||
        state == EvidencePermissionState.denied);
    final showSettings = states.any((state) => state.shouldShowSettingsLink);

    if (needsRationale && rationalePresenter != null) {
      final proceed = await rationalePresenter!(
        title: "Allow evidence capture",
        message: evidencePermissionRationale,
        showSettingsLink: showSettings,
      );
      if (!proceed) {
        lastError =
            "Camera or media permission is required to attach evidence.";
        notifyListeners();
        return false;
      }
    } else if (showSettings) {
      lastError = "Enable camera and media permissions in device settings.";
      notifyListeners();
      return false;
    }

    if (needsCamera) {
      final state = await _permissionService.requestCamera();
      if (!state.canCapture) {
        lastError = state.shouldShowSettingsLink
            ? "Camera permission is blocked. Open device settings to continue."
            : "Camera permission is required to attach evidence.";
        notifyListeners();
        return false;
      }
    }
    if (needsMicrophone) {
      final state = await _permissionService.requestMicrophone();
      if (!state.canCapture) {
        lastError =
            "Microphone permission is required to record video evidence.";
        notifyListeners();
        return false;
      }
    }
    if (needsPhotos) {
      final state = await _permissionService.requestPhotos();
      if (!state.canCapture) {
        lastError = state.shouldShowSettingsLink
            ? "Photo library permission is blocked. Open device settings to continue."
            : "Photo library permission is required to attach evidence.";
        notifyListeners();
        return false;
      }
    }
    return true;
  }
}
