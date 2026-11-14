import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/count_field.dart' show parseCount;
import 'edit_society_screen.dart' show maxMembers;
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// Issue #143: the society's members at the top of Members & Exco. These are
/// everyone in the society, not the 25 Exco seats shown underneath.
///
/// A figure that has not been entered says so; it is never shown as 0.
class MembershipCard extends StatelessWidget {
  const MembershipCard({super.key, required this.record, this.onEdit});

  final SocietyRecord record;

  /// Null for people who may only view the society.
  final VoidCallback? onEdit;

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final total = record.memberCount;
    String count(int? value) =>
        value == null ? l.memNotEntered : l.number(value);
    final updated = record.membershipUpdatedAt;
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        RecordCard(
          title: l.memTitle,
          trailing: onEdit == null
              ? null
              : Semantics(
                  button: true,
                  label: l.memEditLabel,
                  excludeSemantics: true,
                  // Small, but keeps the 48 px touch target.
                  child: TextButton.icon(
                    key: const ValueKey('membership.edit'),
                    onPressed: onEdit,
                    style: TextButton.styleFrom(
                      minimumSize: const Size(48, 48),
                      padding: const EdgeInsets.symmetric(horizontal: 8),
                    ),
                    icon: const Icon(Icons.edit_outlined, size: 14),
                    label: Text(l.recEdit),
                  ),
                ),
          children: [
            Text(l.editTotal, style: RecordStyle.label),
            const SizedBox(height: 2),
            Text(
              total == null ? l.memNotEntered : l.number(total),
              key: const ValueKey('membership.total'),
              style: total == null
                  ? RecordStyle.value.copyWith(
                      color: AppColors.muted,
                      fontWeight: FontWeight.w500,
                    )
                  : const TextStyle(
                      fontSize: 26,
                      fontWeight: FontWeight.w800,
                      color: AppColors.ink,
                    ),
            ),
            const SizedBox(height: 12),
            KeyValueGrid([
              KeyValue(
                l.editFemale,
                count(record.femaleMembers),
                missing: record.femaleMembers == null,
              ),
              KeyValue(
                l.editMale,
                count(record.maleMembers),
                missing: record.maleMembers == null,
              ),
              KeyValue(
                l.memUnder18,
                count(record.under18Members),
                missing: record.under18Members == null,
              ),
            ]),
            const SizedBox(height: 10),
            Text(
              !record.hasMemberSplit
                  ? l.memSplitMissing
                  : record.under18Members == null
                  ? l.memUnder18Missing
                  : l.memUnder18Part,
              style: RecordStyle.caption,
            ),
          ],
        ),
        const SizedBox(height: 6),
        Text(
          updated == null
              ? l.memLastUpdatedNever
              : l.memLastUpdated(l.savedAt(updated)),
          key: const ValueKey('membership.updated'),
          style: RecordStyle.caption,
        ),
      ],
    );
  }
}

/// Issue #143: female, male and under 18s, typed straight in. The total is
/// female + male, worked out as you type and again by the API. Under 18s are
/// a part of that total. Pops true once saved.
class EditMembershipScreen extends StatefulWidget {
  const EditMembershipScreen({super.key, required this.record});

  final SocietyRecord record;

  @override
  State<EditMembershipScreen> createState() => _EditMembershipScreenState();
}

class _EditMembershipScreenState extends State<EditMembershipScreen> {
  late final _female = TextEditingController(
    text: widget.record.femaleMembers?.toString() ?? '',
  );
  late final _male = TextEditingController(
    text: widget.record.maleMembers?.toString() ?? '',
  );
  late final _under18 = TextEditingController(
    text: widget.record.under18Members?.toString() ?? '',
  );
  bool _submitted = false;
  bool _saving = false;
  String? _serverError;

