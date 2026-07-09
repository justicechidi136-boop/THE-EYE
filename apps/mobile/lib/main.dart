import "dart:async";
import "dart:convert";

import "package:flutter/material.dart";
import "package:geolocator/geolocator.dart";
import "package:http/http.dart" as http;
import "package:url_launcher/url_launcher.dart";

const theEyeApiUrl = String.fromEnvironment("THE_EYE_API_URL", defaultValue: "http://localhost:3001");

void main() {
  runApp(const TheEyeApp());
}

class TheEyeApp extends StatefulWidget {
  const TheEyeApp({super.key});

  @override
  State<TheEyeApp> createState() => _TheEyeAppState();
}

class _TheEyeAppState extends State<TheEyeApp> {
  final AppController controller = AppController();

  @override
  Widget build(BuildContext context) {
    return AppScope(
      controller: controller,
      child: AnimatedBuilder(
        animation: controller,
        builder: (context, _) {
          return MaterialApp(
            title: "THE EYE",
            debugShowCheckedModeBanner: false,
            theme: buildTheme(controller.highContrastMode),
            routes: {
              "/": (_) => const SplashScreen(),
              "/login": (_) => const LoginRegisterScreen(),
              "/home": (_) => const HomeScreen(),
              "/report/emergency": (_) => const ReportScreen(type: ReportType.emergency),
              "/live-video": (_) => const LiveEmergencyVideoScreen(),
              "/report/crime": (_) => const ReportScreen(type: ReportType.crime),
              "/report/accident": (_) => const ReportScreen(type: ReportType.accident),
              "/report/fire": (_) => const ReportScreen(type: ReportType.fire),
              "/report/kidnapping": (_) => const ReportScreen(type: ReportType.kidnapping),
              "/report/abuse": (_) => const ReportScreen(type: ReportType.abuse),
              "/report/suspicious-activity": (_) => const ReportScreen(type: ReportType.suspiciousActivity),
              "/missing-person": (_) => const MissingPersonBroadcastScreen(),
              "/stolen-vehicle": (_) => const StolenVehicleBroadcastScreen(),
              "/broadcasts": (_) => const BroadcastCenterScreen(),
              "/police-stations": (_) => const NearbyPoliceStationsScreen(),
              "/notifications": (_) => const NotificationsScreen(),
              "/tracking": (_) => const IncidentTrackingScreen(),
              "/family": (_) => const FamilySafetyCircleScreen(),
              "/smartwatch": (_) => const SmartwatchDeviceScreen(),
              "/neighborhood-watch": (_) => const NeighborhoodWatchHomeScreen(),
              "/neighborhood-watch/communities": (_) => const MyCommunitiesScreen(),
              "/neighborhood-watch/join": (_) => const JoinCommunityScreen(),
              "/neighborhood-watch/feed": (_) => const CommunityFeedScreen(),
              "/neighborhood-watch/create": (_) => const CreateCommunityPostScreen(),
              "/neighborhood-watch/map": (_) => const CommunityMapScreen(),
              "/neighborhood-watch/chat": (_) => const CommunityChatScreen(),
              "/neighborhood-watch/volunteers": (_) => const VolunteersScreen(),
              "/neighborhood-watch/patrols": (_) => const PatrolsScreen(),
              "/neighborhood-watch/alerts": (_) => const CommunityAlertsScreen(),
              "/profile": (_) => const ProfileScreen(),
              "/settings": (_) => const SettingsScreen(),
            },
          );
        },
      ),
    );
  }
}

ThemeData buildTheme(bool highContrast) {
  final scheme = highContrast
      ? ColorScheme.fromSeed(seedColor: const Color(0xFF000000)).copyWith(
          primary: Colors.black,
          onPrimary: Colors.white,
          secondary: const Color(0xFFFFD400),
          onSecondary: Colors.black,
          error: const Color(0xFFB00020),
          surface: Colors.white,
          onSurface: Colors.black,
        )
      : ColorScheme.fromSeed(seedColor: const Color(0xFF0B6B58));

  return ThemeData(
    colorScheme: scheme,
    useMaterial3: true,
    scaffoldBackgroundColor: highContrast ? Colors.white : const Color(0xFFF3F6F8),
    textTheme: const TextTheme(
      headlineSmall: TextStyle(fontWeight: FontWeight.w800),
      titleLarge: TextStyle(fontWeight: FontWeight.w800),
      titleMedium: TextStyle(fontWeight: FontWeight.w700),
      labelLarge: TextStyle(fontWeight: FontWeight.w800),
    ),
    filledButtonTheme: FilledButtonThemeData(
      style: FilledButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    outlinedButtonTheme: OutlinedButtonThemeData(
      style: OutlinedButton.styleFrom(
        minimumSize: const Size.fromHeight(56),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
      ),
    ),
    inputDecorationTheme: InputDecorationTheme(
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(14)),
      filled: true,
      fillColor: highContrast ? Colors.white : Colors.white,
    ),
  );
}

enum ReportType { emergency, crime, accident, fire, kidnapping, abuse, suspiciousActivity }

extension ReportTypeLabel on ReportType {
  String get label {
    switch (this) {
      case ReportType.emergency:
        return "Emergency";
      case ReportType.crime:
        return "Crime";
      case ReportType.accident:
        return "Accident";
      case ReportType.fire:
        return "Fire";
      case ReportType.kidnapping:
        return "Kidnapping";
      case ReportType.abuse:
        return "Abuse";
      case ReportType.suspiciousActivity:
        return "Suspicious activity";
    }
  }
}

class AppController extends ChangeNotifier {
  bool highContrastMode = false;
  bool lowDataMode = false;
  bool online = true;
  final List<OfflineDraft> offlineDrafts = [];
  final List<IncidentStatus> incidents = [
    IncidentStatus("INC-2407-001", "Emergency", "Assigned", "Ikeja Police Command", 91),
    IncidentStatus("INC-2407-002", "Missing person", "Verifying", "Lagos Emergency Response Unit", 74),
  ];
  final List<BroadcastAlert> notifications = [
    BroadcastAlert("Emergency alert", "Verified P1 emergency auto-alert", "5 km from your current area", "P1", "Delivered", false),
    BroadcastAlert("Nearby danger warning", "Safety alert for Allen Avenue", "1.2 km away", "P2", "Queued", false),
    BroadcastAlert("Missing person alert", "Missing person broadcast is under verification", "Ikeja priority area", "P2", "Pending", true),
  ];

  void toggleHighContrast(bool value) {
    highContrastMode = value;
    notifyListeners();
  }

  void toggleLowData(bool value) {
    lowDataMode = value;
    notifyListeners();
  }

  void toggleOnline(bool value) {
    online = value;
    if (online) {
      offlineDrafts.clear();
      notifications.insert(0, BroadcastAlert("Incident status update", "Offline drafts were sent successfully", "Your saved reports were submitted", "Info", "Delivered", false));
    }
    notifyListeners();
  }

  void submitDraft(String title, String type) {
    if (!online) {
      offlineDrafts.add(OfflineDraft(title, type, DateTime.now()));
      notifications.insert(0, BroadcastAlert("Incident status update", "$type saved offline", "Will send when internet returns", "Info", "Queued", false));
    } else {
      incidents.insert(0, IncidentStatus("INC-${2407 + incidents.length}-00${incidents.length + 3}", type, "Submitted", "Awaiting assignment", type == "Emergency" ? 88 : 67));
      notifications.insert(0, BroadcastAlert("Incident status update", "$type submitted to THE EYE command center", "Command center intake", "Info", "Delivered", false));
    }
    notifyListeners();
  }
}

