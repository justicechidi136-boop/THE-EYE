import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/watch_api_config.dart';
import '../config/watch_flavor.dart';

class WatchApiException implements Exception {
  WatchApiException(this.message, {this.statusCode, this.body});

  final String message;
  final int? statusCode;
  final String? body;

  @override
  String toString() => 'WatchApiException($statusCode): $message';
}

class WatchApiClient {
  WatchApiClient({
    http.Client? httpClient,
    String? baseUrl,
    this.accessToken,
    this.deviceSecret,
    bool skipEnvGuard = false,
  })  : _http = httpClient ?? http.Client(),
        baseUrl = baseUrl ?? WatchApiConfig.resolveBaseUrl() {
    if (!skipEnvGuard) {
      assertWatchApiBaseUrlMatchesFlavor(WatchFlavor.firebaseEnv, this.baseUrl);
    }
  }

  final http.Client _http;
  final String baseUrl;
  String? accessToken;
  String? deviceSecret;

  Map<String, String> _headers({bool jsonBody = true}) {
    final headers = <String, String>{
      if (jsonBody) 'Content-Type': 'application/json',
      'Accept': 'application/json',
      'X-The-Eye-Client': 'watch-os',
    };
    if (accessToken != null && accessToken!.isNotEmpty) {
      headers['Authorization'] = 'Bearer $accessToken';
    }
    return headers;
  }

  Uri _uri(String path) => Uri.parse('$baseUrl$path');

  Future<Map<String, dynamic>> post(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    final response = await _http.post(
      _uri(path),
      headers: {..._headers(), ...?headers},
      body: jsonEncode(body ?? const {}),
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> get(
    String path, {
    Map<String, String>? query,
    Map<String, String>? headers,
  }) async {
    final uri = _uri(path).replace(queryParameters: query);
    final response = await _http.get(
      uri,
      headers: {..._headers(jsonBody: false), ...?headers},
    );
    return _decode(response);
  }

  Future<Map<String, dynamic>> patch(
    String path, {
    Map<String, dynamic>? body,
    Map<String, String>? headers,
  }) async {
    final response = await _http.patch(
      _uri(path),
      headers: {..._headers(), ...?headers},
      body: jsonEncode(body ?? const {}),
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
      final message = decoded['message']?.toString() ??
          decoded['error']?.toString() ??
          'Request failed';
      throw WatchApiException(
        message,
        statusCode: response.statusCode,
        body: raw,
      );
    }
    return decoded;
  }

  void dispose() => _http.close();
}
