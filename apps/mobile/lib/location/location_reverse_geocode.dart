import "package:geocoding/geocoding.dart";

/// Reverse-geocodes coordinates into human-readable locality fields.
abstract class LocationReverseGeocoder {
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  });
}

class CachedLocationReverseGeocoder implements LocationReverseGeocoder {
  CachedLocationReverseGeocoder({
    LocationReverseGeocoder? delegate,
    this.ttl = const Duration(minutes: 15),
    DateTime Function()? clock,
  })  : _delegate = delegate ?? const PlatformLocationReverseGeocoder(),
        _clock = clock ?? DateTime.now;

  final LocationReverseGeocoder _delegate;
  final Duration ttl;
  final DateTime Function() _clock;
  final Map<String, ({ReverseGeocodeResult result, DateTime expiresAt})>
      _cache = {};
  final Map<String, Future<ReverseGeocodeResult>> _inFlight = {};

  @override
  Future<ReverseGeocodeResult> lookup({
    required double latitude,
    required double longitude,
  }) {
    final key =
        "${latitude.toStringAsFixed(4)},${longitude.toStringAsFixed(4)}";
    final now = _clock();
    final cached = _cache[key];
    if (cached != null && cached.expiresAt.isAfter(now)) {
      return Future.value(cached.result);
    }
    final active = _inFlight[key];
    if (active != null) return active;
    final lookup = _delegate
        .lookup(latitude: latitude, longitude: longitude)
        .then((result) {
      _cache[key] = (result: result, expiresAt: _clock().add(ttl));
      return result;
    }).whenComplete(() {
      _inFlight.remove(key);
    });
    _inFlight[key] = lookup;
    return lookup;
  }
}

class ReverseGeocodeResult {
  const ReverseGeocodeResult({
    this.street,
    this.subLocality,
    this.locality,
    this.lga,
    this.state,
    this.country,
  });

  final String? street;
  final String? subLocality;

  final String? locality;
  final String? lga;
  final String? state;
  final String? country;

  bool get hasAnyLabel =>
      (street?.trim().isNotEmpty ?? false) ||
      (subLocality?.trim().isNotEmpty ?? false) ||
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
      final lga = _firstNonEmpty([place.subAdministrativeArea, place.locality]);
      final state = _firstNonEmpty([
        place.administrativeArea,
        place.subAdministrativeArea,
      ]);
      final country = place.country?.trim();
      return ReverseGeocodeResult(
        street: _firstNonEmpty([place.thoroughfare, place.street]),
        subLocality: _firstNonEmpty([place.subLocality, place.name]),
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