class OfflineDraft {
  OfflineDraft(this.title, this.type, this.createdAt);

  final String title;
  final String type;
  final DateTime createdAt;
}

class IncidentStatus {
  IncidentStatus(this.id, this.type, this.status, this.agency, this.confidence);

  final String id;
  final String type;
  final String status;
  final String agency;
  final int confidence;
}

class BroadcastAlert {
  BroadcastAlert(this.type, this.title, this.area, this.priority, this.delivery, this.read);

  final String type;
  final String title;
  final String area;
  final String priority;
  final String delivery;
  final bool read;
}

class AppScope extends InheritedNotifier<AppController> {
  const AppScope({required AppController controller, required super.child, super.key}) : super(notifier: controller);

  static AppController of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<AppScope>();
    assert(scope != null, "AppScope not found");
    return scope!.notifier!;
  }
}

class SplashScreen extends StatefulWidget {
  const SplashScreen({super.key});

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> {
  @override
  void initState() {
    super.initState();
    Timer(const Duration(milliseconds: 900), () {
      if (mounted) Navigator.of(context).pushReplacementNamed("/login");
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF111820),
      body: SafeArea(
        child: Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                height: 112,
                width: 112,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: const Color(0xFF0B6B58),
                  borderRadius: BorderRadius.circular(56),
                  border: Border.all(color: Colors.white, width: 4),
                ),
                child: const Icon(Icons.visibility, color: Colors.white, size: 56),
              ),
              const SizedBox(height: 24),
              const Text("THE EYE", style: TextStyle(color: Colors.white, fontSize: 34, fontWeight: FontWeight.w900)),
              const SizedBox(height: 8),
              const Text("Citizen safety app", style: TextStyle(color: Colors.white70, fontSize: 16)),
            ],
          ),
        ),
      ),
    );
  }
}

class LoginRegisterScreen extends StatelessWidget {
  const LoginRegisterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: SizedBox(
        width: MediaQuery.sizeOf(context).width - 40,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.red.shade700,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(62),
          ),
          onPressed: () => _openSos(context),
          icon: const Icon(Icons.sos),
          label: const Text("SOS"),
        ),
      ),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(20, 20, 20, 110),
          children: [
            const SizedBox(height: 24),
            const Text("THE EYE", style: TextStyle(fontSize: 32, fontWeight: FontWeight.w900)),
            const SizedBox(height: 8),
            Text("Sign in to report, track, and receive safety alerts.", style: Theme.of(context).textTheme.bodyLarge),
            const SizedBox(height: 28),
            const TextField(decoration: InputDecoration(labelText: "Email or phone number")),
            const SizedBox(height: 14),
            const TextField(obscureText: true, decoration: InputDecoration(labelText: "Password")),
            const SizedBox(height: 18),
            FilledButton(
              onPressed: () => Navigator.of(context).pushReplacementNamed("/home"),
              child: const Text("Login"),
            ),
            const SizedBox(height: 12),
            OutlinedButton(
              onPressed: () => Navigator.of(context).pushReplacementNamed("/home"),
              child: const Text("Register"),
            ),
            const SizedBox(height: 12),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pushReplacementNamed("/home"),
              icon: const Icon(Icons.g_mobiledata),
              label: const Text("Continue with Google"),
            ),
          ],
        ),
      ),
    );
  }
}

class HomeScreen extends StatelessWidget {
  const HomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return SafetyScaffold(
      title: "Home",
      selectedIndex: 0,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          StatusStrip(controller: controller),
          const SizedBox(height: 16),
          EmergencyHero(onPressed: () => _openSos(context)),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: MediaQuery.sizeOf(context).width > 640 ? 3 : 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            childAspectRatio: 1.15,
            children: [
              ActionTile("Report emergency", Icons.emergency, Colors.red.shade700, () => Navigator.of(context).pushNamed("/report/emergency")),
              ActionTile("Live emergency video", Icons.videocam, Colors.red.shade900, () => Navigator.of(context).pushNamed("/live-video")),
              ActionTile("Report crime", Icons.local_police, Colors.indigo.shade700, () => Navigator.of(context).pushNamed("/report/crime")),
              ActionTile("Report accident", Icons.car_crash, Colors.orange.shade800, () => Navigator.of(context).pushNamed("/report/accident")),
              ActionTile("Fire report", Icons.local_fire_department, Colors.deepOrange.shade700, () => Navigator.of(context).pushNamed("/report/fire")),
              ActionTile("Kidnapping report", Icons.report, Colors.red.shade900, () => Navigator.of(context).pushNamed("/report/kidnapping")),
              ActionTile("Abuse report", Icons.health_and_safety, Colors.pink.shade700, () => Navigator.of(context).pushNamed("/report/abuse")),
              ActionTile("Suspicious activity", Icons.visibility, Colors.amber.shade900, () => Navigator.of(context).pushNamed("/report/suspicious-activity")),
              ActionTile("Missing person", Icons.person_search, Colors.teal.shade700, () => Navigator.of(context).pushNamed("/missing-person")),
              ActionTile("Stolen vehicle", Icons.directions_car, Colors.blueGrey.shade700, () => Navigator.of(context).pushNamed("/stolen-vehicle")),
              ActionTile("Police stations", Icons.location_on, Colors.green.shade700, () => Navigator.of(context).pushNamed("/police-stations")),
              ActionTile("SOS device", Icons.watch, Colors.red.shade800, () => Navigator.of(context).pushNamed("/smartwatch")),
              ActionTile("Neighborhood Watch", Icons.groups, Colors.teal.shade800, () => Navigator.of(context).pushNamed("/neighborhood-watch")),
              ActionTile("Safety broadcasts", Icons.campaign, Colors.purple.shade700, () => Navigator.of(context).pushNamed("/broadcasts")),
              ActionTile("Notifications", Icons.notifications_active, Colors.green.shade800, () => Navigator.of(context).pushNamed("/notifications")),
              ActionTile("Incident status", Icons.radar, Colors.cyan.shade800, () => Navigator.of(context).pushNamed("/tracking")),
            ],
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Active incidents",
            child: Column(
              children: controller.incidents.take(2).map((incident) => IncidentStatusTile(incident: incident)).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class ReportScreen extends StatefulWidget {
  const ReportScreen({required this.type, super.key});

  final ReportType type;

  @override
  State<ReportScreen> createState() => _ReportScreenState();
}

class _ReportScreenState extends State<ReportScreen> {
  bool anonymous = false;
  bool notifyEmergencyContact = true;
  bool manualLocation = false;
  final descriptionController = TextEditingController();

  @override
  void dispose() {
    descriptionController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Report ${widget.type.label.toLowerCase()}",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          if (widget.type == ReportType.emergency)
            FilledButton.icon(
              style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
              onPressed: () => _submit(context),
              icon: const Icon(Icons.flash_on),
              label: const Text("Send emergency now"),
            ),
          if (widget.type == ReportType.emergency) ...[
            const SizedBox(height: 10),
            OutlinedButton.icon(
              onPressed: () => Navigator.of(context).pushNamed("/live-video"),
              icon: const Icon(Icons.videocam),
              label: const Text("Start live emergency video"),
            ),
          ],
          const SizedBox(height: 14),
          TextField(
            controller: descriptionController,
            maxLines: 4,
            decoration: InputDecoration(labelText: "${widget.type.label} description"),
          ),
          const SizedBox(height: 14),
          SwitchListTile(
            value: manualLocation,
            onChanged: (value) => setState(() => manualLocation = value),
            title: const Text("Manual location adjustment"),
            subtitle: const Text("GPS is captured automatically"),
          ),
          if (manualLocation) ...[
            const SizedBox(height: 8),
            const TextField(decoration: InputDecoration(labelText: "Adjusted location")),
          ],
          const SizedBox(height: 14),
          AttachmentPicker(lowDataMode: AppScope.of(context).lowDataMode),
          const SizedBox(height: 10),
          SwitchListTile(
            value: anonymous,
            onChanged: (value) => setState(() => anonymous = value),
            title: const Text("Report anonymously"),
          ),
          SwitchListTile(
            value: notifyEmergencyContact,
            onChanged: (value) => setState(() => notifyEmergencyContact = value),
            title: const Text("Notify emergency contact"),
          ),
          const SizedBox(height: 14),
          FilledButton(
            onPressed: () => _submit(context),
            child: Text("Submit ${widget.type.label} report"),
          ),
        ],
      ),
    );
  }

