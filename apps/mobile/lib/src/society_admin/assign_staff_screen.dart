import 'package:flutter/material.dart';

import '../society_record/record_widgets.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../widgets/state_views.dart';
import 'society_admin_api.dart';

/// HQ on the phone: choose who looks after a society (V5 D05a, as on the
/// dashboard): one DDM, one SPC and one Society Officer from its district.
/// The DM covers the whole district, so they are shown, not chosen. The
/// server checks HQ, each role and the district, and signs out anyone whose
/// access changes.
class AssignStaffScreen extends StatefulWidget {
  const AssignStaffScreen({
    super.key,
    required this.societyId,
    required this.societyName,
    this.justCreated = false,
  });

  final String societyId;
  final String societyName;

  /// Step 2 after Create a society: saving opens the new record.
  final bool justCreated;

  @override
  State<AssignStaffScreen> createState() => _AssignStaffScreenState();
}

class _AssignStaffScreenState extends State<AssignStaffScreen> {
  Future<StaffChoices>? _choices;
  final Map<String, String?> _chosen = {};
  Map<String, String?> _before = const {};
  bool _saving = false;
  String? _error;

  static const _roles = [
    (
      key: 'deputyId',
      label: 'Deputy District Manager (DDM)',
      hint: 'Can view and edit this society.',
    ),
    (
      key: 'coordinatorId',
      label: 'Society Program Coordinator (SPC)',
      hint: 'Can view and edit this society.',
    ),
    (
      key: 'officerId',
      label: 'Society Officer',
      hint: 'One officer per society. Can view and edit only this society, and enters its Exco.',
    ),
  ];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _choices ??= _load();
  }

  Future<StaffChoices> _load() async {
    final choices = await DemoScope.read(context).societyAdmin
        .fetchStaffChoices(widget.societyId);
    String? current(List<StaffChoice> options) =>
        options.where((option) => option.assignedHere).firstOrNull?.id;
    _before = {
      'deputyId': current(choices.deputies),
      'coordinatorId': current(choices.coordinators),
      'officerId': current(choices.officers),
    };
    _chosen
      ..clear()
      ..addAll(_before);
    return choices;
  }

  List<StaffChoice> _options(StaffChoices choices, String key) => switch (key) {
    'deputyId' => choices.deputies,
    'coordinatorId' => choices.coordinators,
    _ => choices.officers,
  };

  bool get _complete => _roles.every((role) => _chosen[role.key] != null);

  void _openRecord() => Navigator.of(context).pushReplacement(
    MaterialPageRoute<void>(
      builder: (_) => SocietyRecordScreen(societyId: widget.societyId),
    ),
  );

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await DemoScope.read(context).societyAdmin.assignStaff(
        widget.societyId,
        deputyId: _chosen['deputyId']!,
        coordinatorId: _chosen['coordinatorId']!,
        officerId: _chosen['officerId']!,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text(
            'Staff assigned. The change is in the society history.',
          ),
        ),
      );
      if (widget.justCreated) {
        _openRecord();
      } else {
        Navigator.of(context).pop(true);
      }
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = error.message;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: recordFormAppBar(
      context,
      title: 'Assign Responsible Staff',
      subtitle: widget.justCreated
          ? 'Step 2 of 2 · ${widget.societyName}'
          : widget.societyName,
      onClose: widget.justCreated ? _openRecord : null,
    ),
    body: FutureBuilder<StaffChoices>(
      future: _choices,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const LoadingSkeleton(label: 'Loading staff');
        }
        if (snapshot.hasError) {
          final error = snapshot.error;
          return StateMessage(
            icon: Icons.error_outline,
            title: 'We Couldn’t Load the Staff',
            message: error is SocietyRecordException
                ? error.message
                : 'Check the connection and try again.',
            tone: StateTone.error,
            isAlert: true,
            primaryLabel: 'Try again',
            onPrimary: () => setState(() => _choices = _load()),
          );
        }
        final choices = snapshot.data!;
        final dms = choices.districtManagers;
        return ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          children: [
            if (widget.justCreated) ...[
              NoticeBanner(
                icon: Icons.check_circle_outline,
                tone: NoticeTone.success,
                title: '${widget.societyName} Was Created',
                message: 'Its Exco is not entered yet. Choose the Society Officer who will add the 25 members.',
              ),
              const SizedBox(height: 14),
            ],
            const FieldLabel('District Manager (DM)'),
            ReadOnlyField(
              dms.isEmpty
                  ? 'No DM has this district yet'
                  : dms.map((dm) => dm.displayName).join(', '),
            ),
            const Padding(
              padding: EdgeInsets.only(top: 4, bottom: 14),
              child: Text(
                'Views all societies in the district. View only.',
                style: RecordStyle.caption,
              ),
            ),
            for (final role in _roles) ...[
              FieldLabel(role.label, required: true),
              () {
                final options = _options(choices, role.key);
                final before = _before[role.key];
                final chosen = _chosen[role.key];
                final changedFrom = chosen != before && before != null
                    ? options
                          .where((option) => option.id == before)
                          .firstOrNull
                          ?.displayName
                    : null;
                if (options.isEmpty) {
                  return const Padding(
                    padding: EdgeInsets.only(bottom: 14),
                    child: Text(
                      'Nobody with this role works in the district yet. Create the account on the dashboard first.',
                      style: RecordStyle.caption,
                    ),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: DropdownButtonFormField<String>(
                    initialValue: chosen,
                    isExpanded: true,
                    hint: const Text('Choose a person'),
                    decoration: changedDecoration(
                      changed: chosen != before,
                      helper: [
                        if (changedFrom != null) 'Changing from $changedFrom.',
                        role.hint,
                      ].join(' '),
                    ),
                    items: [
                      for (final option in options)
                        DropdownMenuItem(
                          value: option.id,
                          child: Text(
                            role.key == 'officerId' &&
                                    !option.assignedHere &&
                                    option.otherSocieties > 0
                                ? '${option.displayName} (moves from another society)'
                                : option.displayName,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                    ],
                    onChanged: _saving
                        ? null
                        : (value) => setState(() => _chosen[role.key] = value),
                  ),
                );
              }(),
            ],
            const NoticeBanner(
              icon: Icons.history,
              title: 'Recorded in the Society History',
              message: 'The change is saved with your name and the time. Anyone whose access changes is signed out.',
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: 'Not Saved',
                message: _error,
              ),
            ],
          ],
        );
      },
    ),
    bottomNavigationBar: BottomActionBar(
      secondary: OutlinedButton(
        onPressed: _saving
            ? null
            : widget.justCreated
            ? _openRecord
            : () => Navigator.of(context).maybePop(),
        child: Text(widget.justCreated ? 'Later' : 'Cancel'),
      ),
      primary: FilledButton(
        onPressed: _saving || !_complete ? null : _save,
        child: Text(_saving ? 'Saving…' : 'Save assignments'),
      ),
    ),
  );
}
