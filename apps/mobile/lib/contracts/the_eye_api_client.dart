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

class CitizenProfileDetails {
  const CitizenProfileDetails({
    this.firstName,
    this.lastName,
    this.country,
    this.state,
    this.lga,
    this.avatarUrl,
    this.dateOfBirth,
    this.gender,
    this.address,
  });

  final String? firstName;
  final String? lastName;
  final String? country;
  final String? state;
  final String? lga;
  final String? avatarUrl;
  final String? dateOfBirth;
  final String? gender;
  final String? address;

  factory CitizenProfileDetails.fromJson(Map<String, dynamic>? json) {
    if (json == null || json.isEmpty) {
      return const CitizenProfileDetails();
    }
    return CitizenProfileDetails(
      firstName: json["firstName"] as String?,
      lastName: json["lastName"] as String?,
      country: json["country"] as String?,
      state: json["state"] as String?,
      lga: json["lga"] as String?,
      avatarUrl: json["avatarUrl"] as String?,
      dateOfBirth: json["dateOfBirth"] as String?,
      gender: json["gender"] as String?,
      address: json["address"] as String?,
    );
  }
}

class EmergencyContact {
  const EmergencyContact({
    required this.id,
    required this.name,
    required this.phone,
    required this.relationship,
    required this.priority,
  });

  final String id;
  final String name;
  final String phone;
  final String relationship;
  final int priority;

  factory EmergencyContact.fromJson(Map<String, dynamic> json) {
    return EmergencyContact(
      id: (json["id"] as String?) ?? "",
      name: (json["name"] as String?) ?? "",
      phone: (json["phone"] as String?) ?? "",
      relationship: (json["relationship"] as String?) ?? "",
      priority: (json["priority"] as num?)?.toInt() ?? 1,
    );
  }
}

class KycSubmissionResult {
  const KycSubmissionResult({
    required this.id,
    required this.status,
    required this.documentType,
    this.createdAt,
  });

  final String id;
  final String status;
  final String documentType;
  final String? createdAt;

  factory KycSubmissionResult.fromJson(Map<String, dynamic> json) {
    return KycSubmissionResult(
      id: (json["id"] as String?) ?? "",
      status: (json["status"] as String?) ?? "Pending",
      documentType: (json["documentType"] as String?) ?? "",
      createdAt: json["createdAt"] as String?,
    );
  }
}