  void _submit(BuildContext context) {
    final controller = AppScope.of(context);
    // TODO: Replace local draft mutation with the incident submission API once mobile auth tokens are wired.
    controller.submitDraft(descriptionController.text.trim().isEmpty ? widget.type.label : descriptionController.text.trim(), widget.type.label);
    Navigator.of(context).pushNamed("/tracking");
  }
}

class MissingPersonBroadcastScreen extends StatelessWidget {
  const MissingPersonBroadcastScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Missing person",
      body: BroadcastForm(
        icon: Icons.person_search,
        title: "Missing person broadcast",
        fields: const ["Full name", "Age", "Last seen location", "Clothing or identifiers"],
        onSubmit: () {
          AppScope.of(context).submitDraft("Missing person broadcast", "Missing person");
          Navigator.of(context).pushNamed("/tracking");
        },
      ),
    );
  }
}

class LiveEmergencyVideoScreen extends StatefulWidget {
  const LiveEmergencyVideoScreen({super.key});

  @override
  State<LiveEmergencyVideoScreen> createState() => _LiveEmergencyVideoScreenState();
}

class _LiveEmergencyVideoScreenState extends State<LiveEmergencyVideoScreen> {
  bool lowBandwidth = true;
  bool streaming = false;
  bool locationDenied = false;
  String roomName = "eye-incident-active-emergency";
  String liveSessionId = "LVS-001";
  Position? latestPosition;
  Timer? locationTimer;

  @override
  void dispose() {
    locationTimer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Live emergency video",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Container(
            height: 360,
            decoration: BoxDecoration(
              color: streaming ? const Color(0xFF111820) : const Color(0xFFE7EDF0),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFD8DEE4)),
            ),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(streaming ? Icons.videocam : Icons.videocam_off, size: 72, color: streaming ? Colors.white : const Color(0xFF0B6B58)),
                  const SizedBox(height: 12),
                  Text(streaming ? "Live stream active" : "Camera ready", style: TextStyle(fontSize: 20, fontWeight: FontWeight.w900, color: streaming ? Colors.white : Colors.black)),
                  const SizedBox(height: 6),
                  Text(roomName, style: TextStyle(color: streaming ? Colors.white70 : const Color(0xFF5C6670))),
                  if (latestPosition != null) ...[
                    const SizedBox(height: 12),
                    Text("${latestPosition!.latitude.toStringAsFixed(6)}, ${latestPosition!.longitude.toStringAsFixed(6)}", style: TextStyle(color: streaming ? Colors.white : Colors.black, fontWeight: FontWeight.w800)),
                    Text("Accuracy ±${latestPosition!.accuracy.toStringAsFixed(0)}m", style: TextStyle(color: streaming ? Colors.white70 : const Color(0xFF5C6670))),
                  ],
                ],
              ),
            ),
          ),
          const SizedBox(height: 16),
          if (locationDenied) ...[
            Container(
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(color: const Color(0xFFFFF1F0), borderRadius: BorderRadius.circular(16), border: Border.all(color: Colors.red.shade200)),
              child: const Text("Emergency live video requires location permission so authorized emergency admins can verify the stream location."),
            ),
            const SizedBox(height: 16),
          ],
          SectionCard(
            title: "LiveKit emergency stream",
            child: Column(
              children: [
                SwitchListTile(
                  value: lowBandwidth,
                  onChanged: streaming ? null : (value) => setState(() => lowBandwidth = value),
                  title: const Text("Emergency low-bandwidth mode"),
                  subtitle: const Text("Prioritizes audio and lower video bitrate for weak networks"),
                ),
                const SizedBox(height: 8),
                FilledButton.icon(
                  style: FilledButton.styleFrom(backgroundColor: streaming ? Colors.black : Colors.red.shade700),
                  onPressed: () => streaming ? _stopStream(context) : _startStream(context),
                  icon: Icon(streaming ? Icons.stop_circle : Icons.play_circle),
                  label: Text(streaming ? "Stop live video" : "Start live video"),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Location sharing",
            child: Text(streaming
                ? "Your live GPS is being shared with authorized emergency admins every 5 seconds."
                : "Location is captured before the LiveKit stream starts and stored with the evidence timeline."),
          ),
        ],
      ),
    );
  }

  Future<void> _startStream(BuildContext context) async {
    final position = await _captureLocation();
    if (position == null) {
      setState(() => locationDenied = true);
      return;
    }
    setState(() {
      latestPosition = position;
      locationDenied = false;
      streaming = true;
      roomName = "eye-incident-inc-2407-001";
    });
    AppScope.of(context).submitDraft("Live emergency video started with GPS", "Emergency");
    await _startBackendSession(position);
    locationTimer?.cancel();
    locationTimer = Timer.periodic(const Duration(seconds: 5), (_) => _sendGpsUpdate());
  }

  void _stopStream(BuildContext context) {
    locationTimer?.cancel();
    setState(() => streaming = false);
    AppScope.of(context).submitDraft("Live emergency video stopped", "Emergency");
  }

  Future<Position?> _captureLocation() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return null;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return null;
    return Geolocator.getCurrentPosition(desiredAccuracy: lowBandwidth ? LocationAccuracy.medium : LocationAccuracy.high);
  }

  Future<void> _sendGpsUpdate() async {
    final position = await _captureLocation();
    if (position == null || !mounted) return;
    setState(() => latestPosition = position);
    await _postGpsUpdate(position);
  }

  Future<void> _startBackendSession(Position position) async {
    try {
      final response = await http.post(
        Uri.parse("$theEyeApiUrl/live-video/incidents/INC-2407-001/start"),
        headers: {"content-type": "application/json"},
        body: jsonEncode(_gpsPayload(position)..["lowBandwidthMode"] = lowBandwidth),
      );
      final body = jsonDecode(response.body);
      final id = body is Map && body["data"] is Map ? body["data"]["id"] : null;
      if (id is String && mounted) setState(() => liveSessionId = id);
    } catch (_) {
      if (mounted) setState(() => liveSessionId = "offline-live-session");
    }
  }

  Future<void> _postGpsUpdate(Position position) async {
    try {
      await http.post(
        Uri.parse("$theEyeApiUrl/live-video/sessions/$liveSessionId/location"),
        headers: {"content-type": "application/json"},
        body: jsonEncode(_gpsPayload(position)),
      );
    } catch (_) {
      AppScope.of(context).notifications.insert(0, BroadcastAlert("Incident status update", "GPS update queued", "Will retry when connection improves", "Info", "Queued", false));
    }
  }

  Map<String, Object?> _gpsPayload(Position position) {
    return {
      "latitude": position.latitude,
      "longitude": position.longitude,
      "accuracy": position.accuracy,
      "speed": position.speed,
      "heading": position.heading,
      "altitude": position.altitude,
      "capturedAt": (position.timestamp ?? DateTime.now()).toUtc().toIso8601String(),
      "sourceDeviceId": "mobile-primary",
    };
  }
}

