import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import '../auth/api_auth_service.dart';

class DistrictAccessScreen extends StatefulWidget {
  const DistrictAccessScreen({super.key});
  @override
  State<DistrictAccessScreen> createState() => _DistrictAccessState();
}

class _DistrictAccessState extends State<DistrictAccessScreen> {
  final _deputy = TextEditingController(), _reason = TextEditingController();
  DateTime _start = DateTime.now(),
      _end = DateTime.now().add(const Duration(days: 1));
  List<dynamic>? _grants;
  List<dynamic> _deputies = [];
  String? _selectedDeputy;
  String? _error;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _deputy.dispose();
    _reason.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    try {
      final api = DemoScope.read(context).identityApi;
      final data = await api.request('/identity/district-access');
      final deputies = await api.request('/identity/district-deputies');
      if (mounted) {
        setState(() {
          _grants = data['data'] as List;
          _deputies = deputies['data'] as List;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is IdentityError
              ? e.message
              : 'Could not load access history.',
        );
      }
    }
  }

  Future<void> _date(bool start) async {
    final day = await showDatePicker(
      context: context,
      initialDate: start ? _start : _end,
      firstDate: DateTime.now().subtract(const Duration(days: 1)),
      lastDate: DateTime.now().add(const Duration(days: 365)),
    );
    if (day == null || !mounted) return;
    final time = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(start ? _start : _end),
    );
    if (time == null) return;
    setState(() {
      final value = DateTime(
        day.year,
        day.month,
        day.day,
        time.hour,
        time.minute,
      );
      if (start) {
        _start = value;
      } else {
        _end = value;
      }
    });
  }

  Future<void> _grant() async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Confirm temporary district access'),
        content: Text(
          'This DDM can view every district society from $_start until $_end. Editing stays limited to their assignments.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Grant view access'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    setState(() {
      _busy = true;
      _error = null;
    });
    try {
      final store = DemoScope.read(context);
      await store.identityApi.request(
        '/identity/district-access',
        method: 'POST',
        body: {
          'deputyId': _selectedDeputy ?? '',
          'districtId': store.user!.districtIds.first,
          'startsAt': _start.toUtc().toIso8601String(),
          'expiresAt': _end.toUtc().toIso8601String(),
          'reason': _reason.text.trim(),
        },
      );
      await _load();
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is IdentityError
              ? e.message
              : 'Could not grant access.',
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  Future<void> _revoke(String id) async {
    final yes = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Revoke district view now?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Revoke'),
          ),
        ],
      ),
    );
    if (yes != true || !mounted) return;
    try {
      await DemoScope.read(context).identityApi
          .request('/identity/district-access/$id/revoke', method: 'POST');
      await _load();
    } catch (e) {
      if (mounted) {
        setState(() => _error = 'Could not revoke access. Please retry.');
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Temporary DDM access')),
    body: ListView(
      padding: const EdgeInsets.all(20),
      children: [
        const Text('View-only district access', style: TextStyle(fontSize: 22)),
        const Text(
          'Choose a DDM assigned to your district. Access ends automatically and can be revoked early.',
        ),
        if (_error != null)
          Text(_error!, style: const TextStyle(color: Colors.red)),
        DropdownButtonFormField<String>(
          initialValue: _selectedDeputy,
          decoration: const InputDecoration(labelText: 'District DDM'),
          items: _deputies
              .map(
                (d) => DropdownMenuItem(
                  value: d['id'] as String,
                  child: Text(d['displayName'] as String),
                ),
              )
              .toList(),
          onChanged: (v) => setState(() => _selectedDeputy = v),
        ),
        TextField(
          controller: _reason,
          decoration: const InputDecoration(labelText: 'Reason'),
        ),
        TextButton(
          onPressed: () => _date(true),
          child: Text('Starts: $_start'),
        ),
        TextButton(onPressed: () => _date(false), child: Text('Ends: $_end')),
        FilledButton(
          onPressed: _busy ? null : _grant,
          child: const Text('Review and grant access'),
        ),
        const Divider(),
        const Text('Access history'),
        if (_grants == null)
          TextButton(onPressed: _load, child: const Text('Load history')),
        for (final g in _grants ?? [])
          Card(
            child: ListTile(
              title: Text('${g['deputyId']}'),
              subtitle: Text(
                '${g['startsAt']} → ${g['expiresAt']}\n${g['revokedAt'] != null
                    ? 'Revoked'
                    : DateTime.parse(g['expiresAt'] as String).isBefore(DateTime.now())
                    ? 'Expired'
                    : 'Scheduled / active'}',
              ),
              trailing: g['revokedAt'] == null
                  ? TextButton(
                      onPressed: () => _revoke(g['id'] as String),
                      child: const Text('Revoke'),
                    )
                  : null,
            ),
          ),
      ],
    ),
  );
}
