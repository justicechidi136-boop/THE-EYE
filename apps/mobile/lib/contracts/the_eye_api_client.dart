import "dart:convert";
import "dart:io";
import "dart:async";

import "package:http/http.dart" as http;

import "../auth/auth_session_store.dart";
import "../auth/auth_service.dart";
import "../incidents/incident_submission_service.dart";
import "../incidents/incident_media_reference.dart";
import "the_eye_api_paths.dart";
import "the_eye_payloads.dart";

export "../auth/auth_service.dart" show AuthApiException;
export "../incidents/incident_submission_service.dart"
    show IncidentReportResponse, IncidentApiException;

class CitizenProfile {
  const CitizenProfile({
    required this.id,
    required this.displayName,
    required this.kycStatus,
    this.email,
    this.phone,
    this.trustScore,
    this.emergencyContactPhone,
    this.emergencyContactName,
  });

  final String id;
  final String displayName;
  final String kycStatus;
  final String? email;
  final String? phone;
  final double? trustScore;
  final String? emergencyContactPhone;
  final String? emergencyContactName;

  factory CitizenProfile.fromJson(Map<String, dynamic> json) {
    final contact = json["emergencyContact"];
    final contactMap = contact is Map
        ? Map<String, dynamic>.from(contact)
        : const <String, dynamic>{};
    final trustRaw = json["trustScore"];
    return CitizenProfile(
      id: (json["id"] as String?) ?? "",
      displayName: (json["displayName"] as String?)?.trim().isNotEmpty == true
          ? json["displayName"] as String
          : (json["email"] as String?) ??
              (json["phone"] as String?) ??
              "Citizen",
      kycStatus: (json["kycStatus"] as String?) ?? "Unverified",
      email: json["email"] as String?,
      phone: json["phone"] as String?,
      trustScore: trustRaw is num ? trustRaw.toDouble() : null,
      emergencyContactPhone: contactMap["phone"] as String?,
      emergencyContactName: contactMap["name"] as String?,
    );
  }
}

class PresignedEvidenceTarget {
  const PresignedEvidenceTarget({
    required this.bucket,
    required this.objectKey,
    required this.uploadUrl,
    required this.requiredHeaders,
  });

  final String bucket;
  final String objectKey;
  final String uploadUrl;
  final Map<String, String> requiredHeaders;
}

class TheEyeApiClient {
  TheEyeApiClient({String? baseUrl, http.Client? httpClient})
      : baseUrl = baseUrl ?? TheEyeApiPaths.defaultBaseUrl,
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;

  Uri _uri(String path) => Uri.parse("$baseUrl$path");

  Future<http.Response> postJson(
    String path,
    Map<String, Object?> payload, {
    String? accessToken,
    String? clientSubmissionId,
    Duration timeout = const Duration(seconds: 30),
  }) {
    final headers = <String, String>{
      "content-type": "application/json",
      "accept": "application/json"
    };
    if (accessToken != null && accessToken.isNotEmpty) {
      headers["authorization"] = "Bearer $accessToken";
    }
    if (clientSubmissionId != null && clientSubmissionId.isNotEmpty) {
      headers["x-client-submission-id"] = clientSubmissionId;
    }

    return _http
        .post(
          _uri(path),
          headers: headers,
          body: jsonEncode(payload),
        )
        .timeout(timeout);
  }

