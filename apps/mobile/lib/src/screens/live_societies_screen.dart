import 'dart:async';

import 'package:flutter/material.dart';

import '../auth/api_auth_service.dart';
import '../state/demo_store.dart';

/// Authenticated society data shared by all five mobile roles.
class LiveSocietiesScreen extends StatefulWidget {
  const LiveSocietiesScreen({super.key});
  @override
  State<LiveSocietiesScreen> createState() => _LiveSocietiesState();
}

class _LiveSocietiesState extends State<LiveSocietiesScreen> {
  List<dynamic>? _rows;
  String? _error;
  int _page = 1, _pages = 1;
  String _search = '';
  final _query = TextEditingController();
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  @override
  void dispose() {
    _query.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    setState(() {
      _rows = null;
      _error = null;
    });
    try {
      final data = await DemoScope.read(context).identityApi.request(
        '/societies?page=$_page&pageSize=50&search=${Uri.encodeQueryComponent(_search)}',
      );
      if (mounted) {
        setState(() {
          _rows = data['data'] as List;
          _pages = data['meta']['totalPages'] as int;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is IdentityError
              ? e.message
              : 'Cannot load societies. Check your connection.',
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: AppBar(title: const Text('Your societies')),
    body: Column(
      children: [
        Padding(
          padding: const EdgeInsets.all(16),
          child: TextField(
            controller: _query,
            decoration: InputDecoration(
              labelText: 'Search society name or S number',
              suffixIcon: IconButton(
                icon: const Icon(Icons.search),
                onPressed: () {
                  _search = _query.text;
                  _page = 1;
                  _load();
                },
              ),
            ),
            onSubmitted: (v) {
              _search = v;
              _page = 1;
              _load();
            },
          ),
        ),
        if (_error != null) ...[
          Text(_error!),
          TextButton(onPressed: _load, child: const Text('Retry')),
        ],
        if (_rows == null && _error == null) const LinearProgressIndicator(),
        Expanded(
          child: RefreshIndicator(
            onRefresh: _load,
            child: ListView(
              children: [
                if (_rows?.isEmpty ?? false)
                  const ListTile(
                    title: Text('No societies found'),
                    subtitle: Text('HQ manages your assigned societies.'),
                  ),
                for (final row in _rows ?? [])
                  ListTile(
                    title: Text(row['nameEn'] as String),
                    subtitle: Text(
                      '${row['societyCode']} · ${row['district']['nameEn']}',
                    ),
                    trailing: const Icon(Icons.chevron_right),
                    onTap: () => Navigator.push(
                      context,
                      MaterialPageRoute<void>(
                        builder: (_) =>
                            LiveSocietyScreen(id: row['id'] as String),
                      ),
                    ),
                  ),
              ],
            ),
          ),
        ),
        Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            TextButton(
              onPressed: _page > 1
                  ? () {
                      _page--;
                      _load();
                    }
                  : null,
              child: const Text('Previous'),
            ),
            Text('Page $_page of ${_pages < 1 ? 1 : _pages}'),
            TextButton(
              onPressed: _page < _pages
                  ? () {
                      _page++;
                      _load();
                    }
                  : null,
              child: const Text('Next'),
            ),
          ],
        ),
      ],
    ),
  );
}

class LiveSocietyScreen extends StatefulWidget {
  const LiveSocietyScreen({super.key, required this.id});
  final String id;
  @override
  State<LiveSocietyScreen> createState() => _LiveSocietyState();
}

class _LiveSocietyState extends State<LiveSocietyScreen> {
  Map<String, dynamic>? _record;
  String? _error;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _load());
  }

