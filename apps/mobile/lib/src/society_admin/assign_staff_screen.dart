import 'package:flutter/material.dart';

import '../society_record/record_widgets.dart';
import '../society_record/society_record_screen.dart';
import '../state/demo_store.dart';
import '../widgets/state_views.dart';
import 'society_admin_api.dart';
import '../l10n/l10n.dart';
import '../l10n/record_l10n.dart';

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

  AppLocalizations get _l => context.l10n;

  List<({String key, String label, String hint})> get _roles => [
    (key: 'deputyId', label: _l.adminDeputy, hint: _l.adminViewEdit),
    (key: 'coordinatorId', label: _l.adminCoordinator, hint: _l.adminViewEdit),
    (
      key: 'officerId',
      label: _l.recRoleSocietyOfficer,
      hint: _l.adminOfficerHint,
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
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(_l.adminStaffAssigned)));
      if (widget.justCreated) {
        _openRecord();
      } else {
        Navigator.of(context).pop(true);
      }
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _error = _l.recordError(error);
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    appBar: recordFormAppBar(
      context,
      title: _l.adminAssignTitle,
      subtitle: widget.justCreated
          ? _l.adminStep2(widget.societyName)
          : widget.societyName,
      onClose: widget.justCreated ? _openRecord : null,
    ),
    body: FutureBuilder<StaffChoices>(
      future: _choices,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return LoadingSkeleton(label: _l.adminLoadingStaff);
        }
        if (snapshot.hasError) {
          final error = snapshot.error;
          return StateMessage(
            icon: Icons.error_outline,
            title: _l.adminStaffError,
            message: error is SocietyRecordException
                ? _l.recordError(error)
                : _l.adminCheckConnection,
            tone: StateTone.error,
            isAlert: true,
            primaryLabel: _l.commonTryAgain,
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
                title: _l.adminCreated(widget.societyName),
                message: _l.adminExcoNotEntered,
              ),
              const SizedBox(height: 14),
            ],
            FieldLabel(_l.adminDm),
            ReadOnlyField(
              dms.isEmpty
                  ? _l.adminNoDm
                  : dms.map((dm) => dm.displayName).join(', '),
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 14),
              child: Text(_l.adminDmViews, style: RecordStyle.caption),
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
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 14),
                    child: Text(_l.adminNobody, style: RecordStyle.caption),
                  );
                }
                return Padding(
                  padding: const EdgeInsets.only(bottom: 14),
                  child: DropdownButtonFormField<String>(
                    initialValue: chosen,
                    isExpanded: true,
                    hint: Text(_l.adminChoosePerson),
                    decoration: changedDecoration(
                      changed: chosen != before,
                      helper: [
                        if (changedFrom != null)
                          _l.adminChangingFrom(changedFrom),
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
                                ? _l.adminMoves(option.displayName)
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
            NoticeBanner(
              icon: Icons.history,
              title: _l.adminRecordedTitle,
              message: _l.adminRecordedBody,
            ),
            if (_error != null) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: _l.editNotSaved,
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
        child: Text(widget.justCreated ? _l.adminLater : _l.editCancel),
      ),
      primary: FilledButton(
        onPressed: _saving || !_complete ? null : _save,
        child: Text(_saving ? _l.recSaving : _l.adminSaveAssignments),
      ),
    ),
  );
}