class StolenVehicleBroadcastScreen extends StatelessWidget {
  const StolenVehicleBroadcastScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Stolen vehicle",
      body: BroadcastForm(
        icon: Icons.directions_car,
        title: "Stolen vehicle broadcast",
        fields: const ["Plate number", "Make and model", "Color", "Last seen location"],
        onSubmit: () {
          AppScope.of(context).submitDraft("Stolen vehicle broadcast", "Stolen vehicle");
          Navigator.of(context).pushNamed("/tracking");
        },
      ),
    );
  }
}

class BroadcastCenterScreen extends StatelessWidget {
  const BroadcastCenterScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alerts = [
      ("Emergency broadcast", "P1", "Verified emergency near Allen Avenue", "1.2 km away", Icons.emergency, Colors.red.shade700),
      ("Missing person broadcast", "P2", "Missing child last seen near Ikeja terminal", "Ikeja LGA", Icons.person_search, Colors.teal.shade700),
      ("Stolen vehicle broadcast", "P2", "Silver Toyota Corolla, plate LAG-123-EYE", "Opebi and Allen Avenue", Icons.directions_car, Colors.blueGrey.shade700),
      ("Crime broadcast", "P2", "Police response active near Allen Avenue", "2 km safety radius", Icons.local_police, Colors.indigo.shade700),
      ("Accident broadcast", "P2", "Multi-vehicle collision affecting traffic", "Awolowo Way", Icons.car_crash, Colors.orange.shade800),
      ("Government alert", "Official", "Temporary road closure for emergency response", "Lagos State", Icons.account_balance, Colors.green.shade800),
    ];

    return SafetyScaffold(
      title: "Safety broadcasts",
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          const SectionCard(
            title: "Alerts for your location",
            child: Text("Verified emergency and government alerts are targeted using your current community and safety radius."),
          ),
          const SizedBox(height: 16),
          ...alerts.map(
            (alert) => ListTileCard(
              leading: CircleAvatar(
                backgroundColor: alert.$6.withOpacity(0.12),
                foregroundColor: alert.$6,
                child: Icon(alert.$5),
              ),
              title: alert.$1,
              subtitle: "${alert.$2} - ${alert.$3}\n${alert.$4}",
              trailing: const Icon(Icons.chevron_right),
            ),
          ),
        ],
      ),
    );
  }
}

class BroadcastForm extends StatelessWidget {
  const BroadcastForm({required this.icon, required this.title, required this.fields, required this.onSubmit, super.key});

  final IconData icon;
  final String title;
  final List<String> fields;
  final VoidCallback onSubmit;

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
      children: [
        SectionCard(
          title: title,
          child: Column(
            children: [
              Icon(icon, size: 52, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: 16),
              ...fields.map((field) => Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: TextField(decoration: InputDecoration(labelText: field)),
                  )),
              AttachmentPicker(lowDataMode: AppScope.of(context).lowDataMode),
              const SizedBox(height: 16),
              FilledButton(onPressed: onSubmit, child: const Text("Submit broadcast")),
            ],
          ),
        ),
      ],
    );
  }
}

class NearbyPoliceStationsScreen extends StatelessWidget {
  const NearbyPoliceStationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final stations = [
      PoliceStationView("Ikeja Central Police Station", "+2348000003001", "Ikeja, Lagos", "police", 6.6018, 3.3515, "0.2 km"),
      PoliceStationView("Alausa Security Post", "+2348000003002", "Alausa Secretariat Road, Ikeja", "security", 6.6172, 3.3589, "2.4 km"),
      PoliceStationView("Opebi Police Desk", "+2348000003003", "Opebi Road, Ikeja", "police", 6.5988, 3.3521, "1.1 km"),
    ];

    return SafetyScaffold(
      title: "Nearby police",
      selectedIndex: 1,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Container(
            height: 240,
            decoration: BoxDecoration(
              color: const Color(0xFFE7EDF0),
              borderRadius: BorderRadius.circular(18),
              border: Border.all(color: const Color(0xFFD8DEE4)),
            ),
            child: const Center(child: Icon(Icons.map, size: 72, color: Color(0xFF0B6B58))),
          ),
          const SizedBox(height: 16),
          const TextField(decoration: InputDecoration(prefixIcon: Icon(Icons.search), labelText: "Search by state, LGA, or location")),
          const SizedBox(height: 12),
          ...stations.map((station) => PoliceStationCard(station: station)),
        ],
      ),
    );
  }
}

class PoliceStationView {
  PoliceStationView(this.name, this.phone, this.address, this.agencyType, this.latitude, this.longitude, this.distance);

  final String name;
  final String phone;
  final String address;
  final String agencyType;
  final double latitude;
  final double longitude;
  final String distance;

  Uri get navigationUri => Uri.parse("https://www.google.com/maps/dir/?api=1&destination=$latitude,$longitude&travelmode=driving");
}

class PoliceStationCard extends StatelessWidget {
  const PoliceStationCard({required this.station, super.key});

  final PoliceStationView station;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD8DEE4)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(station.agencyType == "police" ? Icons.local_police : Icons.security, color: Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(child: Text(station.name, style: const TextStyle(fontWeight: FontWeight.w900))),
              Text(station.distance, style: const TextStyle(fontWeight: FontWeight.w800)),
            ],
          ),
          const SizedBox(height: 8),
          Text(station.address),
          const SizedBox(height: 4),
          Text("${station.phone} - ${station.agencyType} - ${station.latitude}, ${station.longitude}", style: const TextStyle(color: Color(0xFF5C6670))),
          const SizedBox(height: 12),
          Row(
            children: [
              Expanded(child: OutlinedButton.icon(onPressed: () {}, icon: const Icon(Icons.phone), label: const Text("Call"))),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => launchUrl(station.navigationUri, mode: LaunchMode.externalApplication),
                  icon: const Icon(Icons.navigation),
                  label: const Text("Navigate"),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class NotificationsScreen extends StatelessWidget {
  const NotificationsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return SafetyScaffold(
      title: "Notifications",
      selectedIndex: 2,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Nearby alerts",
            child: Column(
              children: controller.notifications.map((alert) => BroadcastAlertTile(alert: alert)).toList(),
            ),
          ),
        ],
      ),
    );
  }
}

