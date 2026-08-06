import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import '../config/app_flavor.dart';

class FieldApiException implements Exception {
  FieldApiException(this.message, {this.statusCode, this.body, this.code});

  final String message;
  final int? statusCode;
  final String? body;
  final String? code;

  @override
  String toString() => 'FieldApiException($statusCode): $message';
}

class FieldApiClient {
  FieldApiClient({
    http.Client? httpClient,
    String? baseUrl,
    this.accessToken,
    bool skipEnvGuard = false,
  })  : _http = httpClient ?? http.Client(),
        baseUrl = baseUrl ?? ApiConfig.resolveBaseUrl() {
    if (!skipEnvGuard) {
      assertApiBaseUrlMatchesFlavor(AppFlavor.firebaseEnv, this.baseUrl);
    }
  }

  final http.Client _http;
  final String baseUrl;
  String? accessToken;

  Map<String, String> _headers({bool jsonBody = true}) {
    final headers = <String, String>{
      if (jsonBody) 'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-The-Eye-Client': 'field-tablet',
    };
    if (accessToken != null && accessToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    return headers;
  }

  Uri _uri(String path, [Map<String, String>? query]) {
    final uri = Uri.parse('$baseUrl$path');
    if (query == null || query.isEmpty) return uri;
    return uri.replace(queryParameters: query);
  }

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
    Map<String, String>? query,
  }) async {
    final response = await _http.post(
      _uri(path, query),
      headers: {..._headers(), ...?headers},
      body: jsonEncode(body ?? const {}),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? headers,
    Map<String, String>? query,
  }) async {
    final response = await _http.get(
      _uri(path, query),
      headers: {..._headers(jsonBody: false), ...?headers},
    );
    return _decode(response);
  }

  Map<String, dynamic> _decode(http.Response response) {
    final raw = response.body.isEmpty ? '{}' : response.body;
    Map<String, dynamic> decoded;
    try {
      decoded = jsonDecode(raw) as Map<String, dynamic>;
    } catch (_) {
      decoded = {'message': raw};
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      final nested = decoded['message'];
      String message;
      String? code;
      if (nested is Map) {
        message = nested['message']?.toString() ?? 'Request failed';
        code = nested['code']?.toString();
      } else {
        message = nested?.toString() ??
            decoded['error']?.toString() ??
            'Request failed';
        code = decoded['code']?.toString();
      }
      throw FieldApiException(
        message,
        statusCode: response.statusCode,
        body: raw,
        code: code,
      );
    }
    return decoded;
  }

  void dispose() => _http.close();
}