  Future<http.Response> patchJson(
    String path,
    Map<String, Object?> payload, {
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) {
    final headers = <String, String>{
      "content-type": "application/json",
      "accept": "application/json"
    };
    if (accessToken != null && accessToken.isNotEmpty) {
      headers["authorization"] = "Bearer $accessToken";
    }

    return _http
        .patch(
          _uri(path),
          headers: headers,
          body: jsonEncode(payload),
        )
        .timeout(timeout);
  }

  Future<bool> checkApiReachable(
      {Duration timeout = const Duration(seconds: 5)}) async {
    try {
      final response = await _http.get(
        _uri(TheEyeApiPaths.health),
        headers: const {"accept": "application/json"},
      ).timeout(timeout);
      return response.statusCode >= 200 && response.statusCode < 300;
    } on TimeoutException {
      return false;
    } on SocketException {
      return false;
    } on http.ClientException {
      return false;
    }
  }

  Future<AuthSession> login({
    String? email,
    String? phone,
    required String password,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "password": password,
      if (email != null) "email": email,
      if (phone != null) "phone": phone,
    };
    final response =
        await postJson(TheEyeApiPaths.authLogin, payload, timeout: timeout);
    return _sessionFromResponse(response);
  }

  Future<AuthExchangeResult> register({
    required String email,
    required String password,
    String? firstName,
    String? lastName,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "email": email,
      "password": password,
      if (firstName != null && firstName.isNotEmpty) "firstName": firstName,
      if (lastName != null && lastName.isNotEmpty) "lastName": lastName,
    };
    final response =
        await postJson(TheEyeApiPaths.authRegister, payload, timeout: timeout);
    return _exchangeFromResponse(response);
  }

  Future<void> requestPasswordReset(
      {required String email,
      Duration timeout = const Duration(seconds: 30)}) async {
    final response = await postJson(
        TheEyeApiPaths.authPasswordResetRequest, {"email": email},
        timeout: timeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
  }

  Future<void> requestPhoneOtp({
    required String phone,
    String purpose = "login",
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authRequestPhoneOtp,
      {"phone": phone, "purpose": purpose},
      timeout: timeout,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
  }

  Future<AuthSession> verifyPhoneOtp({
    required String phone,
    required String code,
    String purpose = "login",
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authVerifyPhoneOtp,
      {"phone": phone, "code": code, "purpose": purpose},
      timeout: timeout,
    );
    return _sessionFromResponse(response);
  }

  Future<AuthExchangeResult> exchangeFirebaseToken({
    required String idToken,
    required String provider,
    String? deviceId,
    String? platform,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "idToken": idToken,
      "provider": provider,
      if (deviceId != null && deviceId.isNotEmpty) "deviceId": deviceId,
      if (platform != null && platform.isNotEmpty) "platform": platform,
    };
    final response = await postJson(
      TheEyeApiPaths.authFirebaseExchange,
      payload,
      timeout: timeout,
    );
    return _exchangeFromResponse(response);
  }

  Future<CitizenProfile> fetchCitizenProfile({
    required String accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await _http
        .get(
          _uri(TheEyeApiPaths.usersMe),
          headers: {
            "accept": "application/json",
            "authorization": "Bearer $accessToken",
          },
        )
        .timeout(timeout);
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final map = decoded is Map<String, dynamic>
          ? decoded
          : Map<String, dynamic>.from(decoded as Map);
      return CitizenProfile.fromJson(map);
    }
    throw AuthApiException.fromResponse(response);
  }

  AuthExchangeResult _exchangeFromResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final map = decoded is Map<String, dynamic>
          ? decoded
          : Map<String, dynamic>.from(decoded as Map);
      final accessToken = map["accessToken"] as String?;
      final refreshToken = map["refreshToken"] as String?;
      if (accessToken == null || refreshToken == null) {
        throw AuthApiException(
            response.statusCode, "Unexpected response from auth service.");
      }
      final profileComplete = map["profileComplete"] == true;
      return AuthExchangeResult(
        session:
            AuthSession(accessToken: accessToken, refreshToken: refreshToken),
        profileComplete: profileComplete,
      );
    }
    throw AuthApiException.fromResponse(response);
  }

  AuthSession _sessionFromResponse(http.Response response) {
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final map = decoded is Map<String, dynamic>
          ? decoded
          : Map<String, dynamic>.from(decoded as Map);
      final accessToken = map["accessToken"] as String?;
      final refreshToken = map["refreshToken"] as String?;
      if (accessToken == null || refreshToken == null) {
        throw AuthApiException(
            response.statusCode, "Unexpected response from auth service.");
      }
      return AuthSession(accessToken: accessToken, refreshToken: refreshToken);
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<IncidentReportResponse> reportIncident({
    required Map<String, Object?> payload,
    String? accessToken,
    String? clientSubmissionId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.incidentsReport,
      payload,
      accessToken: accessToken,
      clientSubmissionId: clientSubmissionId,
      timeout: timeout,
    );

    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map<String, dynamic>) {
        return IncidentReportResponse.fromJson(decoded);
      }
      if (decoded is Map) {
        return IncidentReportResponse.fromJson(
            Map<String, dynamic>.from(decoded));
      }
      throw IncidentApiException(
          response.statusCode, "Unexpected response from incident service.");
    }

    throw IncidentApiException.fromResponse(response);
  }