class IncidentTrackingScreen extends StatelessWidget {
  const IncidentTrackingScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return SafetyScaffold(
      title: "Incident status",
      selectedIndex: 2,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          if (controller.offlineDrafts.isNotEmpty)
            SectionCard(
              title: "Offline drafts",
              child: Column(
                children: controller.offlineDrafts
                    .map((draft) => ListTile(
                          contentPadding: EdgeInsets.zero,
                          leading: const Icon(Icons.cloud_off),
                          title: Text(draft.type),
                          subtitle: const Text("Queued until internet returns"),
                        ))
                    .toList(),
              ),
            ),
          const SizedBox(height: 12),
          ...controller.incidents.map((incident) => IncidentStatusTile(incident: incident)),
        ],
      ),
    );
  }
}

class FamilySafetyCircleScreen extends StatelessWidget {
  const FamilySafetyCircleScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final members = [
      ("Mum", "Safe at home", Icons.home),
      ("Brother", "On the move", Icons.directions_walk),
      ("Emergency contact", "Receives SOS alerts", Icons.phone_in_talk),
    ];
    return SafetyScaffold(
      title: "Family circle",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.group_add), label: const Text("Add family member")),
          const SizedBox(height: 16),
          ...members.map((member) => ListTileCard(
                leading: Icon(member.$3),
                title: member.$1,
                subtitle: member.$2,
              )),
        ],
      ),
    );
  }
}

class SmartwatchDeviceScreen extends StatefulWidget {
  const SmartwatchDeviceScreen({super.key});

  @override
  State<SmartwatchDeviceScreen> createState() => _SmartwatchDeviceScreenState();
}

class _SmartwatchDeviceScreenState extends State<SmartwatchDeviceScreen> {
  final TextEditingController deviceIdController = TextEditingController(text: "EYE-WATCH-SEED-001");
  final TextEditingController deviceSecretController = TextEditingController();
  bool standaloneCellular = false;
  bool criticalAlerts = true;
  bool failoverEnabled = true;
  String pairingMethod = "PairingCode";
  String emergencyMode = "NormalSOS";
  int batteryLevel = 82;
  int signalStrength = 74;
  bool locationDenied = false;
  bool sending = false;
  String status = "No device activity yet";
  Position? latestPosition;

  @override
  void dispose() {
    deviceIdController.dispose();
    deviceSecretController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "SOS device",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Pair smartwatch",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(controller: deviceIdController, decoration: const InputDecoration(labelText: "Device ID")),
                const SizedBox(height: 12),
                TextField(controller: deviceSecretController, decoration: const InputDecoration(labelText: "Device secret for standalone mode")),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: standaloneCellular,
                  onChanged: (value) => setState(() => standaloneCellular = value),
                  title: const Text("Standalone cellular mode"),
                  subtitle: const Text("Use when the watch sends SOS without the paired phone"),
                ),
                DropdownButtonFormField<String>(
                  value: pairingMethod,
                  decoration: const InputDecoration(labelText: "Pairing method"),
                  items: const [
                    DropdownMenuItem(value: "QrCode", child: Text("QR Code")),
                    DropdownMenuItem(value: "Bluetooth", child: Text("Bluetooth")),
                    DropdownMenuItem(value: "PairingCode", child: Text("Pairing Code")),
                    DropdownMenuItem(value: "Nfc", child: Text("NFC future")),
                  ],
                  onChanged: (value) => setState(() => pairingMethod = value ?? "PairingCode"),
                ),
                const SizedBox(height: 12),
                SwitchListTile(
                  value: criticalAlerts,
                  onChanged: (value) => setState(() => criticalAlerts = value),
                  title: const Text("Receive critical alerts on watch"),
                ),
                SwitchListTile(
                  value: failoverEnabled,
                  onChanged: (value) => setState(() => failoverEnabled = value),
                  title: const Text("Automatic standalone failover"),
                  subtitle: const Text("Use watch LTE or WiFi when phone connection is lost"),
                ),
                FilledButton.icon(onPressed: sending ? null : _pairDevice, icon: const Icon(Icons.watch), label: const Text("Pair device")),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Device status",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                ProfileRow("Mode", standaloneCellular ? "Standalone cellular" : "Paired phone"),
                ProfileRow("Critical alerts", criticalAlerts ? "Enabled" : "Disabled"),
                ProfileRow("Failover", failoverEnabled ? "Enabled" : "Disabled"),
                ProfileRow("Battery", "$batteryLevel%"),
                ProfileRow("Signal", "$signalStrength%"),
                ProfileRow("Latest GPS", latestPosition == null ? "Waiting for location" : "${latestPosition!.latitude.toStringAsFixed(6)}, ${latestPosition!.longitude.toStringAsFixed(6)}"),
                ProfileRow("Accuracy", latestPosition == null ? "-" : "${latestPosition!.accuracy.toStringAsFixed(0)}m"),
                Text(status, style: const TextStyle(fontWeight: FontWeight.w700)),
                if (locationDenied) Padding(
                  padding: const EdgeInsets.only(top: 10),
                  child: Text("Location is required for emergency smartwatch SOS.", style: TextStyle(color: Colors.red.shade700, fontWeight: FontWeight.w800)),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Emergency mode",
            child: DropdownButtonFormField<String>(
              value: emergencyMode,
              decoration: const InputDecoration(labelText: "SOS workflow"),
              items: const [
                DropdownMenuItem(value: "SilentSOS", child: Text("Silent SOS")),
                DropdownMenuItem(value: "NormalSOS", child: Text("Normal SOS")),
                DropdownMenuItem(value: "MedicalSOS", child: Text("Medical SOS")),
                DropdownMenuItem(value: "KidnappingSOS", child: Text("Kidnapping SOS")),
                DropdownMenuItem(value: "FireSOS", child: Text("Fire SOS")),
                DropdownMenuItem(value: "ChildSOS", child: Text("Child SOS")),
                DropdownMenuItem(value: "WomenSafetySOS", child: Text("Women Safety SOS")),
              ],
              onChanged: (value) => setState(() => emergencyMode = value ?? "NormalSOS"),
            ),
          ),
          const SizedBox(height: 16),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700, foregroundColor: Colors.white),
            onPressed: sending ? null : _triggerSos,
            icon: const Icon(Icons.sos),
            label: const Text("Trigger watch SOS"),
          ),
          const SizedBox(height: 12),
          OutlinedButton.icon(onPressed: sending ? null : _sendGpsUpdate, icon: const Icon(Icons.my_location), label: const Text("Send GPS update")),
          const SizedBox(height: 12),
          OutlinedButton.icon(onPressed: sending ? null : _sendHeartbeat, icon: const Icon(Icons.favorite), label: const Text("Send heartbeat")),
          const SizedBox(height: 12),
          OutlinedButton.icon(onPressed: sending ? null : _syncOfflineEvents, icon: const Icon(Icons.cloud_upload), label: const Text("Sync offline watch events")),
        ],
      ),
    );
  }

  Future<void> _pairDevice() async {
    await _postJson(
      "/smartwatch/devices/register",
      {
        "deviceId": deviceIdController.text.trim(),
        "provider": "THE EYE Mobile Pairing",
        "displayName": "My SOS Watch",
        "connectivityMode": standaloneCellular ? "StandaloneCellular" : "PairedPhone",
        "preferredMode": standaloneCellular ? "StandaloneCellular" : "PairedPhone",
        "pairingMethod": pairingMethod,
        "failoverEnabled": failoverEnabled,
        "criticalAlertsEnabled": criticalAlerts,
      },
      "Device pairing request sent",
    );
  }

  Future<void> _sendGpsUpdate() async {
    final position = await _captureLocation();
    if (position == null) {
      setState(() => locationDenied = true);
      return;
    }
    setState(() => latestPosition = position);
    await _postJson("/smartwatch/devices/${deviceIdController.text.trim()}/gps", _gpsPayload(position), "GPS update sent");
  }

  Future<void> _triggerSos() async {
    final position = await _captureLocation();
    if (position == null) {
      setState(() => locationDenied = true);
      return;
    }
    setState(() => latestPosition = position);
    await _postJson(
      "/smartwatch/sos",
      _gpsPayload(position)
        ..["description"] = "Smartwatch SOS triggered from citizen mobile app"
        ..["sourceDeviceId"] = deviceIdController.text.trim()
        ..["emergencyMode"] = emergencyMode
        ..["longPressDurationMs"] = 3000,
      "SOS sent. Family safety circle will be alerted.",
    );
  }

  Future<void> _sendHeartbeat() async {
    await _postJson(
      "/smartwatch/devices/${deviceIdController.text.trim()}/heartbeat",
      {
        "deviceId": deviceIdController.text.trim(),
        if (deviceSecretController.text.trim().isNotEmpty) "deviceSecret": deviceSecretController.text.trim(),
        "connectivityMode": standaloneCellular ? "StandaloneCellular" : "PairedPhone",
        "pairedPhoneAvailable": !standaloneCellular,
        "internetAvailable": true,
        "batteryLevel": batteryLevel,
        "signalStrength": signalStrength,
        "firmwareVersion": "1.0.1",
        "firmwareSignatureStatus": "Valid",
      },
      "Heartbeat sent",
    );
  }

  Future<void> _syncOfflineEvents() async {
    await _postJson(
      "/smartwatch/devices/${deviceIdController.text.trim()}/offline-sync",
      {
        "deviceId": deviceIdController.text.trim(),
        if (deviceSecretController.text.trim().isNotEmpty) "deviceSecret": deviceSecretController.text.trim(),
        "events": [
          {
            "eventType": "Heartbeat",
            "occurredAt": DateTime.now().subtract(const Duration(minutes: 2)).toIso8601String(),
            "payload": {"batteryLevel": batteryLevel, "signalStrength": signalStrength, "offline": true}
          }
        ]
      },
      "Offline watch events uploaded",
    );
  }

  Future<Position?> _captureLocation() async {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return null;
    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied || permission == LocationPermission.deniedForever) return null;
    return Geolocator.getCurrentPosition(desiredAccuracy: LocationAccuracy.high);
  }

  Map<String, dynamic> _gpsPayload(Position position) {
    final secret = deviceSecretController.text.trim();
    return {
      "deviceId": deviceIdController.text.trim(),
      if (secret.isNotEmpty) "deviceSecret": secret,
      "latitude": position.latitude,
      "longitude": position.longitude,
      "accuracy": position.accuracy,
      "speed": position.speed,
      "heading": position.heading,
      "altitude": position.altitude,
      "capturedAt": position.timestamp.toIso8601String(),
      "sourceMode": standaloneCellular ? "StandaloneCellular" : "PairedPhone",
      "batteryLevel": batteryLevel,
      "signalStrength": signalStrength,
    };
  }

  Future<void> _postJson(String path, Map<String, dynamic> payload, String successMessage) async {
    setState(() {
      sending = true;
      status = "Sending request...";
    });
    try {
      await http.post(Uri.parse("$theEyeApiUrl$path"), headers: {"content-type": "application/json"}, body: jsonEncode(payload));
      if (!mounted) return;
      setState(() {
        locationDenied = false;
        status = successMessage;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() => status = "Unable to reach THE EYE API. Request can be retried.");
    } finally {
      if (mounted) setState(() => sending = false);
    }
  }
}