  Future<void> _load() async {
    try {
      final data = await DemoScope.read(context).identityApi
          .request('/societies/${widget.id}');
      if (mounted) {
        setState(() {
          _record = data as Map<String, dynamic>;
          _error = null;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(
          () => _error = e is IdentityError
              ? e.message
              : 'Could not load this society.',
        );
      }
    }
  }

  Future<void> _edit() async {
    final name = TextEditingController(text: _record!['nameEn'] as String),
        address = TextEditingController(
          text: (_record!['address'] as Map)['addressLine'] as String?,
        );
    final save = await showDialog<bool>(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Update society profile'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: name,
              decoration: const InputDecoration(labelText: 'Society name'),
            ),
            TextField(
              controller: address,
              decoration: const InputDecoration(labelText: 'Address'),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c, false),
            child: const Text('Cancel'),
          ),
          FilledButton(
            onPressed: () => Navigator.pop(c, true),
            child: const Text('Save changes'),
          ),
        ],
      ),
    );
    if (save == true && mounted) {
      try {
        await DemoScope.read(context).identityApi.request(
          '/societies/${widget.id}/profile',
          method: 'PATCH',
          body: {
            'nameEn': name.text.trim(),
            'addressLine': address.text.trim(),
          },
        );
        await _load();
      } catch (e) {
        if (mounted) {
          setState(
            () => _error = e is IdentityError
                ? e.message
                : 'Could not save. Your record was not updated.',
          );
        }
      }
    }
    name.dispose();
    address.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final user = DemoScope.of(context).user!;
    final canEdit = user.canEditSociety(widget.id);
    return Scaffold(
      appBar: AppBar(
        title: Text(_record?['nameEn'] as String? ?? 'Society record'),
      ),
      body: ListView(
        padding: const EdgeInsets.all(20),
        children: [
          if (_error != null) ...[
            Text(_error!),
            TextButton(onPressed: _load, child: const Text('Retry')),
          ],
          if (_record == null && _error == null)
            const LinearProgressIndicator(),
          if (_record != null) ...[
            Text(
              '${_record!['societyCode']} · ${_record!['district']['nameEn']}',
            ),
            Text(
              canEdit
                  ? 'You can edit this assigned society.'
                  : 'View-only access',
            ),
            Text(
              '${_record!['address']['addressLine'] ?? 'Address not recorded'}',
            ),
            if (canEdit)
              FilledButton(onPressed: _edit, child: const Text('Edit profile')),
            const Divider(),
            const Text('Executive council', style: TextStyle(fontSize: 20)),
            for (final m in _record!['committee'] as List)
              Card(
                child: ListTile(
                  title: Text(m['fullName'] as String),
                  subtitle: Text('${m['position']}'),
                  trailing: NicRevealButton(
                    societyId: widget.id,
                    memberId: m['id'] as String,
                    masked: m['nicMasked'] as String?,
                  ),
                ),
              ),
          ],
        ],
      ),
    );
  }
}

class NicRevealButton extends StatefulWidget {
  const NicRevealButton({
    super.key,
    required this.societyId,
    required this.memberId,
    this.masked,
  });
  final String societyId, memberId;
  final String? masked;
  @override
  State<NicRevealButton> createState() => _NicRevealState();
}

class _NicRevealState extends State<NicRevealButton>
    with WidgetsBindingObserver {
  String? _nic;
  Timer? _timer;
  bool _busy = false;
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    _timer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state != AppLifecycleState.resumed && mounted) {
      setState(() => _nic = null);
    }
  }

  Future<void> _show() async {
    if (_nic != null) {
      _timer?.cancel();
      setState(() => _nic = null);
      return;
    }
    setState(() => _busy = true);
    try {
      final data = await DemoScope.read(context).identityApi.request(
        '/societies/${widget.societyId}/council/${widget.memberId}/nic/reveal',
        method: 'POST',
      );
      if (mounted) {
        setState(() => _nic = data['nic'] as String);
        _timer = Timer(const Duration(seconds: 30), () {
          if (mounted) setState(() => _nic = null);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is IdentityError ? e.message : 'Could not reveal NIC.',
            ),
          ),
        );
      }
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  @override
  Widget build(BuildContext context) => TextButton(
    onPressed: _busy || widget.masked == null ? null : _show,
    child: Text(
      _busy ? 'Loading…' : _nic ?? '${widget.masked ?? 'No NIC'} · Show',
    ),
  );
}