  Future<PresignedEvidenceTarget> presignIncidentMedia({
    required String incidentId,
    required String mediaType,
    required String contentType,
    required String fileName,
    int? sizeBytes,
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.incidentsMediaPresign(incidentId),
      {
        "mediaType": mediaType,
        "contentType": contentType,
        "fileName": fileName,
        if (sizeBytes != null) "sizeBytes": sizeBytes,
      },
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final map = decoded is Map<String, dynamic>
          ? decoded
          : Map<String, dynamic>.from(decoded as Map);
      final headers = map["requiredHeaders"];
      return PresignedEvidenceTarget(
        bucket: map["bucket"] as String,
        objectKey: map["objectKey"] as String,
        uploadUrl: map["uploadUrl"] as String,
        requiredHeaders: headers is Map
            ? Map<String, String>.from(
                headers.map((key, value) => MapEntry("$key", "$value")))
            : const {},
      );
    }
    throw IncidentApiException.fromResponse(response);
  }

  Future<IncidentMediaReference> confirmIncidentMedia({
    required String incidentId,
    required IncidentMediaReference media,
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.incidentsMediaConfirm(incidentId),
      media.toJson(),
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final map = decoded is Map<String, dynamic>
          ? decoded
          : Map<String, dynamic>.from(decoded as Map);
      return IncidentMediaReference.fromJson(map);
    }
    throw IncidentApiException.fromResponse(response);
  }

  Future<void> uploadPresignedEvidence({
    required String uploadUrl,
    required String filePath,
    required String contentType,
    Map<String, String> requiredHeaders = const {},
    http.Client? httpClient,
    Duration timeout = const Duration(seconds: 120),
  }) async {
    final client = httpClient ?? _http;
    final file = File(filePath);
    final bytes = await file.readAsBytes();
    final headers = <String, String>{
      "content-type": contentType,
      ...requiredHeaders,
    };
    final response = await client
        .put(Uri.parse(uploadUrl), headers: headers, body: bytes)
        .timeout(timeout);
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException(
          response.statusCode, "Evidence upload failed.");
    }
  }

  Future<Map<String, dynamic>> startLiveVideo({
    required String incidentId,
    required Map<String, Object?> payload,
    String? accessToken,
  }) async {
    final response = await postJson(
      TheEyeApiPaths.liveVideoStart(incidentId),
      payload,
      accessToken: accessToken,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return _decodeEnvelope(response.body) ?? const <String, dynamic>{};
    }
    throw IncidentApiException.fromResponse(response);
  }

  Future<void> stopLiveVideo({
    required String sessionId,
    String? accessToken,
  }) async {
    final response = await patchJson(
      TheEyeApiPaths.liveVideoStop(sessionId),
      const <String, Object?>{},
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
  }

  Future<void> postLiveVideoLocation({
    required String sessionId,
    required Map<String, Object?> payload,
    String? accessToken,
  }) async {
    await postJson(
      TheEyeApiPaths.liveVideoLocation(sessionId),
      payload,
      accessToken: accessToken,
    );
  }

  Future<void> registerSmartwatch(Map<String, Object?> payload,
      {String? accessToken}) async {
    await postJson(TheEyeApiPaths.smartwatchRegister, payload,
        accessToken: accessToken);
  }

  Future<void> postSmartwatchGps({
    required String deviceId,
    required Map<String, Object?> payload,
    String? accessToken,
  }) async {
    await postJson(TheEyeApiPaths.smartwatchGps(deviceId), payload,
        accessToken: accessToken);
  }

  Future<void> postSmartwatchSos(Map<String, Object?> payload,
      {String? accessToken}) async {
    await postJson(TheEyeApiPaths.smartwatchSos, payload,
        accessToken: accessToken);
  }

  Future<void> postSmartwatchHeartbeat({
    required String deviceId,
    required Map<String, Object?> payload,
    String? accessToken,
  }) async {
    await postJson(TheEyeApiPaths.smartwatchHeartbeat(deviceId), payload,
        accessToken: accessToken);
  }

  Future<void> postSmartwatchOfflineSync({
    required String deviceId,
    required Map<String, Object?> payload,
    String? accessToken,
  }) async {
    await postJson(TheEyeApiPaths.smartwatchOfflineSync(deviceId), payload,
        accessToken: accessToken);
  }

  Map<String, dynamic>? _decodeData(String body) {
    final decoded = jsonDecode(body);
    if (decoded is Map && decoded["data"] is Map) {
      return Map<String, dynamic>.from(decoded["data"] as Map);
    }
    return null;
  }

  Map<String, dynamic>? _decodeEnvelope(String body) {
    final decoded = jsonDecode(body);
    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }
    return null;
  }
}