class NeighborhoodWatchHomeScreen extends StatelessWidget {
  const NeighborhoodWatchHomeScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Neighborhood Watch",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Allen Avenue Estate",
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                const Text("Private estate community - approved resident"),
                const SizedBox(height: 12),
                FilledButton.icon(onPressed: () => Navigator.of(context).pushNamed("/neighborhood-watch/create"), icon: const Icon(Icons.add_alert), label: const Text("Post safety update")),
              ],
            ),
          ),
          const SizedBox(height: 16),
          GridView.count(
            crossAxisCount: 2,
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            mainAxisSpacing: 12,
            crossAxisSpacing: 12,
            children: [
              ActionTile("My Communities", Icons.home_work, Colors.teal.shade700, () => Navigator.of(context).pushNamed("/neighborhood-watch/communities")),
              ActionTile("Join Community", Icons.group_add, Colors.green.shade700, () => Navigator.of(context).pushNamed("/neighborhood-watch/join")),
              ActionTile("Community Feed", Icons.dynamic_feed, Colors.blue.shade700, () => Navigator.of(context).pushNamed("/neighborhood-watch/feed")),
              ActionTile("Community Map", Icons.map, Colors.indigo.shade700, () => Navigator.of(context).pushNamed("/neighborhood-watch/map")),
              ActionTile("Community Chat", Icons.chat, Colors.purple.shade700, () => Navigator.of(context).pushNamed("/neighborhood-watch/chat")),
              ActionTile("Volunteers", Icons.volunteer_activism, Colors.red.shade700, () => Navigator.of(context).pushNamed("/neighborhood-watch/volunteers")),
              ActionTile("Patrols", Icons.security, Colors.orange.shade800, () => Navigator.of(context).pushNamed("/neighborhood-watch/patrols")),
              ActionTile("Alerts", Icons.campaign, Colors.cyan.shade800, () => Navigator.of(context).pushNamed("/neighborhood-watch/alerts")),
            ],
          ),
        ],
      ),
    );
  }
}

class MyCommunitiesScreen extends StatelessWidget {
  const MyCommunitiesScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final items = ["Allen Avenue Estate - Private - Moderator approved", "Opebi Street Watch - Public - Resident", "Ikeja Business Owners - Pending approval"];
    return SafetyScaffold(
      title: "My Communities",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: items.map((item) => ListTileCard(leading: const Icon(Icons.groups), title: item.split(" - ").first, subtitle: item.substring(item.indexOf(" - ") + 3))).toList(),
      ),
    );
  }
}

class JoinCommunityScreen extends StatelessWidget {
  const JoinCommunityScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Join Community",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          const TextField(decoration: InputDecoration(labelText: "Search country, state, LGA, estate, or street")),
          const SizedBox(height: 16),
          ListTileCard(leading: const Icon(Icons.lock), title: "Allen Avenue Estate", subtitle: "Private estate - request approval", trailing: FilledButton(onPressed: () {}, child: const Text("Request"))),
          ListTileCard(leading: const Icon(Icons.public), title: "Opebi Street Watch", subtitle: "Public street community", trailing: FilledButton(onPressed: () {}, child: const Text("Join"))),
        ],
      ),
    );
  }
}

class CommunityFeedScreen extends StatelessWidget {
  const CommunityFeedScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final posts = [
      ("Suspicious activity", "Two unknown riders circling Gate 2", "Pending Verification - 64%"),
      ("Security meeting", "Night patrol briefing by 8 PM", "Verified - 91%"),
      ("Missing person", "Lost child near terminal", "Disputed - 48%"),
    ];
    return SafetyScaffold(
      title: "Community Feed",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          FilledButton.icon(onPressed: () => Navigator.of(context).pushNamed("/neighborhood-watch/create"), icon: const Icon(Icons.edit), label: const Text("Create community post")),
          const SizedBox(height: 16),
          ...posts.map((post) => ListTileCard(leading: const Icon(Icons.report), title: "${post.$1}: ${post.$2}", subtitle: post.$3)),
        ],
      ),
    );
  }
}