class PresignedAvatarTarget {
  const PresignedAvatarTarget({
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

class CitizenProfile {
  const CitizenProfile({
    required this.id,
    required this.displayName,
    required this.kycStatus,
    required this.profileComplete,
    this.email,
    this.phone,
    this.trustScore,
    this.emergencyContactPhone,
    this.emergencyContactName,
    this.profile = const CitizenProfileDetails(),
    this.emergencyContacts = const [],
    this.kycRejectionReason,
  });

  final String id;
  final String displayName;
  final String kycStatus;
  final bool profileComplete;
  final String? email;
  final String? phone;
  final double? trustScore;
  final String? emergencyContactPhone;
  final String? emergencyContactName;
  final CitizenProfileDetails profile;
  final List<EmergencyContact> emergencyContacts;
  final String? kycRejectionReason;

  factory CitizenProfile.fromJson(Map<String, dynamic> json) {
    final contact = json["emergencyContact"];
    final contactMap = contact is Map
        ? Map<String, dynamic>.from(contact)
        : const <String, dynamic>{};
    final trustRaw = json["trustScore"];
    final profileMap = json["profile"];
    final profileDetails = profileMap is Map
        ? CitizenProfileDetails.fromJson(Map<String, dynamic>.from(profileMap))
        : const CitizenProfileDetails();
    final contactsRaw = json["emergencyContacts"];
    final contacts = contactsRaw is List
        ? contactsRaw
            .whereType<Map>()
            .map((item) =>
                EmergencyContact.fromJson(Map<String, dynamic>.from(item)))
            .toList()
        : const <EmergencyContact>[];
    final serverComplete = json["profileComplete"];
    final profileComplete = serverComplete is bool
        ? serverComplete
        : _isProfileComplete(profileDetails);
    final primaryContact = contacts.isNotEmpty
        ? contacts.first
        : (contactMap.isNotEmpty
            ? EmergencyContact.fromJson(contactMap)
            : null);
    return CitizenProfile(
      id: (json["id"] as String?) ?? "",
      displayName: (json["displayName"] as String?)?.trim().isNotEmpty == true
          ? json["displayName"] as String
          : (json["email"] as String?) ??
              (json["phone"] as String?) ??
              "Citizen",
      kycStatus: (json["kycStatus"] as String?) ?? "Unverified",
      profileComplete: profileComplete,
      email: json["email"] as String?,
      phone: json["phone"] as String?,
      trustScore: trustRaw is num ? trustRaw.toDouble() : null,
      emergencyContactPhone:
          primaryContact?.phone ?? contactMap["phone"] as String?,
      emergencyContactName:
          primaryContact?.name ?? contactMap["name"] as String?,
      profile: profileDetails,
      emergencyContacts: contacts,
      kycRejectionReason: json["kycRejectionReason"] as String?,
    );
  }

  static bool _isProfileComplete(CitizenProfileDetails profile) {
    final firstName = profile.firstName?.trim() ?? "";
    final lastName = profile.lastName?.trim() ?? "";
    final country = profile.country?.trim() ?? "";
    final state = profile.state?.trim() ?? "";
    final lga = profile.lga?.trim() ?? "";
    const placeholderNames = {"Google", "Apple", "Citizen"};
    if (placeholderNames.contains(firstName) || lastName == "User") {
      return false;
    }
    return firstName.isNotEmpty &&
        lastName.isNotEmpty &&
        country.isNotEmpty &&
        state.isNotEmpty &&
        lga.isNotEmpty;
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

  Future<http.Response> deleteJson(
    String path, {
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) {
    final headers = <String, String>{"accept": "application/json"};
    if (accessToken != null && accessToken.isNotEmpty) {
      headers["authorization"] = "Bearer $accessToken";
    }

    return _http.delete(_uri(path), headers: headers).timeout(timeout);
  }

  Future<http.Response> getJson(
    String path, {
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) {
    final headers = <String, String>{"accept": "application/json"};
    if (accessToken != null && accessToken.isNotEmpty) {
      headers["authorization"] = "Bearer $accessToken";
    }

    return _http.get(_uri(path), headers: headers).timeout(timeout);
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
    required String firstName,
    required String lastName,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "email": email,
      "password": password,
      "firstName": firstName,
      "lastName": lastName,
    };
    final response =
        await postJson(TheEyeApiPaths.authRegister, payload, timeout: timeout);
    return _exchangeFromResponse(response);
  }

  Future<AuthSession> refreshSession({
    required String refreshToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authRefresh,
      {"refreshToken": refreshToken},
      timeout: timeout,
    );
    return _sessionFromResponse(response);
  }

  Future<void> logout({
    required String refreshToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authLogout,
      {"refreshToken": refreshToken},
      timeout: timeout,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
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
    final response = await getJson(
      TheEyeApiPaths.usersMe,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenProfile.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<CitizenProfile> updateCitizenProfile({
    required String accessToken,
    required Map<String, Object?> payload,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await patchJson(
      TheEyeApiPaths.usersMe,
      payload,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenProfile.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<List<EmergencyContact>> listEmergencyContacts({
    required String accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await getJson(
      TheEyeApiPaths.usersMeEmergencyContacts,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      if (decoded is Map && decoded["data"] is List) {
        return (decoded["data"] as List)
            .whereType<Map>()
            .map((item) =>
                EmergencyContact.fromJson(Map<String, dynamic>.from(item)))
            .toList();
      }
      return const [];
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<EmergencyContact> createEmergencyContact({
    required String accessToken,
    required Map<String, Object?> payload,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeEmergencyContacts,
      payload,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return EmergencyContact.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<EmergencyContact> updateEmergencyContact({
    required String accessToken,
    required String contactId,
    required Map<String, Object?> payload,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await patchJson(
      TheEyeApiPaths.usersMeEmergencyContact(contactId),
      payload,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return EmergencyContact.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<void> deleteEmergencyContact({
    required String accessToken,
    required String contactId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await deleteJson(
      TheEyeApiPaths.usersMeEmergencyContact(contactId),
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<PresignedAvatarTarget> presignAvatar({
    required String accessToken,
    required String contentType,
    required String fileName,
    int? sizeBytes,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeAvatarPresign,
      {
        "contentType": contentType,
        "fileName": fileName,
        if (sizeBytes != null) "sizeBytes": sizeBytes,
      },
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final map = _decodeMap(response.body);
      final headers = map["requiredHeaders"];
      return PresignedAvatarTarget(
        bucket: map["bucket"] as String,
        objectKey: map["objectKey"] as String,
        uploadUrl: map["uploadUrl"] as String,
        requiredHeaders: headers is Map
            ? Map<String, String>.from(
                headers.map((key, value) => MapEntry("$key", "$value")))
            : const {},
      );
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<CitizenProfile> confirmAvatar({
    required String accessToken,
    required String objectKey,
    required String bucket,
    required String contentType,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeAvatarConfirm,
      {
        "objectKey": objectKey,
        "bucket": bucket,
        "contentType": contentType,
      },
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenProfile.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<KycSubmissionResult> submitKyc({
    required String accessToken,
    required String documentType,
    String? documentNumber,
    String? documentObjectKey,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeKyc,
      {
        "documentType": documentType,
        if (documentNumber != null && documentNumber.isNotEmpty)
          "documentNumber": documentNumber,
        if (documentObjectKey != null && documentObjectKey.isNotEmpty)
          "documentObjectKey": documentObjectKey,
      },
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return KycSubmissionResult.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<Map<String, dynamic>> requestAccountDeletion({
    required String accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeDeletionRequest,
      {"confirm": true},
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return _decodeMap(response.body);
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

  Map<String, dynamic> _decodeMap(String body) {
    final decoded = jsonDecode(body);
    if (decoded is Map<String, dynamic>) {
      return decoded;
    }
    if (decoded is Map) {
      return Map<String, dynamic>.from(decoded);
    }
    throw AuthApiException(500, "Unexpected response from THE EYE API.");
  }
}
