import 'package:flutter/material.dart';

import '../../api/field_api_client.dart';
import '../../l10n/generated/field_localizations.dart';
import '../../services/field_app_services.dart';
import '../../theme/field_theme.dart';

class DroneMonitorScreen extends StatefulWidget {
  const DroneMonitorScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<DroneMonitorScreen> createState() => _DroneMonitorScreenState();
}

class _DroneMonitorScreenState extends State<DroneMonitorScreen> {
  List<Map<String, dynamic>> _missions = [];
  Map<String, dynamic>? _selected;
  String? _error;
  bool _busy = true;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      await widget.services.restoreSession();
      final missions = await widget.services.workflows.listDroneMissions();
      if (!mounted) return;
      setState(() {
        _missions = missions;
        _busy = false;
      });
    } on FieldApiException catch (error) {
      if (!mounted) return;
      setState(() {
        _error = error.message;
        _busy = false;
      });
    }
  }

  Future<void> _selectMission(String id) async {
    try {
      await widget.services.restoreSession();
      final mission = await widget.services.workflows.getDroneMission(id);
      if (!mounted) return;
      setState(() => _selected = mission);
    } on FieldApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    }
  }

  Future<void> _requestDrone() async {
    await widget.services.restoreSession();
    await widget.services.workflows.requestDrone(
      reason: 'Field officer drone support request',
    );
    if (!mounted) return;
    final l10n = FieldLocalizations.of(context);
    ScaffoldMessenger.of(
      context,
    ).showSnackBar(SnackBar(content: Text(l10n.droneRequestSubmitted)));
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      appBar: AppBar(
        title: Text(l10n.drone),
        backgroundColor: FieldColors.surface,
        foregroundColor: FieldColors.white,
        actions: [
          TextButton(onPressed: _requestDrone, child: Text(l10n.requestDrone)),
          IconButton(onPressed: _load, icon: const Icon(Icons.refresh)),
        ],
      ),
      body:
          _busy
              ? const Center(child: CircularProgressIndicator())
              : Row(
                children: [
                  SizedBox(
                    width: 360,
                    child:
                        _error != null
                            ? Center(child: Text(_error!))
                            : ListView.separated(
                              padding: const EdgeInsets.all(12),
                              itemCount: _missions.length,
                              separatorBuilder:
                                  (_, __) => const SizedBox(height: 8),
                              itemBuilder: (context, index) {
                                final mission = _missions[index];
                                final id = mission['id']?.toString() ?? '';
                                final selected =
                                    _selected?['id']?.toString() == id;
                                return Material(
                                  color:
                                      selected
                                          ? FieldColors.surfaceElevated
                                          : FieldColors.surface,
                                  borderRadius: BorderRadius.circular(12),
                                  child: ListTile(
                                    leading: const Icon(Icons.flight),
                                    title: Text(
                                      mission['name']?.toString() ??
                                          l10n.missionId(id),
                                    ),
                                    subtitle: Text(
                                      mission['status']?.toString() ??
                                          l10n.unknown,
                                    ),
                                    onTap:
                                        id.isEmpty
                                            ? null
                                            : () => _selectMission(id),
                                  ),
                                );
                              },
                            ),
                  ),
                  const VerticalDivider(width: 1),
                  Expanded(
                    child:
                        _selected == null
                            ? Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(
                                    Icons.videocam_off,
                                    size: 64,
                                    color: FieldColors.muted,
                                  ),
                                  const SizedBox(height: 12),
                                  Text(l10n.selectMissionToMonitor),
                                ],
                              ),
                            )
                            : Padding(
                              padding: const EdgeInsets.all(24),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    _selected!['name']?.toString() ??
                                        l10n.mission,
                                    style:
                                        Theme.of(
                                          context,
                                        ).textTheme.headlineLarge,
                                  ),
                                  const SizedBox(height: 8),
                                  Text(
                                    '${l10n.status}: ${_selected!['status'] ?? '-'}',
                                  ),
                                  const SizedBox(height: 24),
                                  Expanded(
                                    child: Container(
                                      width: double.infinity,
                                      decoration: BoxDecoration(
                                        color: FieldColors.surfaceElevated,
                                        borderRadius: BorderRadius.circular(16),
                                      ),
                                      child: Center(
                                        child: Text(l10n.liveFeedPlaceholder),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                  ),
                ],
              ),
    );
  }
}
