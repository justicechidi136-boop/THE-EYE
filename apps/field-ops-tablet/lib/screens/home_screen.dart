import 'package:flutter/material.dart';

import '../screens/routes.dart';
import '../services/field_app_services.dart';
import '../theme/field_theme.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key, required this.services});

  final FieldAppServices services;

  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  int _selectedIndex = 0;
  String? _officerName;

  @override
  void initState() {
    super.initState();
    _loadOfficer();
  }

  Future<void> _loadOfficer() async {
    final name = await widget.services.session.readOfficerName();
    if (mounted) setState(() => _officerName = name);
  }

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

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Row(
        children: [
          NavigationRail(
            selectedIndex: _selectedIndex,
            extended: true,
            minExtendedWidth: 180,
            labelType: NavigationRailLabelType.none,
            leading: Padding(
              padding: const EdgeInsets.symmetric(vertical: 24),
              child: Column(
                children: [
                  Icon(Icons.shield, color: FieldColors.orange, size: 36),
                  const SizedBox(height: 8),
                  Text(
                    'Field Ops',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          color: FieldColors.orange,
                        ),
                  ),
                ],
              ),
            ),
            destinations: const [
              NavigationRailDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home),
                label: Text('Home'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.devices_other_outlined),
                selectedIcon: Icon(Icons.devices_other),
                label: Text('Device'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.lock_outline),
                selectedIcon: Icon(Icons.lock),
                label: Text('Lock'),
              ),
              NavigationRailDestination(
                icon: Icon(Icons.logout),
                selectedIcon: Icon(Icons.logout),
                label: Text('Sign out'),
              ),
            ],
            onDestinationSelected: (index) async {
              if (index == 2) {
                await _lock();
                return;
              }
              if (index == 3) {
                await _signOut();
                return;
              }
              if (index == 1) {
                if (!mounted) return;
                Navigator.of(context).pushNamed(FieldRoutes.deviceStatus);
                return;
              }
              setState(() => _selectedIndex = index);
            },
          ),
          const VerticalDivider(width: 1),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.all(32),
              child: _HomePlaceholder(officerName: _officerName),
            ),
          ),
        ],
      ),
    );
  }
}

class _HomePlaceholder extends StatelessWidget {
  const _HomePlaceholder({this.officerName});

  final String? officerName;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Field operations',
          style: Theme.of(context).textTheme.headlineLarge,
        ),
        const SizedBox(height: 8),
        Text(
          officerName == null
              ? 'Signed in'
              : 'Signed in as $officerName',
          style: Theme.of(context).textTheme.bodyLarge,
        ),
        const SizedBox(height: 32),
        Expanded(
          child: Center(
            child: Card(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.construction, size: 64, color: FieldColors.orange),
                    const SizedBox(height: 16),
                    Text(
                      'Patrol shell placeholder',
                      style: Theme.of(context).textTheme.headlineMedium,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Sprint 1 covers device registration and officer auth. '
                      'Patrol and checkpoint flows arrive in a later sprint.',
                      textAlign: TextAlign.center,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}
