import 'dart:async';

import 'package:flutter/material.dart';

import '../app.dart';
import '../data/demo_data.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../widgets/demo_options_sheet.dart';
import '../widgets/state_views.dart';
import 'emergency_response_screen.dart';

class V4RoleHomeScreen extends StatefulWidget {
  const V4RoleHomeScreen({super.key, required this.role});
  final UserRole role;
  @override
  State<V4RoleHomeScreen> createState() => _RoleHomeState();
}

class _RoleHomeState extends State<V4RoleHomeScreen> {
  Timer? _timer;
  int? _total;
  String? _error;
  bool _loading = false;
  @override
  void initState() {
    super.initState();
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (!DemoStore.demoMode && _total == null && !_loading && _error == null) {
      _load();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  Future<void> _load() async {
    if (DemoStore.demoMode) {
      setState(() => _error = null);
      return;
    }
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      await DemoScope.read(context).refreshIdentity();
      if (!mounted) return;
      final data = await DemoScope.read(context).identityApi
          .request('/societies?page=1&pageSize=1');
      if (mounted) setState(() => _total = data['meta']['totalItems'] as int);
    } catch (_) {
      if (mounted) {
        setState(
          () =>
              _error = 'Could not load your societies. Check your connection.',
        );
      }
    } finally {
      if (mounted) setState(() => _loading = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context), user = DemoScope.of(context).user!;
    final grants = user.delegatedDistrictAccess
        .where((g) => g.activeAt(store.now))
        .toList();
    if (store.failLoads) {
      return Scaffold(
        body: StateMessage(
          icon: Icons.error_outline,
          title: 'Something went wrong',
          message: 'Could not load your overview.',
          primaryLabel: 'Try again',
          onPrimary: () => store.setDemoOptions(failLoads: false),
        ),
      );
    }
    if (store.emptyRecords) {
      return const Scaffold(
        body: StateMessage(
          icon: Icons.inbox_outlined,
          title: 'No records yet',
          message: 'Societies assigned to your role will appear here.',
        ),
      );
    }
    if (grants.isNotEmpty && _timer == null) {
      final expires = grants
          .map((g) => g.expiresAt)
          .reduce((a, b) => a.isBefore(b) ? a : b);
      _timer = Timer(expires.difference(store.now), () {
        _timer = null;
        if (mounted) setState(() {});
      });
    }
    final count = DemoStore.demoMode
        ? demoSocieties
              .where((s) => user.canViewSociety(s.id, s.district.id, store.now))
              .length
        : _total;
    return Scaffold(
      appBar: AppBar(
        title: Text('${widget.role.label} home'),
        actions: [
          if (DemoStore.demoMode)
            IconButton(
              tooltip: 'Demo options',
              onPressed: () => showDemoOptions(context),
              icon: const Icon(Icons.tune),
            ),
        ],
      ),
      body: RefreshIndicator(
        onRefresh: _load,
        child: ListView(
          padding: const EdgeInsets.all(20),
          children: [
            Text(
              'Welcome, ${user.displayName}',
              style: Theme.of(context).textTheme.headlineSmall,
            ),
            const SizedBox(height: 12),
            Text(switch (widget.role) {
              UserRole.programmeCoordinator =>
                'View and update your assigned societies.',
              UserRole.deputyDistrictManager => 'Edit assigned societies. Temporary district access is view-only.',
              UserRole.districtManager => 'View all societies in your district and manage temporary DDM access.',
              UserRole.hqAdmin => 'National summary. Use the HQ dashboard for accounts and administration.',
              _ => 'View and update your society.',
            }),
            for (final grant in grants)
              Card(
                color: Colors.amber.shade100,
                child: Padding(
                  padding: const EdgeInsets.all(16),
                  child: Text(
                    'Temporary district view · ${grant.districtId}\nEnds ${grant.expiresAt.toLocal()}. You can edit only your assigned societies.',
                  ),
                ),
              ),
            if (_loading) const LinearProgressIndicator(),
            if (_error != null) ...[
              Text(_error!),
              TextButton(onPressed: _load, child: const Text('Try again')),
            ],
            Card(
              child: ListTile(
                leading: const Icon(Icons.holiday_village),
                title: Text('${count ?? '…'} societies in your scope'),
                subtitle: const Text(
                  'Your role and assignments determine what appears here.',
                ),
                onTap: () => store.selectTab(HomeShell.societyTab),
              ),
            ),
            ListTile(
              leading: const Icon(Icons.holiday_village_outlined),
              title: const Text('Open societies'),
              trailing: const Icon(Icons.chevron_right),
              onTap: () => store.selectTab(HomeShell.societyTab),
            ),
            ListTile(
              leading: const Icon(Icons.warning_amber_outlined),
              title: const Text('Disaster response'),
              subtitle: const Text('Live incidents and rapid assessments'),
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute<void>(
                  builder: (_) => const EmergencyResponseScreen(),
                ),
              ),
            ),
            if (widget.role == UserRole.districtManager)
              ListTile(
                leading: const Icon(Icons.schedule),
                title: const Text('Temporary DDM access'),
                subtitle: const Text(
                  'Grant, check expiry or revoke district view',
                ),
                onTap: () => store.selectTab(HomeShell.roleWorkTab),
              ),
          ],
        ),
      ),
    );
  }
}
