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
    FieldRoutes.broadcasts,
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
    if (index == 9) {
      _lock();
      return;
    }
    if (index == 10) {
      _signOut();
      return;
    }
    if (index == 8) {
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
            scrollable: true,
            minExtendedWidth: 200,
            labelType: NavigationRailLabelType.none,
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
              NavigationRailDestination(
                icon: const Icon(Icons.map_outlined),
                selectedIcon: const Icon(Icons.map),
                label: Text(l10n.patrol),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.fact_check_outlined),
                selectedIcon: const Icon(Icons.fact_check),
                label: Text(l10n.checkpoint),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.assignment_outlined),
                selectedIcon: const Icon(Icons.assignment),
                label: Text(l10n.assignments),
              ),
              const NavigationRailDestination(
                icon: Icon(Icons.search_outlined),
                selectedIcon: Icon(Icons.search),
                label: Text('BOLO'),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.campaign_outlined),
                selectedIcon: const Icon(Icons.campaign),
                label: Text(l10n.broadcasts),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.flight_outlined),
                selectedIcon: const Icon(Icons.flight),
                label: Text(l10n.drone),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.forum_outlined),
                selectedIcon: const Icon(Icons.forum),
                label: Text(l10n.comms),
              ),
              NavigationRailDestination(
                icon: const Icon(Icons.devices_other_outlined),
                selectedIcon: const Icon(Icons.devices_other),
                label: Text(l10n.device),
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