class CreateCommunityPostScreen extends StatelessWidget {
  const CreateCommunityPostScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final types = ["Suspicious activity", "Lost child", "Missing person", "Crime alert", "Accident alert", "Fire alert", "Flood warning", "Community announcement", "Security meeting", "Patrol update"];
    return SafetyScaffold(
      title: "Create Post",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          DropdownButtonFormField<String>(items: types.map((type) => DropdownMenuItem(value: type, child: Text(type))).toList(), onChanged: (_) {}, decoration: const InputDecoration(labelText: "Post type")),
          const SizedBox(height: 12),
          const TextField(decoration: InputDecoration(labelText: "Title")),
          const SizedBox(height: 12),
          const TextField(maxLines: 4, decoration: InputDecoration(labelText: "Details")),
          const SizedBox(height: 12),
          AttachmentPicker(lowDataMode: AppScope.of(context).lowDataMode),
          const SizedBox(height: 12),
          FilledButton(onPressed: () => Navigator.of(context).pushNamed("/neighborhood-watch/feed"), child: const Text("Post to community")),
        ],
      ),
    );
  }
}

class CommunityMapScreen extends StatelessWidget {
  const CommunityMapScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Community Map",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          Container(height: 360, decoration: BoxDecoration(color: const Color(0xFFE7EDF0), borderRadius: BorderRadius.circular(18), border: Border.all(color: const Color(0xFFD8DEE4))), child: const Center(child: Icon(Icons.map, size: 80, color: Color(0xFF0B6B58)))),
          const SizedBox(height: 16),
          const SectionCard(title: "Visible layers", child: Text("Community posts, incidents, safe points, police stations, hospitals, patrol points, and danger zones.")),
        ],
      ),
    );
  }
}

class CommunityChatScreen extends StatelessWidget {
  const CommunityChatScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final channels = ["General", "Emergency", "Security", "Volunteers", "Women Safety", "Parents", "Business Owners"];
    return SafetyScaffold(
      title: "Community Chat",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: channels.map((channel) => ListTileCard(leading: const Icon(Icons.forum), title: channel, subtitle: "Realtime channel")).toList(),
      ),
    );
  }
}

class VolunteersScreen extends StatelessWidget {
  const VolunteersScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final types = ["Doctor", "Nurse", "First Aid", "Lawyer", "Security Volunteer", "Fire Volunteer", "Search and Rescue", "Blood Donor"];
    return SafetyScaffold(
      title: "Volunteers",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.volunteer_activism), label: const Text("Register as volunteer")),
          const SizedBox(height: 16),
          ...types.map((type) => ListTileCard(leading: const Icon(Icons.health_and_safety), title: type, subtitle: "Notify nearby volunteers during emergencies")),
        ],
      ),
    );
  }
}

class PatrolsScreen extends StatelessWidget {
  const PatrolsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Patrols",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          ListTileCard(leading: const Icon(Icons.route), title: "Gate 2 evening patrol", subtitle: "Scheduled - 4 volunteers - 6 checkpoints"),
          ListTileCard(leading: const Icon(Icons.security), title: "Opebi corridor patrol", subtitle: "Active - 6 volunteers - 11 checkpoints"),
          FilledButton.icon(onPressed: () {}, icon: const Icon(Icons.add_location_alt), label: const Text("Log patrol checkpoint")),
        ],
      ),
    );
  }
}

class CommunityAlertsScreen extends StatelessWidget {
  const CommunityAlertsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final alerts = ["Nearby suspicious activity", "Community emergency alert", "Missing child nearby", "Security meeting reminder", "Patrol request", "Volunteer request"];
    return SafetyScaffold(
      title: "Community Alerts",
      selectedIndex: 3,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: alerts.map((alert) => ListTileCard(leading: const Icon(Icons.campaign), title: alert, subtitle: "Location-based community notification")).toList(),
      ),
    );
  }
}

class ProfileScreen extends StatelessWidget {
  const ProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return SafetyScaffold(
      title: "Profile",
      selectedIndex: 4,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: const [
          SectionCard(
            title: "Citizen profile",
            child: Column(
              children: [
                CircleAvatar(radius: 42, child: Icon(Icons.person, size: 44)),
                SizedBox(height: 16),
                ProfileRow("Name", "Amina Okafor"),
                ProfileRow("KYC status", "Verified"),
                ProfileRow("Trust score", "82"),
                ProfileRow("Emergency contact", "+234 800 000 0000"),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class SettingsScreen extends StatelessWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final controller = AppScope.of(context);
    return SafetyScaffold(
      title: "Settings",
      selectedIndex: 4,
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 120),
        children: [
          SectionCard(
            title: "Safety and data",
            child: Column(
              children: [
                SwitchListTile(
                  value: controller.highContrastMode,
                  onChanged: controller.toggleHighContrast,
                  title: const Text("High contrast mode"),
                  subtitle: const Text("Improves readability in bright or stressful conditions"),
                ),
                SwitchListTile(
                  value: controller.lowDataMode,
                  onChanged: controller.toggleLowData,
                  title: const Text("Low-data mode"),
                  subtitle: const Text("Reduces media upload size before sending"),
                ),
                SwitchListTile(
                  value: controller.online,
                  onChanged: controller.toggleOnline,
                  title: const Text("Internet connection"),
                  subtitle: const Text("Offline reports are saved as drafts"),
                ),
              ],
            ),
          ),
          const SizedBox(height: 16),
          SectionCard(
            title: "Connected safety devices",
            child: FilledButton.icon(
              onPressed: () => Navigator.of(context).pushNamed("/smartwatch"),
              icon: const Icon(Icons.watch),
              label: const Text("Manage SOS smartwatch"),
            ),
          ),
        ],
      ),
    );
  }
}

class SafetyScaffold extends StatelessWidget {
  const SafetyScaffold({required this.title, required this.body, this.selectedIndex = 0, super.key});

  final String title;
  final Widget body;
  final int selectedIndex;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(title),
        actions: [
          IconButton(
            tooltip: "Settings",
            icon: const Icon(Icons.settings),
            onPressed: () => Navigator.of(context).pushNamed("/settings"),
          ),
        ],
      ),
      body: body,
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      floatingActionButton: SizedBox(
        width: MediaQuery.sizeOf(context).width - 32,
        child: FilledButton.icon(
          style: FilledButton.styleFrom(
            backgroundColor: Colors.red.shade700,
            foregroundColor: Colors.white,
            minimumSize: const Size.fromHeight(64),
          ),
          onPressed: () => _openSos(context),
          icon: const Icon(Icons.sos, size: 28),
          label: const Text("SOS"),
        ),
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: selectedIndex,
        onDestinationSelected: (index) {
          final routes = ["/home", "/police-stations", "/tracking", "/family", "/profile"];
          Navigator.of(context).pushReplacementNamed(routes[index]);
        },
        destinations: const [
          NavigationDestination(icon: Icon(Icons.home), label: "Home"),
          NavigationDestination(icon: Icon(Icons.local_police), label: "Police"),
          NavigationDestination(icon: Icon(Icons.notifications), label: "Updates"),
          NavigationDestination(icon: Icon(Icons.family_restroom), label: "Family"),
          NavigationDestination(icon: Icon(Icons.person), label: "Profile"),
        ],
      ),
    );
  }
}

