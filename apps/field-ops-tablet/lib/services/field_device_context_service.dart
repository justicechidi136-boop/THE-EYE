import 'package:battery_plus/battery_plus.dart';
import 'package:geocoding/geocoding.dart';

class FieldDeviceContextService {
  FieldDeviceContextService({Battery? battery})
    : _battery = battery ?? Battery();

  final Battery _battery;

  Future<int?> readBatteryLevel() async {
    try {
      final level = await _battery.batteryLevel;
      return level >= 0 && level <= 100 ? level : null;
    } on Object {
      return null;
    }
  }

  Future<String?> reverseGeocode({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final placemarks = await placemarkFromCoordinates(
        latitude,
        longitude,
      ).timeout(const Duration(seconds: 5));
      if (placemarks.isEmpty) return null;
      final place = placemarks.first;
      return formatLocation(
        street: place.street,
        subLocality: place.subLocality,
        locality: place.locality,
        administrativeArea: place.administrativeArea,
        country: place.country,
      );
    } on Object {
      return null;
    }
  }

  static String? formatLocation({
    String? street,
    String? subLocality,
    String? locality,
    String? administrativeArea,
    String? country,
  }) {
    final parts = <String>[];
    for (final value in [
      street,
      subLocality,
      locality,
      administrativeArea,
      country,
    ]) {
      final normalized = value?.trim();
      if (normalized == null || normalized.isEmpty) continue;
      if (!parts.any(
        (part) => part.toLowerCase() == normalized.toLowerCase(),
      )) {
        parts.add(normalized);
      }
    }
    if (parts.isEmpty) return null;
    return parts.take(3).join(', ');
  }
}
