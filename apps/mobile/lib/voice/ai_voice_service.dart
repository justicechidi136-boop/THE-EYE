import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";

class AiVoicePresentation {
  const AiVoicePresentation({
    required this.mediaId,
    required this.originalUrl,
    required this.transcriptStatus,
    this.originalLocale,
    this.transcript,
    this.transcriptLocale,
    this.translation,
    this.targetLocale,
    this.synthesisStatus,
    this.synthesisUrl,
  });

  final String mediaId;
  final String originalUrl;
  final String transcriptStatus;
  final String? originalLocale;
  final String? transcript;
  final String? transcriptLocale;
  final String? translation;
  final String? targetLocale;
  final String? synthesisStatus;
  final String? synthesisUrl;

  factory AiVoicePresentation.fromJson(Map<String, dynamic> json) {
    final original = json["original"] is Map
        ? Map<String, dynamic>.from(json["original"] as Map)
        : const <String, dynamic>{};
    final transcript = json["transcript"] is Map
        ? Map<String, dynamic>.from(json["transcript"] as Map)
        : const <String, dynamic>{};
    final translation = json["translation"] is Map
        ? Map<String, dynamic>.from(json["translation"] as Map)
        : const <String, dynamic>{};
    final synthesis = json["synthesis"] is Map
        ? Map<String, dynamic>.from(json["synthesis"] as Map)
        : const <String, dynamic>{};
    return AiVoicePresentation(
      mediaId: (json["mediaId"] as String?) ?? "",
      originalUrl: (original["signedUrl"] as String?) ?? "",
      originalLocale: original["locale"] as String?,
      transcriptStatus: (transcript["status"] as String?) ?? "PENDING",
      transcript: transcript["text"] as String?,
      transcriptLocale: (transcript["sourceLocale"] as String?) ??
          transcript["detectedLocale"] as String?,
      translation: translation["text"] as String?,
      targetLocale: translation["targetLocale"] as String?,
      synthesisStatus: synthesis["status"] as String?,
      synthesisUrl: synthesis["signedUrl"] as String?,
    );
  }
}

class AiVoiceService {
  AiVoiceService({TheEyeApiClient? apiClient})
      : _apiClient = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _apiClient;

  Future<AiVoicePresentation> getBroadcastVoice({
    required String accessToken,
    required String broadcastId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.getJson(
      "/broadcasts/$broadcastId/media/$mediaId/voice",
      accessToken: accessToken,
      query: {"targetLocale": targetLocale},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : Map<String, dynamic>.from(decoded as Map);
    return AiVoicePresentation.fromJson(data);
  }

  Future<void> requestBroadcastTranslation({
    required String accessToken,
    required String broadcastId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.postJson(
      "/broadcasts/$broadcastId/media/$mediaId/voice/translations",
      {"targetLocale": targetLocale},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<void> requestBroadcastSynthesis({
    required String accessToken,
    required String broadcastId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.postJson(
      "/broadcasts/$broadcastId/media/$mediaId/voice/synthesis",
      {"targetLocale": targetLocale},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<AiVoicePresentation> getIncidentVoice({
    required String accessToken,
    required String incidentId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.getJson(
      TheEyeApiPaths.incidentVoice(incidentId, mediaId),
      accessToken: accessToken,
      query: {"targetLocale": targetLocale},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : Map<String, dynamic>.from(decoded as Map);
    return AiVoicePresentation.fromJson(data);
  }

  Future<void> requestIncidentTranslation({
    required String accessToken,
    required String incidentId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentVoiceTranslation(incidentId, mediaId),
      {"targetLocale": targetLocale},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<void> requestIncidentSynthesis({
    required String accessToken,
    required String incidentId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.postJson(
      TheEyeApiPaths.incidentVoiceSynthesis(incidentId, mediaId),
      {"targetLocale": targetLocale},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<AiVoicePresentation> getCommunityPostVoice({
    required String accessToken,
    required String postId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.getJson(
      "/neighborhood-watch/posts/$postId/media/$mediaId/voice",
      accessToken: accessToken,
      query: {"targetLocale": targetLocale},
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is Map && decoded["data"] is Map
        ? Map<String, dynamic>.from(decoded["data"] as Map)
        : Map<String, dynamic>.from(decoded as Map);
    return AiVoicePresentation.fromJson(data);
  }

  Future<void> requestCommunityPostTranslation({
    required String accessToken,
    required String postId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.postJson(
      "/neighborhood-watch/posts/$postId/media/$mediaId/voice/translations",
      {"targetLocale": targetLocale},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<void> requestCommunityPostSynthesis({
    required String accessToken,
    required String postId,
    required String mediaId,
    required String targetLocale,
  }) async {
    final response = await _apiClient.postJson(
      "/neighborhood-watch/posts/$postId/media/$mediaId/voice/synthesis",
      {"targetLocale": targetLocale},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }
}
