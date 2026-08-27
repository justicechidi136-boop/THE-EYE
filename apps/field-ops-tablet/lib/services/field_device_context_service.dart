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
        name: place.name,
        subThoroughfare: place.subThoroughfare,
        thoroughfare: place.thoroughfare,
        street: place.street,
        subLocality: place.subLocality,
        locality: place.locality,
        subAdministrativeArea: place.subAdministrativeArea,
        administrativeArea: place.administrativeArea,
        country: place.country,
      );
    } on Object {
      return null;
    }
  }

  static String? formatLocation({
    String? name,
    String? subThoroughfare,
    String? thoroughfare,
    String? street,
    String? subLocality,
    String? locality,
    String? subAdministrativeArea,
    String? administrativeArea,
    String? country,
  }) {
    final road = [subThoroughfare, thoroughfare]
        .map((value) => value?.trim())
        .whereType<String>()
        .where((value) => value.isNotEmpty && !_looksLikePlusCode(value))
        .join(' ');
    final readableStreet =
        road.isNotEmpty
            ? road
            : [street, name]
                .map((value) => value?.trim())
                .whereType<String>()
                .firstWhere(
                  (value) => value.isNotEmpty && !_looksLikePlusCode(value),
                  orElse: () => '',
                );
    final parts = <String>[];
    for (final value in [
      readableStreet,
      subLocality,
      locality,
      subAdministrativeArea,
      administrativeArea,
    ]) {
      final normalized = value?.trim();
      if (normalized == null || normalized.isEmpty) continue;
      if (!parts.any(
        (part) => part.toLowerCase() == normalized.toLowerCase(),
      )) {
        parts.add(normalized);
      }
    }
    final normalizedCountry = country?.trim();
    if (parts.isEmpty &&
        normalizedCountry != null &&
        normalizedCountry.isNotEmpty) {
      parts.add(normalizedCountry);
    }
    if (parts.isEmpty) return null;
    return parts.take(4).join(', ');
  }

  static bool _looksLikePlusCode(String value) {
    final compact = value.replaceAll(' ', '').toUpperCase();
    return RegExp(
      r'^[23456789CFGHJMPQRVWX]{4,8}\+[23456789CFGHJMPQRVWX]{2,3}',
    ).hasMatch(compact);
  }

  static String withMeasuredAccuracy(String location, double accuracyMeters) {
    final accuracy = accuracyMeters.isFinite ? accuracyMeters.round() : 0;
    return accuracy > 0 ? '$location · GPS accuracy: $accuracy m' : location;
  }
}
