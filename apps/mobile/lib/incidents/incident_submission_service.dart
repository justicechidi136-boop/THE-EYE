import "dart:async";
import "dart:convert";
import "dart:io";

import "package:http/http.dart" as http;

import "dart:io";

import "../evidence/evidence_capture_service.dart";
import "../evidence/evidence_upload_service.dart";
import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../contracts/the_eye_payloads.dart";
import "incident_draft.dart";
import "incident_submission_result.dart";
import "incident_submission_validator.dart";
import "pending_submission_store.dart";

class IncidentReportResponse {
  const IncidentReportResponse({
    required this.id,
    required this.status,
    required this.submittedAt,
    this.priority,
  });

  final String id;
  final String status;
  final DateTime submittedAt;
  final String? priority;

  factory IncidentReportResponse.fromJson(Map<String, dynamic> json) {
    return IncidentReportResponse(
      id: json["id"] as String,
      status: json["status"] as String? ?? "Submitted",
      submittedAt: DateTime.parse((json["submittedAt"] as String?) ??
          DateTime.now().toUtc().toIso8601String()),
      priority: json["priority"] as String?,
    );
  }
}

class IncidentSubmissionService {
  IncidentSubmissionService({
    required TheEyeApiClient apiClient,
    required PendingSubmissionStore pendingStore,
    IncidentSubmissionValidator? validator,
    EvidenceUploadService? evidenceUploadService,
    EvidenceCaptureService? evidenceCaptureService,
    this.requestTimeout = const Duration(seconds: 30),
  })  : _apiClient = apiClient,
        _pendingStore = pendingStore,
        _validator = validator ?? const IncidentSubmissionValidator(),
        _evidenceUploadService = evidenceUploadService,
        _evidenceCaptureService = evidenceCaptureService;

  final TheEyeApiClient _apiClient;
  final PendingSubmissionStore _pendingStore;
  final IncidentSubmissionValidator _validator;
  final EvidenceUploadService? _evidenceUploadService;
  final EvidenceCaptureService? _evidenceCaptureService;
  final Duration requestTimeout;
  final Set<String> _inFlightSubmissionIds = {};

  Future<IncidentSubmissionResult> submit(
    IncidentDraft draft, {
    String? accessToken,
    bool forceOfflineQueue = false,
    EvidenceUploadProgress? onEvidenceProgress,
  }) async {
    if (_inFlightSubmissionIds.contains(draft.clientSubmissionId)) {
      return const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.duplicateInFlight,
        userMessage: "This report is already being submitted.",
      );
    }

    final validationError = _validator.validate(draft,
        hasAccessToken: accessToken != null && accessToken.isNotEmpty);
    if (validationError != null) return validationError;

