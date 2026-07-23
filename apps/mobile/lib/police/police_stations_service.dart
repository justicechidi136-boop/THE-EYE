import "dart:convert";

import "../contracts/the_eye_api_client.dart";
import "../contracts/the_eye_api_paths.dart";
import "../incidents/incident_submission_service.dart";

class PoliceStationItem {
  const PoliceStationItem({
    required this.id,
    required this.name,
    required this.phone,
    required this.address,
    required this.agencyType,
    required this.latitude,
    required this.longitude,
    this.distanceMeters,
    this.navigationUrl,
    this.state,
    this.lga,
  });

  final String id;
  final String name;
  final String? phone;
  final String address;
  final String agencyType;
  final double latitude;
  final double longitude;
  final double? distanceMeters;
  final String? navigationUrl;
  final String? state;
  final String? lga;

  factory PoliceStationItem.fromJson(Map<String, dynamic> json) {
    final jurisdiction = json["jurisdiction"] as Map<String, dynamic>?;
    return PoliceStationItem(
      id: (json["id"] as String?) ?? "",
      name: (json["name"] as String?) ?? "Police station",
      phone: json["phone"] as String?,
      address: (json["address"] as String?) ?? "",
      agencyType: (json["agencyType"] as String?) ??
          (json["agency_type"] as String?) ??
          "police",
      latitude: (json["latitude"] as num?)?.toDouble() ?? 0,
      longitude: (json["longitude"] as num?)?.toDouble() ?? 0,
      distanceMeters: (json["distance_meters"] as num?)?.toDouble() ??
          (json["distanceMeters"] as num?)?.toDouble(),
      navigationUrl: json["navigationUrl"] as String?,
      state: jurisdiction?["state"] as String? ?? json["state"] as String?,
      lga: jurisdiction?["lga"] as String? ?? json["lga"] as String?,
    );
  }

  String get distanceLabel {
    if (distanceMeters == null) return "";
    if (distanceMeters! < 1000) {
      return "${distanceMeters!.round()} m";
    }
    return "${(distanceMeters! / 1000).toStringAsFixed(1)} km";
  }

  bool get canCall => phone != null && phone!.trim().length >= 7;
}

class PoliceStationsService {
  PoliceStationsService({TheEyeApiClient? apiClient})
      : _api = apiClient ?? TheEyeApiClient();

  final TheEyeApiClient _api;

  Future<List<PoliceStationItem>> list({
    String? state,
    String? lga,
    String? search,
    double? latitude,
    double? longitude,
    int radiusMeters = 25000,
    int limit = 25,
  }) async {
    final query = <String, String>{
      "limit": "$limit",
      if (state != null && state.isNotEmpty) "state": state,
      if (lga != null && lga.isNotEmpty) "lga": lga,
      if (search != null && search.isNotEmpty) "search": search,
      if (latitude != null) "latitude": "$latitude",
      if (longitude != null) "longitude": "$longitude",
      if (latitude != null && longitude != null) "radius": "$radiusMeters",
    };
    final response = await _api.getJson(
      TheEyeApiPaths.policeStations,
      query: query,
    );
    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw IncidentApiException.fromResponse(response);
    }
    final decoded = jsonDecode(response.body);
    final rows = decoded is Map && decoded["data"] is List
        ? decoded["data"] as List
        : const [];
    return rows
        .whereType<Map>()
        .map(
            (row) => PoliceStationItem.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }
}