  @override
  void initState() {
    super.initState();
    for (final controller in [_female, _male, _under18]) {
      controller.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    _female.dispose();
    _male.dispose();
    _under18.dispose();
    super.dispose();
  }

  int? _count(TextEditingController c) => parseCount(c.text, max: maxMembers);

  bool _touched(TextEditingController c, int? saved) =>
      _submitted || c.text.trim() != (saved?.toString() ?? '');

  /// The same rules as #141's edit screen, so both say the same thing.
  String? get _splitError {
    final l = context.l10n;
    final female = _female.text.trim(), male = _male.text.trim();
    if ((female.isNotEmpty && _count(_female) == null) ||
        (male.isNotEmpty && _count(_male) == null)) {
      return l.editMembersFormat;
    }
    if (female.isEmpty || male.isEmpty) return l.editMembersBoth;
    if (_count(_female)! + _count(_male)! > maxMembers) {
      return l.editMembersTooMany;
    }
    return null;
  }

  int? get _total =>
      _splitError == null ? _count(_female)! + _count(_male)! : null;

  String? get _under18Error {
    final l = context.l10n;
    final text = _under18.text.trim();
    if (text.isEmpty) {
      // Leaving it empty keeps "not entered"; a saved figure cannot be
      // blanked, only changed (0 is a figure).
      return widget.record.under18Members == null ? null : l.memUnder18Required;
    }
    final under18 = _count(_under18);
    if (under18 == null) return l.editMembersFormat;
    final total = _total;
    if (total != null && under18 > total) return l.memUnder18TooMany(total);
    return null;
  }

  Future<void> _save() async {
    setState(() {
      _submitted = true;
      _serverError = null;
    });
    if (_splitError != null || _under18Error != null) return;
    final female = _count(_female)!, male = _count(_male)!;
    final under18 = _under18.text.trim().isEmpty ? null : _count(_under18);
    final record = widget.record;
    if (female == record.femaleMembers &&
        male == record.maleMembers &&
        under18 == record.under18Members) {
      Navigator.of(context).pop(false);
      return;
    }
    setState(() => _saving = true);
    final l = context.l10n;
    try {
      await DemoScope.read(context).societyRecords.updateRecord(record.id, {
        // The API works out the total from these two.
        'femaleMembers': female,
        'maleMembers': male,
        'under18Members': ?under18,
      });
      if (!mounted) return;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(l.memSaved)));
      Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      // Nothing was saved: the typed figures stay and Last updated is not
      // moved, because the record is not reloaded.
      if (mounted) {
        setState(() {
          _saving = false;
          _serverError = l.recStillHere(l.recordError(error));
        });
      }
    }
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    required bool showError,
    Key? key,
  }) => Column(
    crossAxisAlignment: CrossAxisAlignment.stretch,
    children: [
      FieldLabel(label, required: true),
      TextField(
        key: key,
        controller: controller,
        enabled: !_saving,
        keyboardType: TextInputType.number,
        style: recordInputStyle,
        // The message is shown once, under both boxes.
        decoration: changedDecoration(
          changed: false,
          error: showError ? '' : null,
        ),
      ),
    ],
  );

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final record = widget.record;
    final splitError =
        _touched(_female, record.femaleMembers) ||
            _touched(_male, record.maleMembers)
        ? _splitError
        : null;
    final under18Error = _touched(_under18, record.under18Members)
        ? _under18Error
        : null;
    final total = _total;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.memEditTitle, style: RecordStyle.screenTitle),
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
        children: [
          RecordNote(icon: Icons.info_outline, message: l.memEditIntro),
          const SizedBox(height: 14),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: _field(
                  _female,
                  l.editFemale,
                  showError: splitError != null,
                  key: const ValueKey('membership.female'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _field(
                  _male,
                  l.editMale,
                  showError: splitError != null,
                  key: const ValueKey('membership.male'),
                ),
              ),
            ],
          ),
          if (splitError != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                splitError,
                style: const TextStyle(fontSize: 12, color: AppColors.danger),
              ),
            ),
          const SizedBox(height: 12),
          FieldLabel(l.editTotal),
          Semantics(
            label: l.editTotal,
            value: total == null ? '—' : l.number(total),
            liveRegion: true,
            readOnly: true,
            excludeSemantics: true,
            child: ReadOnlyField(
              total == null ? '—' : l.number(total),
              key: const ValueKey('membership.formTotal'),
            ),
          ),
          const SizedBox(height: 4),
          Text(l.editTotalHelp, style: RecordStyle.caption),
          const SizedBox(height: 14),
          FieldLabel(l.memUnder18),
          TextField(
            key: const ValueKey('membership.under18'),
            controller: _under18,
            enabled: !_saving,
            keyboardType: TextInputType.number,
            style: recordInputStyle,
            decoration: changedDecoration(
              changed: false,
              helper: l.memUnder18Help,
              error: under18Error,
            ),
          ),
          if (_serverError != null) ...[
            const SizedBox(height: 14),
            RecordNote(
              icon: Icons.error_outline,
              tone: NoteTone.error,
              message: _serverError!,
            ),
          ],
          const SizedBox(height: 20),
          Wrap(
            alignment: WrapAlignment.end,
            spacing: 10,
            runSpacing: 8,
            children: [
              OutlinedButton(
                onPressed: _saving
                    ? null
                    : () => Navigator.of(context).pop(false),
                child: Text(l.editCancel),
              ),
              FilledButton(
                key: const ValueKey('membership.save'),
                onPressed: _saving ? null : _save,
                child: Text(l.editSave),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
