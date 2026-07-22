import "package:shared_preferences/shared_preferences.dart";
import "package:uuid/uuid.dart";

const _deviceIdKey = "the_eye.mobile.device_id";

Future<String> resolveMobileDeviceId() async {
  final prefs = await SharedPreferences.getInstance();
  final existing = prefs.getString(_deviceIdKey);
  if (existing != null && existing.isNotEmpty) return existing;
  final generated = "mobile-${const Uuid().v4()}";
  await prefs.setString(_deviceIdKey, generated);
  return generated;
}
