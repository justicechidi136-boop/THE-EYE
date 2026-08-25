import 'package:flutter/material.dart';

import '../screens/routes.dart';
import 'launcher_policy.dart';

class LauncherModule {
  const LauncherModule({
    required this.id,
    required this.label,
    required this.icon,
    required this.route,
    this.primary = true,
  });

  final String id;
  final String label;
  final IconData icon;
  final String route;
  final bool primary;
}

abstract final class LauncherModules {
  static const all = <LauncherModule>[
    LauncherModule(
      id: 'dashboard',
      label: 'Dashboard',
      icon: Icons.dashboard_outlined,
      route: FieldRoutes.home,
    ),
    LauncherModule(
      id: 'patrol',
      label: 'Patrol',
      icon: Icons.directions_walk,
      route: FieldRoutes.patrol,
    ),
    LauncherModule(
      id: 'checkpoint',
      label: 'Checkpoint',
      icon: Icons.security,
      route: FieldRoutes.checkpoint,
    ),
    LauncherModule(
      id: 'assignments',
      label: 'Assignments',
      icon: Icons.assignment_outlined,
      route: FieldRoutes.assignments,
    ),
    LauncherModule(
      id: 'incident_map',
      label: 'Incident Map',
      icon: Icons.map_outlined,
      route: FieldRoutes.incidentWorkspace,
    ),
    LauncherModule(
      id: 'bolo',
      label: 'BOLO',
      icon: Icons.person_search_outlined,
      route: FieldRoutes.bolo,
    ),
    LauncherModule(
      id: 'broadcasts',
      label: 'Broadcasts',
      icon: Icons.campaign_outlined,
      route: FieldRoutes.broadcasts,
    ),
    LauncherModule(
      id: 'drone',
      label: 'Drone',
      icon: Icons.flight,
      route: FieldRoutes.drone,
    ),
    LauncherModule(
      id: 'comms',
      label: 'Communications',
      icon: Icons.forum_outlined,
      route: FieldRoutes.comms,
    ),
    LauncherModule(
      id: 'backup',
      label: 'Backup',
      icon: Icons.emergency_share_outlined,
      route: FieldRoutes.home,
    ),
    LauncherModule(
      id: 'officer_safety',
      label: 'Officer Safety',
      icon: Icons.health_and_safety_outlined,
      route: FieldRoutes.patrol,
    ),
    LauncherModule(
      id: 'device_status',
      label: 'Device Status',
      icon: Icons.tablet_android,
      route: FieldRoutes.deviceStatus,
    ),
  ];

  static List<LauncherModule> visibleFor(LauncherPolicy policy) {
    final allowed = policy.visibleModules.map((e) => e.toLowerCase()).toSet();
    return all.where((m) => allowed.contains(m.id)).toList(growable: false);
  }
}
