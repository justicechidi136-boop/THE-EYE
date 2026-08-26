import "dart:async";

import "package:flutter/material.dart";
import "package:livekit_client/livekit_client.dart";

import "../contracts/the_eye_api_client.dart";
import "../design_system/eye_semantic_colors.dart";
import "danger_trigger_service.dart";

class DangerTriggerAlertScreen extends StatefulWidget {
  DangerTriggerAlertScreen({
    required this.eventId,
    required TheEyeApiClient apiClient,
    required this.accessTokenProvider,
    DangerTriggerGateway? gateway,
    super.key,
  }) : gateway = gateway ?? DangerTriggerApiService(apiClient);

  final String eventId;
  final String? Function() accessTokenProvider;
  final DangerTriggerGateway gateway;

  @override
  State<DangerTriggerAlertScreen> createState() =>
      _DangerTriggerAlertScreenState();
}

class _DangerTriggerAlertScreenState extends State<DangerTriggerAlertScreen>
    with SingleTickerProviderStateMixin {
  DangerTriggerEventDetail? _detail;
  Room? _room;
  bool _loading = true;
  bool _connecting = false;
  bool _listening = false;
  String? _error;
  late final AnimationController _alertPulse;
  late final Animation<double> _alertOpacity;

  @override
  void initState() {
    super.initState();
    _alertPulse = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 650),
    );
    _alertOpacity = Tween<double>(begin: 0.35, end: 1).animate(
      CurvedAnimation(parent: _alertPulse, curve: Curves.easeInOut),
    );
    unawaited(_alertPulse.repeat(reverse: true, count: 8));
    unawaited(_load());
  }

  @override
  void dispose() {
    _alertPulse.dispose();
    unawaited(_disconnect());
    super.dispose();
  }

  String get _token => widget.accessTokenProvider()?.trim() ?? "";

  Future<void> _load() async {
    if (_token.isEmpty) {
      setState(() {
        _loading = false;
        _error = "Sign in again to open this safety alert.";
      });
      return;
    }
    try {
      final detail = await widget.gateway.detail(
        accessToken: _token,
        eventId: widget.eventId,
      );
      if (!mounted) return;
      setState(() {
        _detail = detail;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is DangerTriggerException
            ? error.message
            : "Unable to load this danger alert.";
      });
    }
  }

  Future<void> _listen() async {
    if (_connecting || _listening || _token.isEmpty) return;
    setState(() {
      _connecting = true;
      _error = null;
    });
    try {
      final session = await widget.gateway.listen(
        accessToken: _token,
        eventId: widget.eventId,
      );
      final room = Room(
        roomOptions: const RoomOptions(
          adaptiveStream: true,
          dynacast: true,
        ),
      );
      await room.connect(session.serverUrl, session.token).timeout(
            const Duration(seconds: 30),
          );
      if (!mounted) {
        await room.disconnect();
        await room.dispose();
        return;
      }
      setState(() {
        _room = room;
        _connecting = false;
        _listening = true;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _connecting = false;
        _error = error is DangerTriggerException
            ? error.message
            : "Unable to connect to the live warning.";
      });
    }
  }

  Future<void> _disconnect() async {
    final room = _room;
    _room = null;
    if (room != null) {
      await room.disconnect();
      await room.dispose();
    }
    if (mounted) {
      setState(() => _listening = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final semantics = EyeSemanticColors.of(context);
    return Scaffold(
      appBar: AppBar(title: const Text("Danger Alert Nearby")),
      body: SafeArea(
        child: _loading
            ? const Center(child: CircularProgressIndicator())
            : ListView(
                padding: const EdgeInsets.all(20),
                children: [
                  FadeTransition(
                    opacity: _alertOpacity,
                    child: Icon(
                      Icons.warning_amber_rounded,
                      size: 64,
                      color: Colors.amber.shade800,
                      semanticLabel: "Danger warning",
                    ),
                  ),
                  const SizedBox(height: 16),
                  Text(
                    "A serious safety alert was triggered nearby.",
                    textAlign: TextAlign.center,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 20),
                  ListTile(
                    leading: const Icon(Icons.location_on_outlined),
                    title: Text(_detail?.approximateArea ?? "Nearby area"),
                    subtitle: const Text(
                      "Approximate area only. The reporter's exact location is private.",
                    ),
                  ),
                  ListTile(
                    leading: const Icon(Icons.shield_outlined),
                    title: Text(
                        "Alert status: ${_detail?.state ?? "Unavailable"}"),
                    subtitle: const Text(
                      "Move to safety and follow official responder instructions.",
                    ),
                  ),
                  const SizedBox(height: 16),
                  if (_detail?.liveAvailable == true)
                    FilledButton.icon(
                      onPressed: _listening
                          ? _disconnect
                          : (_connecting ? null : _listen),
                      icon: Icon(_listening ? Icons.stop : Icons.headphones),
                      label: Text(_connecting
                          ? "Connecting..."
                          : (_listening ? "Stop listening" : "Listen Live")),
                    )
                  else
                    const Center(
                      child: Text("Live voice has ended or is unavailable."),
                    ),
                  if (_listening) ...[
                    const SizedBox(height: 12),
                    const Text(
                      "Listening to the authorized live warning",
                      textAlign: TextAlign.center,
                    ),
                  ],
                  if (_error != null) ...[
                    const SizedBox(height: 16),
                    Text(
                      _error!,
                      textAlign: TextAlign.center,
                      style: TextStyle(color: semantics.error),
                    ),
                  ],
                  const SizedBox(height: 20),
                  OutlinedButton.icon(
                    onPressed: () =>
                        Navigator.of(context).pushNamed("/report/emergency"),
                    icon: const Icon(Icons.warning_amber_rounded),
                    label: const Text("Report Immediate Danger"),
                  ),
                ],
              ),
      ),
    );
  }
}
