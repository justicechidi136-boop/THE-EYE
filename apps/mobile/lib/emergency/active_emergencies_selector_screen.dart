import "package:flutter/material.dart";

import "../design_system/components/eye_page_back_header.dart";
import "../design_system/eye_semantic_colors.dart";
import "active_emergency_store.dart";

class ActiveEmergenciesSelectorScreen extends StatelessWidget {
  const ActiveEmergenciesSelectorScreen({
    super.key,
    required this.references,
  });

  final List<ActiveIncidentReference> references;

  String _shortId(String incidentId) {
    if (incidentId.length <= 8) return incidentId;
    return "${incidentId.substring(0, 8)}…";
  }

  @override
  Widget build(BuildContext context) {
    final colors = EyeSemanticColors.of(context);
    return Scaffold(
      backgroundColor: colors.background,
      appBar: AppBar(title: const Text("Active emergencies")),
      body: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: references.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final ref = references[index];
          return Card(
            child: ListTile(
              title: Text(ref.lastKnownStatus ?? "Active emergency"),
              subtitle: Text(
                "ID ${_shortId(ref.incidentId)}\n"
                "Reported ${ref.activatedAt.toLocal()}",
              ),
              isThreeLine: true,
              trailing: const Icon(Icons.chevron_right),
              onTap: () {
                Navigator.of(context).pushNamed(
                  "/active-emergency/${ref.incidentId}",
                  arguments: {
                    "incidentId": ref.incidentId,
                    "silent": ref.silent,
                  },
                );
              },
            ),
          );
        },
      ),
    );
  }
}

class NoActiveEmergencyScreen extends StatelessWidget {
  const NoActiveEmergencyScreen({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text("Active emergency")),
      body: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            EyePageBackHeader(
              title: "No active emergency",
              onBack: () => Navigator.of(context).maybePop(),
            ),
            const SizedBox(height: 16),
            const Text(
              "You do not have an active emergency report open right now.",
            ),
            const SizedBox(height: 16),
            FilledButton(
              onPressed: () =>
                  Navigator.of(context).pushReplacementNamed("/home"),
              child: const Text("Go home"),
            ),
          ],
        ),
      ),
    );
  }
}