    if (forceOfflineQueue) {
      await _queueDraft(draft);
      return const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.queuedOffline,
        userMessage:
            "Report saved offline. It will send automatically when connectivity returns.",
      );
    }

    _inFlightSubmissionIds.add(draft.clientSubmissionId);
    try {
      final response = await _apiClient
          .reportIncident(
            payload: _payloadForDraft(draft),
            accessToken: accessToken,
            clientSubmissionId: draft.clientSubmissionId,
            timeout: requestTimeout,
          )
          .timeout(requestTimeout);

      await _removeQueuedDraft(draft.clientSubmissionId);
      final message = await _finalizeEvidenceUpload(
        draft: draft,
        incidentId: response.id,
        accessToken: accessToken,
        baseMessage: "Report submitted. Status: ${response.status}.",
        onEvidenceProgress: onEvidenceProgress,
      );
      return IncidentSubmissionResult(
        status: IncidentSubmissionStatus.success,
        incidentId: response.id,
        serverStatus: response.status,
        submittedAt: response.submittedAt,
        userMessage: message,
        reportType: draft.type,
      );
    } on TimeoutException {
      await _queueDraft(draft);
      return const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.timeout,
        userMessage:
            "Submission timed out. Your report was saved and will retry when connectivity returns.",
      );
    } on IncidentApiException catch (error) {
      if (error.statusCode == 401 || error.statusCode == 403) {
        return const IncidentSubmissionResult(
          status: IncidentSubmissionStatus.unauthorized,
          userMessage: "Sign in is required to submit this report.",
        );
      }
      if (error.statusCode == 400) {
        return IncidentSubmissionResult(
          status: IncidentSubmissionStatus.serverValidationError,
          userMessage: error.userMessage,
        );
      }
      return IncidentSubmissionResult(
        status: IncidentSubmissionStatus.serverValidationError,
        userMessage: error.userMessage,
      );
    } on SocketException {
      await _queueDraft(draft);
      return const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.networkError,
        userMessage:
            "No internet connection. Your report was saved and will retry automatically.",
      );
    } on http.ClientException {
      await _queueDraft(draft);
      return const IncidentSubmissionResult(
        status: IncidentSubmissionStatus.networkError,
        userMessage:
            "Unable to reach THE EYE servers. Your report was saved for retry.",
      );
    } finally {
      _inFlightSubmissionIds.remove(draft.clientSubmissionId);
    }
  }

  Future<List<IncidentSubmissionResult>> syncPending(
      {String? accessToken}) async {
    final pending = await _pendingStore.loadPending();
    if (pending.isEmpty) return [];

    final results = <IncidentSubmissionResult>[];
    final remaining = <IncidentDraft>[];

    for (final draft in pending) {
      final result = await submit(draft, accessToken: accessToken);
      final enriched = IncidentSubmissionResult(
        status: result.status,
        incidentId: result.incidentId,
        serverStatus: result.serverStatus,
        submittedAt: result.submittedAt,
        userMessage: result.userMessage,
        fieldErrors: result.fieldErrors,
        reportType: draft.type,
        clientSubmissionId: draft.clientSubmissionId,
      );
      results.add(enriched);
      if (!result.isSuccess) {
        remaining.add(draft);
      }
    }

    await _pendingStore.savePending(remaining);
    return results;
  }

  Future<List<IncidentDraft>> pendingDrafts() => _pendingStore.loadPending();

  Map<String, Object?> _payloadForDraft(IncidentDraft draft) {
    final accuracyAddress = draft.locationAccuracyMeters == null
        ? draft.address
        : [
            if (draft.address != null && draft.address!.isNotEmpty)
              draft.address,
            "GPS accuracy ${draft.locationAccuracyMeters!.toStringAsFixed(0)}m",
            "Captured ${draft.capturedAt.toUtc().toIso8601String()}",
          ].whereType<String>().join(" • ");

    return TheEyePayloads.reportIncident(
      type: draft.type,
      description: draft.description.trim(),
      latitude: draft.latitude,
      longitude: draft.longitude,
      manualLatitude: draft.manualLatitude,
      manualLongitude: draft.manualLongitude,
      manualAddress: draft.manualAddress,
      title: draft.title,
      address: accuracyAddress,
      anonymous: draft.anonymous,
      notifyEmergencyContacts: draft.notifyEmergencyContacts,
      emergencyContactIds: draft.emergencyContactIds,
      media: draft.media.isEmpty
          ? null
          : draft.media.map((item) => item.toJson()).toList(),
      missingPerson: draft.missingPerson?.toJson(),
      stolenVehicle: draft.stolenVehicle?.toJson(),
      capturedAt: draft.capturedAt.toUtc().toIso8601String(),
    );
  }

  Future<void> _queueDraft(IncidentDraft draft) async {
    final pending = await _pendingStore.loadPending();
    final withoutDuplicate = pending
        .where((item) => item.clientSubmissionId != draft.clientSubmissionId)
        .toList();
    withoutDuplicate.add(draft);
    await _pendingStore.savePending(withoutDuplicate);
  }

  Future<void> _removeQueuedDraft(String clientSubmissionId) async {
    final pending = await _pendingStore.loadPending();
    final next = pending
        .where((item) => item.clientSubmissionId != clientSubmissionId)
        .toList();
    await _pendingStore.savePending(next);
  }

  Future<String> _finalizeEvidenceUpload({
    required IncidentDraft draft,
    required String incidentId,
    required String? accessToken,
    required String baseMessage,
    EvidenceUploadProgress? onEvidenceProgress,
  }) async {
    if (draft.localMedia.isEmpty) return baseMessage;
    if (accessToken == null || accessToken.isEmpty) {
      return "$baseMessage Sign in to upload attached evidence.";
    }
    final uploader = _evidenceUploadService;
    final capture = _evidenceCaptureService;
    if (uploader == null) {
      return "$baseMessage Evidence upload is unavailable.";
    }

    try {
      await uploader.uploadForIncident(
        incidentId: incidentId,
        attachments: draft.localMedia,
        accessToken: accessToken,
        fallbackLatitude: draft.latitude,
        fallbackLongitude: draft.longitude,
        onProgress: onEvidenceProgress,
      );
      if (capture != null) {
        await capture.cleanupAttachments(draft.localMedia);
      }
      return "$baseMessage Evidence uploaded.";
    } on EvidenceUploadFailure catch (error) {
      return "$baseMessage ${error.message}";
    } catch (_) {
      return "$baseMessage Evidence upload failed. Try again from incident tracking.";
    }
  }
}

class IncidentApiException implements Exception {
  IncidentApiException(this.statusCode, this.userMessage);

  final int statusCode;
  final String userMessage;

  static IncidentApiException fromResponse(http.Response response) {
    String message = "Unable to submit report right now. Please try again.";
    try {
      final decoded = jsonDecode(response.body);
      if (decoded is Map) {
        final raw = decoded["message"];
        if (raw is String && raw.trim().isNotEmpty) {
          message = raw;
        } else if (raw is List && raw.isNotEmpty) {
          message = raw.map((item) => item.toString()).join(" ");
        }
      }
    } catch (_) {
      // Keep generic user-facing message.
    }

    if (response.statusCode == 401 || response.statusCode == 403) {
      message = "Sign in is required to submit this report.";
    } else if (response.statusCode == 429) {
      message =
          "Too many reports were sent recently. Please wait and try again.";
    }

    return IncidentApiException(response.statusCode, message);
  }
}
