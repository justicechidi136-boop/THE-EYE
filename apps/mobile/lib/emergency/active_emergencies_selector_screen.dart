import "package:flutter/material.dart";

import "../design_system/components/eye_incident_summary_card.dart";
import "../design_system/components/eye_page_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "../presentation/citizen_presentation.dart";
import "active_emergency_store.dart";

typedef ActiveEmergencyListLoader = Future<List<ActiveEmergencySnapshot>>
    Function();

class ActiveEmergenciesSelectorScreen extends StatefulWidget {
  const ActiveEmergenciesSelectorScreen({
    super.key,
    required this.loadItems,
  });

  final ActiveEmergencyListLoader loadItems;

  @override
  State<ActiveEmergenciesSelectorScreen> createState() =>
      _ActiveEmergenciesSelectorScreenState();
}

class _ActiveEmergenciesSelectorScreenState
    extends State<ActiveEmergenciesSelectorScreen> {
  List<ActiveEmergencySnapshot> _items = const [];
  bool _loading = true;
  bool _failed = false;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _failed = false;
    });
    try {
      final items = await widget.loadItems();
      if (!mounted) return;
      setState(() => _items = items);
    } catch (_) {
      if (!mounted) return;
      setState(() => _failed = true);
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  void _open(ActiveEmergencySnapshot item) {
    Navigator.of(context).pushNamed(
      "/active-emergency/${item.incidentId}",
      arguments: {
        "incidentId": item.incidentId,
        "silent": item.silent,
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Scaffold(
      backgroundColor: colors.background,
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EyePageHeader.secondary(
            title: "Active emergencies",
            actions: [
              IconButton(
                tooltip: "Refresh active emergencies",
                onPressed: _loading ? null : _load,
                icon: const Icon(Icons.refresh),
              ),
            ],
          ),
          Expanded(child: _buildBody()),
        ],
      ),
    );
  }

  Widget _buildBody() {
    if (_loading && _items.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    if (_failed && _items.isEmpty) {
      return _ActiveEmergencyMessage(
        icon: Icons.cloud_off_outlined,
        title: "Unable to load active emergencies",
        message: "Check your connection and try again.",
        actionLabel: "Retry",
        onAction: _load,
      );
    }
    if (_items.isEmpty) {
      return const _ActiveEmergencyMessage(
        icon: Icons.check_circle_outline,
        title: "No active emergencies",
        message: "You do not have an active emergency report right now.",
      );
    }
    return RefreshIndicator(
      onRefresh: _load,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _items.length,
        itemBuilder: (context, index) {
          final item = _items[index];
          return EyeIncidentSummaryCard.fromIncidentFields(
            key: ValueKey("active-emergency-${item.incidentId}"),
            title: citizenIncidentCategoryLabel(item.type),
            incidentId: item.incidentId,
            status: item.status,
            reportedAt: item.reportedAt,
            apiPublicReference: item.publicReference,
            onTap: () => _open(item),
            unreadCount: item.unreadUpdatesCount,
            semanticsSuffix: "Tap to open active emergency details",
          );
        },
      ),
    );
  }
}

class _ActiveEmergencyMessage extends StatelessWidget {
  const _ActiveEmergencyMessage({
    required this.icon,
    required this.title,
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final IconData icon;
  final String title;
  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 42),
            const SizedBox(height: 12),
            Text(
              title,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
            ),
            const SizedBox(height: 6),
            Text(message, textAlign: TextAlign.center),
            if (actionLabel != null && onAction != null) ...[
              const SizedBox(height: 16),
              FilledButton(
                onPressed: onAction,
                child: Text(actionLabel!),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class NoActiveEmergencyScreen extends StatelessWidget {
  const NoActiveEmergencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          EyePageHeader.secondary(
            title: "No active emergency",
            onBack: () => Navigator.of(context).maybePop(),
          ),
          const Padding(
            padding: EdgeInsets.all(16),
            child: Text(
              "You do not have an active emergency report open right now.",
            ),
          ),
          Padding(
            padding: const EdgeInsets.symmetric(horizontal: 16),
            child: FilledButton(
              onPressed: () =>
                  Navigator.of(context).pushReplacementNamed("/home"),
              child: const Text("Go home"),
            ),
          ),
        ],
      ),
    );
  }
}
