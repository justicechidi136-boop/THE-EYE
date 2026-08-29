import "dart:convert";
import "dart:io";
import "dart:async";

import "package:http/http.dart" as http;

import "../auth/auth_session_store.dart";
import "../auth/auth_service.dart";
import "../config/the_eye_api_config.dart";
import "../incidents/incident_submission_service.dart";
import "../incidents/incident_media_reference.dart";
import "the_eye_api_paths.dart";
import "the_eye_payloads.dart";

export "../auth/auth_service.dart" show AuthApiException;
export "../incidents/incident_submission_service.dart"
    show IncidentReportResponse, IncidentApiException;

class IncidentLocationPostResult {
  const IncidentLocationPostResult({
    required this.statusCode,
    required this.persisted,
    required this.serverRetryQueued,
    this.retryId,
  });

  final int statusCode;
  final bool persisted;
  final bool serverRetryQueued;
  final String? retryId;
}

class CitizenProfileDetails {
  const CitizenProfileDetails({
    this.firstName,
    this.lastName,
    this.country,
    this.countryCode,
    this.preferredLocale,
    this.effectivePreferredLocale,
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
  final String? countryCode;
  final String? preferredLocale;
  final String? effectivePreferredLocale;
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
      countryCode: json["countryCode"] as String?,
      preferredLocale: json["preferredLocale"] as String?,
      effectivePreferredLocale: json["effectivePreferredLocale"] as String?,
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

class CitizenVehicleRecord {
  const CitizenVehicleRecord({
    required this.id,
    required this.userId,
    required this.make,
    required this.model,
    required this.plateNumber,
    required this.isPrimary,
    this.photos = const [],
    this.year,
    this.color,
    this.vin,
    this.createdAt,
    this.updatedAt,
  });

  final String id;
  final String userId;
  final String make;
  final String model;
  final String plateNumber;
  final int? year;
  final String? color;
  final String? vin;
  final bool isPrimary;
  final List<CitizenVehiclePhotoRecord> photos;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  factory CitizenVehicleRecord.fromJson(Map<String, dynamic> json) {
    final yearRaw = json["year"];
    return CitizenVehicleRecord(
      id: (json["id"] as String?) ?? "",
      userId: (json["userId"] as String?) ?? "",
      make: (json["make"] as String?) ?? "",
      model: (json["model"] as String?) ?? "",
      plateNumber: (json["plateNumber"] as String?) ?? "",
      year: yearRaw is num ? yearRaw.toInt() : int.tryParse("$yearRaw"),
      color: json["color"] as String?,
      vin: json["vin"] as String?,
      isPrimary: json["isPrimary"] == true,
      photos: (json["photos"] is List)
          ? (json["photos"] as List)
              .whereType<Map>()
              .map((item) => CitizenVehiclePhotoRecord.fromJson(
                  Map<String, dynamic>.from(item)))
              .toList(growable: false)
          : const [],
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      updatedAt: DateTime.tryParse((json["updatedAt"] as String?) ?? ""),
    );
  }
}

class CitizenVehiclePhotoRecord {
  const CitizenVehiclePhotoRecord({
    required this.id,
    required this.objectKey,
    required this.contentType,
    required this.angle,
    required this.sortOrder,
    this.sizeBytes,
    this.createdAt,
    this.signedGetUrl,
  });

  final String id;
  final String objectKey;
  final String contentType;
  final String angle;
  final int sortOrder;
  final int? sizeBytes;
  final DateTime? createdAt;
  final String? signedGetUrl;

  factory CitizenVehiclePhotoRecord.fromJson(Map<String, dynamic> json) {
    return CitizenVehiclePhotoRecord(
      id: (json["id"] as String?) ?? "",
      objectKey: (json["objectKey"] as String?) ?? "",
      contentType: (json["contentType"] as String?) ?? "",
      angle: (json["angle"] as String?) ?? "OTHER",
      sortOrder: (json["sortOrder"] as num?)?.toInt() ?? 0,
      sizeBytes: (json["sizeBytes"] as num?)?.toInt(),
      createdAt: DateTime.tryParse((json["createdAt"] as String?) ?? ""),
      signedGetUrl: json["signedGetUrl"] as String?,
    );
  }
}

class SmartwatchDeviceRecord {
  const SmartwatchDeviceRecord({
    required this.id,
    required this.deviceId,
    required this.displayName,
    required this.connectivityMode,
    required this.criticalAlertsEnabled,
    required this.failoverEnabled,
    required this.isActive,
    required this.isOnline,
    this.batteryLevel,
    this.signalStrength,
    this.lastLatitude,
    this.lastLongitude,
    this.lastGpsAccuracy,
    this.lastGpsAt,
  });

  final String id;
  final String deviceId;
  final String? displayName;
  final String connectivityMode;
  final bool criticalAlertsEnabled;
  final bool failoverEnabled;
  final bool isActive;
  final bool isOnline;
  final int? batteryLevel;
  final int? signalStrength;
  final double? lastLatitude;
  final double? lastLongitude;
  final double? lastGpsAccuracy;
  final DateTime? lastGpsAt;

  factory SmartwatchDeviceRecord.fromJson(Map<String, dynamic> json) {
    double? parseDouble(Object? value) {
      if (value == null) return null;
      if (value is num) return value.toDouble();
      return double.tryParse(value.toString());
    }

    return SmartwatchDeviceRecord(
      id: (json["id"] as String?) ?? "",
      deviceId: (json["deviceId"] as String?) ?? "",
      displayName: json["displayName"] as String?,
      connectivityMode: (json["connectivityMode"] as String?) ?? "PairedPhone",
      criticalAlertsEnabled: json["criticalAlertsEnabled"] as bool? ?? true,
      failoverEnabled: json["failoverEnabled"] as bool? ?? true,
      isActive: json["isActive"] as bool? ?? false,
      isOnline: json["isOnline"] as bool? ?? false,
      batteryLevel: (json["batteryLevel"] as num?)?.toInt(),
      signalStrength: (json["signalStrength"] as num?)?.toInt(),
      lastLatitude: parseDouble(json["lastLatitude"]),
      lastLongitude: parseDouble(json["lastLongitude"]),
      lastGpsAccuracy: parseDouble(json["lastGpsAccuracy"]),
      lastGpsAt: DateTime.tryParse((json["lastGpsAt"] as String?) ?? ""),
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

class PresignedVehiclePhotoTarget {
  const PresignedVehiclePhotoTarget({
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
    this.preferredLocale,
    this.effectivePreferredLocale,
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
  final String? preferredLocale;
  final String? effectivePreferredLocale;
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
      preferredLocale:
          json["preferredLocale"] as String? ?? profileDetails.preferredLocale,
      effectivePreferredLocale: json["effectivePreferredLocale"] as String? ??
          profileDetails.effectivePreferredLocale,
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
  TheEyeApiClient({
    String? baseUrl,
    http.Client? httpClient,
    this.onUnauthorizedRefresh,
    this.accessTokenProvider,
  })  : baseUrl = baseUrl ?? TheEyeApiConfig.resolveBaseUrl(),
        _http = httpClient ?? http.Client();

  final String baseUrl;
  final http.Client _http;
  final Future<String?> Function(String rejectedAccessToken)?
      onUnauthorizedRefresh;
  final String? Function()? accessTokenProvider;

  static const Set<String> _unauthorizedRefreshExcludedPaths = {
    TheEyeApiPaths.authLogin,
    TheEyeApiPaths.authRegister,
    TheEyeApiPaths.authRefresh,
  };

  Uri _uri(String path) => Uri.parse("$baseUrl$path");

  bool _canAttemptUnauthorizedRefresh(String path, String? accessToken) {
    if (onUnauthorizedRefresh == null) return false;
    if (accessToken == null || accessToken.isEmpty) return false;
    final normalizedPath = Uri.tryParse(path)?.path ?? path;
    return !_unauthorizedRefreshExcludedPaths.contains(normalizedPath);
  }

  String? _currentAccessToken(String? suppliedAccessToken) {
    if (suppliedAccessToken == null || suppliedAccessToken.isEmpty) {
      return suppliedAccessToken;
    }
    final current = accessTokenProvider?.call();
    return current == null || current.isEmpty ? suppliedAccessToken : current;
  }

  Future<http.Response> _sendWithUnauthorizedRetry({
    required String path,
    required String? accessToken,
    required Duration timeout,
    required Future<http.Response> Function(String? token) sendRequest,
  }) async {
    final requestAccessToken = _currentAccessToken(accessToken);
    final first = await sendRequest(requestAccessToken).timeout(timeout);
    if (first.statusCode != 401 ||
        !_canAttemptUnauthorizedRefresh(path, requestAccessToken)) {
      return first;
    }

    final refreshedAccessToken =
        await onUnauthorizedRefresh!.call(requestAccessToken!);
    if (refreshedAccessToken == null || refreshedAccessToken.isEmpty) {
      return first;
    }
    return sendRequest(refreshedAccessToken).timeout(timeout);
  }

  Future<http.Response> postJson(
    String path,
    Map<String, Object?> payload, {
    String? accessToken,
    String? clientSubmissionId,
    String? clientTraceId,
    Duration timeout = const Duration(seconds: 30),
  }) {
    Future<http.Response> send(String? token) {
      final headers = <String, String>{
        "content-type": "application/json",
        "accept": "application/json"
      };
      if (token != null && token.isNotEmpty) {
        headers["authorization"] = "Bearer $token";
      }
      if (clientSubmissionId != null && clientSubmissionId.isNotEmpty) {
        headers["x-client-submission-id"] = clientSubmissionId;
      }
      if (clientTraceId != null && clientTraceId.isNotEmpty) {
        headers["x-client-trace-id"] = clientTraceId;
      }
      return _http.post(
        _uri(path),
        headers: headers,
        body: jsonEncode(payload),
      );
    }

    return _sendWithUnauthorizedRetry(
      path: path,
      accessToken: accessToken,
      timeout: timeout,
      sendRequest: send,
    );
  }

  Future<http.Response> patchJson(
    String path,
    Map<String, Object?> payload, {
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) {
    Future<http.Response> send(String? token) {
      final headers = <String, String>{
        "content-type": "application/json",
        "accept": "application/json"
      };
      if (token != null && token.isNotEmpty) {
        headers["authorization"] = "Bearer $token";
      }
      return _http.patch(
        _uri(path),
        headers: headers,
        body: jsonEncode(payload),
      );
    }

    return _sendWithUnauthorizedRetry(
      path: path,
      accessToken: accessToken,
      timeout: timeout,
      sendRequest: send,
    );
  }

  Future<http.Response> deleteJson(
    String path, {
    String? accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) {
    Future<http.Response> send(String? token) {
      final headers = <String, String>{"accept": "application/json"};
      if (token != null && token.isNotEmpty) {
        headers["authorization"] = "Bearer $token";
      }
      return _http.delete(_uri(path), headers: headers);
    }

    return _sendWithUnauthorizedRetry(
      path: path,
      accessToken: accessToken,
      timeout: timeout,
      sendRequest: send,
    );
  }

  Future<http.Response> getJson(
    String path, {
    String? accessToken,
    Map<String, String>? query,
    Duration timeout = const Duration(seconds: 30),
  }) {
    var uri = _uri(path);
    if (query != null && query.isNotEmpty) {
      uri = uri.replace(queryParameters: {...uri.queryParameters, ...query});
    }

    Future<http.Response> send(String? token) {
      final headers = <String, String>{"accept": "application/json"};
      if (token != null && token.isNotEmpty) {
        headers["authorization"] = "Bearer $token";
      }
      return _http.get(uri, headers: headers);
    }

    return _sendWithUnauthorizedRetry(
      path: path,
      accessToken: accessToken,
      timeout: timeout,
      sendRequest: send,
    );
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
    bool remainSignedIn = false,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "password": password,
      if (email != null) "email": email,
      if (phone != null) "phone": phone,
      "remainSignedIn": remainSignedIn,
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
    bool remainSignedIn = false,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "email": email,
      "password": password,
      "firstName": firstName,
      "lastName": lastName,
      "remainSignedIn": remainSignedIn,
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

  Future<Map<String, dynamic>> requestAccountRecovery({
    required String email,
    String? platform,
    String? deviceId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authAccountRecoveryRequest,
      {
        "email": email,
        if (platform != null) "platform": platform,
        if (deviceId != null) "deviceId": deviceId,
      },
      timeout: timeout,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  Future<Map<String, dynamic>> verifyAccountRecovery({
    required String token,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authAccountRecoveryVerify,
      {"token": token},
      timeout: timeout,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    return decoded is Map<String, dynamic> ? decoded : <String, dynamic>{};
  }

  Future<AuthSession> completeAccountRecovery({
    required String token,
    required String idToken,
    required String provider,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authAccountRecoveryComplete,
      {"token": token, "idToken": idToken, "provider": provider},
      timeout: timeout,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
    return _sessionFromResponse(response);
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
    bool remainSignedIn = false,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.authVerifyPhoneOtp,
      {
        "phone": phone,
        "code": code,
        "purpose": purpose,
        "remainSignedIn": remainSignedIn,
      },
      timeout: timeout,
    );
    return _sessionFromResponse(response);
  }

  Future<AuthExchangeResult> exchangeFirebaseToken({
    required String idToken,
    required String provider,
    String? deviceId,
    String? platform,
    bool remainSignedIn = false,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final payload = <String, Object?>{
      "idToken": idToken,
      "provider": provider,
      if (deviceId != null && deviceId.isNotEmpty) "deviceId": deviceId,
      if (platform != null && platform.isNotEmpty) "platform": platform,
      "remainSignedIn": remainSignedIn,
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

  Future<List<CitizenVehicleRecord>> listMyVehicles({
    required String accessToken,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await getJson(
      TheEyeApiPaths.usersMeVehicles,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      final decoded = jsonDecode(response.body);
      final rows = decoded is Map ? decoded["data"] : null;
      if (rows is! List) return const [];
      return rows
          .whereType<Map>()
          .map((item) =>
              CitizenVehicleRecord.fromJson(Map<String, dynamic>.from(item)))
          .toList(growable: false);
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<CitizenVehicleRecord> createMyVehicle({
    required String accessToken,
    required Map<String, Object?> payload,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeVehicles,
      payload,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenVehicleRecord.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<CitizenVehicleRecord> getMyVehicle({
    required String accessToken,
    required String vehicleId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await getJson(
      TheEyeApiPaths.usersMeVehicle(vehicleId),
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenVehicleRecord.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<CitizenVehicleRecord> updateMyVehicle({
    required String accessToken,
    required String vehicleId,
    required Map<String, Object?> payload,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await patchJson(
      TheEyeApiPaths.usersMeVehicle(vehicleId),
      payload,
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenVehicleRecord.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<void> deleteMyVehicle({
    required String accessToken,
    required String vehicleId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await deleteJson(
      TheEyeApiPaths.usersMeVehicle(vehicleId),
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<CitizenVehicleRecord> setMyVehiclePrimary({
    required String accessToken,
    required String vehicleId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeVehiclePrimary(vehicleId),
      const {"isPrimary": true},
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenVehicleRecord.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<PresignedVehiclePhotoTarget> presignVehiclePhoto({
    required String accessToken,
    required String vehicleId,
    required String contentType,
    required String fileName,
    int? sizeBytes,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeVehiclePhotosPresign(vehicleId),
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
      return PresignedVehiclePhotoTarget(
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

  Future<CitizenVehiclePhotoRecord> confirmVehiclePhoto({
    required String accessToken,
    required String vehicleId,
    required String objectKey,
    required String contentType,
    required String angle,
    int? sizeBytes,
    int? sortOrder,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await postJson(
      TheEyeApiPaths.usersMeVehiclePhotosConfirm(vehicleId),
      {
        "objectKey": objectKey,
        "contentType": contentType,
        "angle": angle,
        if (sizeBytes != null) "sizeBytes": sizeBytes,
        if (sortOrder != null) "sortOrder": sortOrder,
      },
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return CitizenVehiclePhotoRecord.fromJson(_decodeMap(response.body));
    }
    throw AuthApiException.fromResponse(response);
  }

  Future<void> deleteVehiclePhoto({
    required String accessToken,
    required String vehicleId,
    required String photoId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    final response = await deleteJson(
      TheEyeApiPaths.usersMeVehiclePhoto(vehicleId, photoId),
      accessToken: accessToken,
      timeout: timeout,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return;
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
    return _parseIncidentReportResponse(
      await postJson(
        TheEyeApiPaths.incidentsReport,
        payload,
        accessToken: accessToken,
        clientSubmissionId: clientSubmissionId,
        timeout: timeout,
      ),
    );
  }

  Future<IncidentReportResponse> reportEmergency({
    required Map<String, Object?> payload,
    String? accessToken,
    String? clientSubmissionId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    return _parseIncidentReportResponse(
      await postJson(
        TheEyeApiPaths.incidentsEmergency,
        payload,
        accessToken: accessToken,
        clientSubmissionId: clientSubmissionId,
        timeout: timeout,
      ),
    );
  }

  Future<IncidentReportResponse> reportSos({
    required Map<String, Object?> payload,
    String? accessToken,
    String? clientSubmissionId,
    Duration timeout = const Duration(seconds: 30),
  }) async {
    return _parseIncidentReportResponse(
      await postJson(
        TheEyeApiPaths.incidentsSos,
        payload,
        accessToken: accessToken,
        clientSubmissionId: clientSubmissionId,
        timeout: timeout,
      ),
    );
  }

  IncidentReportResponse _parseIncidentReportResponse(http.Response response) {
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
    String? clientTraceId,
  }) async {
    final response = await postJson(
      TheEyeApiPaths.liveVideoStart(incidentId),
      payload,
      accessToken: accessToken,
      clientTraceId: clientTraceId,
    );
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return _decodeEnvelope(response.body) ?? const <String, dynamic>{};
    }
    throw IncidentApiException.fromResponse(response);
  }

  Future<Map<String, dynamic>> stopLiveVideo({
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
    return _decodeEnvelope(response.body) ?? const <String, dynamic>{};
  }

  Future<void> reportLiveVideoClientFailure({
    required String sessionId,
    String? accessToken,
    String? reasonCode,
    String? message,
    String? clientTraceId,
  }) async {
    final response = await postJson(
      TheEyeApiPaths.liveVideoClientFailure(sessionId),
      <String, Object?>{
        if (reasonCode != null) "reasonCode": reasonCode,
        if (message != null) "message": message,
        if (clientTraceId != null) "clientTraceId": clientTraceId,
      },
      accessToken: accessToken,
      clientTraceId: clientTraceId,
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

  Future<IncidentLocationPostResult> postIncidentLocation({
    required String incidentId,
    required Map<String, Object?> payload,
    String? accessToken,
  }) async {
    final response = await postJson(
      TheEyeApiPaths.incidentLocation(incidentId),
      payload,
      accessToken: accessToken,
    );
    if (response.statusCode == 202) {
      final decoded = response.body.isEmpty ? null : jsonDecode(response.body);
      return IncidentLocationPostResult(
        statusCode: 202,
        persisted: false,
        serverRetryQueued: true,
        retryId: decoded is Map ? decoded["retryId"] as String? : null,
      );
    }
    if (response.statusCode >= 200 && response.statusCode < 300) {
      return IncidentLocationPostResult(
        statusCode: response.statusCode,
        persisted: true,
        serverRetryQueued: false,
      );
    }
    throw IncidentApiException.fromResponse(response);
  }

  Future<List<SmartwatchDeviceRecord>> listSmartwatchDevices({
    required String accessToken,
  }) async {
    final response = await getJson(
      TheEyeApiPaths.smartwatchDevices,
      accessToken: accessToken,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw AuthApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final data = decoded is Map ? decoded["data"] : null;
    if (data is! List) return const [];
    return data
        .map((item) => SmartwatchDeviceRecord.fromJson(
            Map<String, dynamic>.from(item as Map)))
        .toList();
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