void _openSos(BuildContext context) {
  showModalBottomSheet<void>(
    context: context,
    isScrollControlled: true,
    builder: (context) => Padding(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 32),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text("Send SOS alert?", style: TextStyle(fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          const Text("Your GPS location and emergency contact alert will be sent immediately."),
          const SizedBox(height: 20),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: () {
              AppScope.of(context).submitDraft("SOS emergency", "Emergency");
              Navigator.of(context).pop();
              Navigator.of(context).pushNamed("/tracking");
            },
            icon: const Icon(Icons.flash_on),
            label: const Text("Send SOS now"),
          ),
          const SizedBox(height: 10),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.black),
            onPressed: () {
              AppScope.of(context).submitDraft("SOS emergency with live video", "Emergency");
              Navigator.of(context).pop();
              Navigator.of(context).pushNamed("/live-video");
            },
            icon: const Icon(Icons.videocam),
            label: const Text("Start SOS live video"),
          ),
          const SizedBox(height: 10),
          OutlinedButton(onPressed: () => Navigator.of(context).pop(), child: const Text("Cancel")),
        ],
      ),
    ),
  );
}

class StatusStrip extends StatelessWidget {
  const StatusStrip({required this.controller, super.key});

  final AppController controller;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: [
        StatusPill(icon: controller.online ? Icons.cloud_done : Icons.cloud_off, label: controller.online ? "Online" : "Offline drafts active"),
        if (controller.lowDataMode) const StatusPill(icon: Icons.data_saver_on, label: "Low-data"),
        if (controller.highContrastMode) const StatusPill(icon: Icons.contrast, label: "High contrast"),
      ],
    );
  }
}

class StatusPill extends StatelessWidget {
  const StatusPill({required this.icon, required this.label, super.key});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFFD8DEE4)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 18),
          const SizedBox(width: 6),
          Text(label, style: const TextStyle(fontWeight: FontWeight.w700)),
        ],
      ),
    );
  }
}

class EmergencyHero extends StatelessWidget {
  const EmergencyHero({required this.onPressed, super.key});

  final VoidCallback onPressed;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: const Color(0xFF111820),
        borderRadius: BorderRadius.circular(22),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text("Need help now?", style: TextStyle(color: Colors.white, fontSize: 24, fontWeight: FontWeight.w900)),
          const SizedBox(height: 8),
          const Text("SOS sends your GPS and alerts emergency contacts.", style: TextStyle(color: Colors.white70)),
          const SizedBox(height: 18),
          FilledButton.icon(
            style: FilledButton.styleFrom(backgroundColor: Colors.red.shade700),
            onPressed: onPressed,
            icon: const Icon(Icons.sos),
            label: const Text("Send SOS"),
          ),
        ],
      ),
    );
  }
}

class ActionTile extends StatelessWidget {
  const ActionTile(this.label, this.icon, this.color, this.onTap, {super.key});

  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white,
      borderRadius: BorderRadius.circular(18),
      child: InkWell(
        borderRadius: BorderRadius.circular(18),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(14),
          decoration: BoxDecoration(
            border: Border.all(color: const Color(0xFFD8DEE4)),
            borderRadius: BorderRadius.circular(18),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Icon(icon, color: color, size: 34),
              Text(label, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
            ],
          ),
        ),
      ),
    );
  }
}

class SectionCard extends StatelessWidget {
  const SectionCard({required this.title, required this.child, super.key});

  final String title;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        border: Border.all(color: const Color(0xFFD8DEE4)),
        borderRadius: BorderRadius.circular(18),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          child,
        ],
      ),
    );
  }
}

class AttachmentPicker extends StatelessWidget {
  const AttachmentPicker({required this.lowDataMode, super.key});

  final bool lowDataMode;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      title: "Evidence",
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: const [
              AttachmentChip(Icons.photo_camera, "Photo"),
              AttachmentChip(Icons.videocam, "Video"),
              AttachmentChip(Icons.mic, "Audio"),
            ],
          ),
          if (lowDataMode) const Padding(
            padding: EdgeInsets.only(top: 12),
            child: Text("Low-data mode will compress media before upload."),
          ),
        ],
      ),
    );
  }
}

class AttachmentChip extends StatelessWidget {
  const AttachmentChip(this.icon, this.label, {super.key});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return OutlinedButton.icon(onPressed: () {}, icon: Icon(icon), label: Text(label));
  }
}

class ListTileCard extends StatelessWidget {
  const ListTileCard({required this.leading, required this.title, required this.subtitle, this.trailing, super.key});

  final Widget leading;
  final String title;
  final String subtitle;
  final Widget? trailing;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: const Color(0xFFD8DEE4)),
      ),
      child: ListTile(
        minVerticalPadding: 14,
        leading: leading,
        title: Text(title, style: const TextStyle(fontWeight: FontWeight.w800)),
        subtitle: Text(subtitle),
        trailing: trailing,
      ),
    );
  }
}

class IncidentStatusTile extends StatelessWidget {
  const IncidentStatusTile({required this.incident, super.key});

  final IncidentStatus incident;

  @override
  Widget build(BuildContext context) {
    return ListTileCard(
      leading: const Icon(Icons.radar),
      title: "${incident.id} - ${incident.type}",
      subtitle: "${incident.status} - ${incident.agency} - ${incident.confidence}% confidence",
      trailing: const Icon(Icons.chevron_right),
    );
  }
}

class BroadcastAlertTile extends StatelessWidget {
  const BroadcastAlertTile({required this.alert, super.key});

  final BroadcastAlert alert;

  @override
  Widget build(BuildContext context) {
    final isCritical = alert.priority == "P1";
    final unread = !alert.read;
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: isCritical ? const Color(0xFFFFF1F0) : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isCritical ? Colors.red.shade200 : unread ? Theme.of(context).colorScheme.primary : const Color(0xFFD8DEE4), width: unread ? 2 : 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            children: [
              Icon(isCritical ? Icons.warning_amber : Icons.campaign, color: isCritical ? Colors.red.shade700 : Theme.of(context).colorScheme.primary),
              const SizedBox(width: 10),
              Expanded(child: Text(alert.type, style: const TextStyle(fontWeight: FontWeight.w800))),
              Text(alert.priority, style: TextStyle(fontWeight: FontWeight.w900, color: isCritical ? Colors.red.shade700 : Theme.of(context).colorScheme.primary)),
            ],
          ),
          const SizedBox(height: 10),
          Text(alert.title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w800)),
          const SizedBox(height: 4),
          Text("${alert.area} - ${alert.delivery} - ${unread ? "Unread" : "Read"}", style: const TextStyle(color: Color(0xFF5C6670))),
        ],
      ),
    );
  }
}

class ProfileRow extends StatelessWidget {
  const ProfileRow(this.label, this.value, {super.key});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 8),
      child: Row(
        children: [
          Expanded(child: Text(label, style: const TextStyle(color: Color(0xFF5C6670)))),
          Text(value, style: const TextStyle(fontWeight: FontWeight.w800)),
        ],
      ),
    );
  }
}
