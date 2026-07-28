import "package:geocoding/geocoding.dart";

/// Reverse-geocodes coordinates into human-readable locality fields.
abstract class LocationReverseGeocoder {
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  });
}

class ReverseGeocodeResult {
  const ReverseGeocodeResult({
    this.locality,
    this.lga,
    this.state,
    this.country,
  });

  final String? locality;
  final String? lga;
  final String? state;
  final String? country;

  bool get hasAnyLabel =>
      (locality?.trim().isNotEmpty ?? false) ||
      (state?.trim().isNotEmpty ?? false) ||
      (country?.trim().isNotEmpty ?? false);
}

class PlatformLocationReverseGeocoder implements LocationReverseGeocoder {
  const PlatformLocationReverseGeocoder();

  @override
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  }) async {
    try {
      final placemarks = await placemarkFromCoordinates(latitude, longitude);
      if (placemarks.isEmpty) {
        return const ReverseGeocodeResult();
      }
      final place = placemarks.first;
      final locality = _firstNonEmpty([
        place.locality,
        place.subAdministrativeArea,
        place.name,
      ]);
      final lga = _firstNonEmpty([
        place.subAdministrativeArea,
        place.locality,
      ]);
      final state = _firstNonEmpty([
        place.administrativeArea,
        place.subAdministrativeArea,
      ]);
      final country = place.country?.trim();
      return ReverseGeocodeResult(
        locality: locality,
        lga: lga,
        state: state,
        country: country,
      );
    } catch (_) {
      return const ReverseGeocodeResult();
    }
  }

  String? _firstNonEmpty(List<String?> values) {
    for (final value in values) {
      final trimmed = value?.trim();
      if (trimmed != null && trimmed.isNotEmpty) return trimmed;
    }
    return null;
  }
}
