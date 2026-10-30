import 'dart:async';

import 'package:flutter/material.dart';

import '../state/demo_store.dart';
import 'society_record_api.dart';

/// Shows a member's full NIC for 30 seconds. The API checks scope and records
/// every reveal; the NIC hides again when the app goes to the background.
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
      final nic = await DemoScope.read(context).societyRecords
          .revealNic(widget.societyId, widget.memberId);
      if (mounted) {
        setState(() => _nic = nic);
        _timer = Timer(const Duration(seconds: 30), () {
          if (mounted) setState(() => _nic = null);
        });
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              e is SocietyRecordException ? e.message : 'Could not reveal NIC.',
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
