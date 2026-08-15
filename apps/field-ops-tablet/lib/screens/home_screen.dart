import 'package:flutter/material.dart';

import '../l10n/generated/field_localizations.dart';
import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';
import 'home/operational_dashboard_screen.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;

  static const _operationalRoutes = <String>[
    FieldRoutes.home,
    FieldRoutes.patrol,
    FieldRoutes.checkpoint,
    FieldRoutes.assignments,
    FieldRoutes.bolo,
    FieldRoutes.drone,
    FieldRoutes.comms,
  ];

  Future<void> _lock() async {
    await widget.services.auth.lockSession();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(FieldRoutes.locked);
  }

  Future<void> _signOut() async {
    await widget.services.auth.logout();
    if (!mounted) return;
    Navigator.of(context).pushReplacementNamed(FieldRoutes.login);
  }

  void _onDestinationSelected(int index) {
    // Lock and sign-out are action items, not tabs.
    if (index == 8) {
      _lock();
      return;
    }
    if (index == 9) {
      _signOut();
      return;
    }
    if (index == 7) {
      Navigator.of(context).pushNamed(FieldRoutes.deviceStatus);
      return;
    }

    if (index == 0) {
      setState(() => _selectedIndex = 0);
      return;
    }

    if (index > 0 && index < _operationalRoutes.length) {
      Navigator.of(context).pushNamed(_operationalRoutes[index]);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l10n = FieldLocalizations.of(context);
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _selectedIndex,
            extended: true,
            minExtendedWidth: 200,
            labelType: NavigationRailLabelType.all,
            backgroundColor: FieldColors.surface,
            selectedIconTheme: const IconThemeData(
              color: FieldColors.orange,
              size: 30,
            ),
            unselectedIconTheme: const IconThemeData(
              color: FieldColors.white,
              size: 28,
            ),
            selectedLabelTextStyle: const TextStyle(
              color: FieldColors.orange,
              fontWeight: FontWeight.w700,
              fontSize: 15,
            ),
            unselectedLabelTextStyle: const TextStyle(
              color: FieldColors.muted,
              fontSize: 14,
            ),
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(Icons.shield, color: FieldColors.orange, size: 36),
                  const SizedBox(height: 8),
                  Text(
                    l10n.fieldOps,
                    style: Theme.of(
                      context,
                    ).textTheme.labelLarge?.copyWith(color: FieldColors.orange),
                  ),
                ],
              ),
            ),
            destinations: [
              NavigationRailDestination(
                icon: const Icon(Icons.dashboard_outlined),
                selectedIcon: const Icon(Icons.dashboard),
                label: Text(l10n.dashboard),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.map_outlined),
                selectedIcon: Icon(Icons.map),
                label: Text('Patrol'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.fact_check_outlined),
                selectedIcon: Icon(Icons.fact_check),
                label: Text('Checkpoint'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.assignment_outlined),
                selectedIcon: Icon(Icons.assignment),
                label: Text('Assignments'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.search_outlined),
                selectedIcon: Icon(Icons.search),
                label: Text('BOLO'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.flight_outlined),
                selectedIcon: Icon(Icons.flight),
                label: Text('Drone'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.forum_outlined),
                selectedIcon: Icon(Icons.forum),
                label: Text('Comms'),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.devices_other_outlined),
                selectedIcon: Icon(Icons.devices_other),
                label: Text('Device'),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.lock_outline),
                selectedIcon: const Icon(Icons.lock),
                label: Text(l10n.lock),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.logout),
                selectedIcon: const Icon(Icons.logout),
                label: Text(l10n.signOut),
              ),
            ],
            onDestinationSelected: _onDestinationSelected,
          ),
          const VerticalDivider(width: 1, thickness: 1),
          Expanded(
            child: OperationalDashboardScreen(services: widget.services),
          ),
        ],
      ),
    );
  }
}
