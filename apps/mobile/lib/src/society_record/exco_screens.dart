import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
import 'nic_reveal_button.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

final _months = const [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', //
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

String formatBirthDate(DateTime date) =>
    '${date.day.toString().padLeft(2, '0')} ${_months[date.month - 1]} ${date.year}';

/// [formatBirthDate] in the chosen language's month names.
String _birthDate(AppLocalizations l, DateTime date) =>
    l.localeName == 'en' ? formatBirthDate(date) : l.date(date);

/// Whole years from a date of birth (V5: age is worked out, not typed).
int ageFrom(DateTime born, DateTime today) {
  var age = today.year - born.year;
  if (today.month < born.month ||
      (today.month == born.month && today.day < born.day)) {
    age -= 1;
  }
  return age;
}

String initialsOf(String name) => name
    .split(RegExp(r'[ .]+'))
    .where((part) => part.isNotEmpty)
    .take(2)
    .map((part) => part[0].toUpperCase())
    .join();

/// The filled seats with one seat replaced, one empty seat filled, or one
/// office moved. An office is held by one member, so its previous holder
/// becomes a member (V5 M07o).
List<Map<String, Object?>> councilWith(
  List<ExcoMember> exco, {
  ExcoMember? replacement,
  ({int seat, String office})? office,
}) {
  final targetOffice = replacement?.position ?? office?.office;
  final targetSeat = replacement?.seatNumber ?? office?.seat;
  return [
    for (final member in [
      ...exco,
      // Filling an empty seat adds it.
      if (replacement != null &&
          !exco.any((seat) => seat.seatNumber == replacement.seatNumber))
        replacement,
    ]..sort((a, b) => a.seatNumber.compareTo(b.seatNumber)))
      () {
        var seat = member.seatNumber == replacement?.seatNumber
            ? replacement!
            : member;
        if (seat.seatNumber == office?.seat) {
          seat = seat.copyWith(position: office!.office);
        } else if (targetOffice != null &&
            targetOffice != 'Member' &&
            seat.position == targetOffice &&
            seat.seatNumber != targetSeat) {
          seat = seat.copyWith(position: 'Member');
        }
        return seat.toCouncilJson();
      }(),
  ];
}

/// Why the viewer can see personal details (V5 M07v / M07d note).
String accessNote(SocietyRecord record) =>
    switch (record.permissions.viewOnlyReason) {
      ViewOnlyReason.districtManager =>
        'you can see personal details for societies in your district',
      ViewOnlyReason.temporaryDistrictAccess =>
        'you can see them during your temporary district view',
      null =>
        record.permissions.canEdit
            ? 'you can see them because this is your society'
            : 'you can see them because of your access',
    };

/// V5 M07v (and M07r when the NIC is shown, M07d for a DM): one Exco member.
class ExcoMemberScreen extends StatelessWidget {
  const ExcoMemberScreen({
    super.key,
    required this.record,
    required this.member,
  });

  final SocietyRecord record;
  final ExcoMember member;

  Future<void> _openForm(BuildContext context, {required bool replace}) async {
    final saved = await Navigator.of(context).push<bool>(
      MaterialPageRoute(
        builder: (_) => ExcoMemberFormScreen(
          record: record,
          member: member,
          replace: replace,
        ),
      ),
    );
    if (saved == true && context.mounted) Navigator.of(context).pop(true);
  }

  Future<void> _confirmReplace(BuildContext context) async {
    // V5 M07x: a member is replaced, never removed, so a filled seat stays filled.
    final go = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      builder: (sheet) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(20, 0, 20, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                sheet.l10n.excoReplaceTitle(member.fullName),
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              Text(
                sheet.l10n.excoReplaceBody,
                style: const TextStyle(color: AppColors.inkBody, height: 1.4),
              ),
              const SizedBox(height: 6),
              Text(
                sheet.l10n.excoReplaceHistory(member.fullName),
                style: RecordStyle.caption,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(sheet, true),
                child: Text(sheet.l10n.excoEnterNew),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => Navigator.pop(sheet, false),
                child: Text(sheet.l10n.excoCancel),
              ),
            ],
          ),
        ),
      ),
    );
    if (go == true && context.mounted) {
      await _openForm(context, replace: true);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final canEdit = record.permissions.canEdit;
    final born = member.dateOfBirth;
    final dm =
        record.permissions.viewOnlyReason == ViewOnlyReason.districtManager;
    return Scaffold(
      appBar: AppBar(
        title: Text(l.excoMemberTitle),
        actions: [
          if (canEdit)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: OutlinedButton.icon(
                onPressed: () => _openForm(context, replace: false),
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: Text(l.recEdit),
              ),
            ),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          if (dm)
            RecordNote(
              icon: Icons.lock_outline,
              title: l.recViewOnlyTitle,
              message: l.excoDmNote(l.excoAccessNote(record)),
            )
          else
            RecordNote(
              icon: Icons.shield_outlined,
              tone: NoteTone.success,
              message: l.excoPersonal(record.nameEn, l.excoAccessNote(record)),
            ),
          const SizedBox(height: 12),
          RecordCard(
            children: [
              Row(
                children: [
                  CircleAvatar(
                    radius: 22,
                    backgroundColor: AppColors.mint,
                    child: Text(
                      initialsOf(member.fullName),
                      style: const TextStyle(
                        fontWeight: FontWeight.w700,
                        color: AppColors.forest,
                      ),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(member.fullName, style: RecordStyle.cardTitle),
                        Text(
                          l.excoMemberOf(member.seatNumber),
                          style: RecordStyle.caption,
                        ),
                      ],
                    ),
                  ),
                  if (member.isOfficeBearer)
                    RecordChip(l.office(member.position), tone: ChipTone.info),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          RecordCard(
            title: l.excoNicTitle,
            children: [
              NicRevealButton(
                societyId: record.id,
                memberId: member.id,
                masked: member.nicMasked,
              ),
              const SizedBox(height: 6),
              Text(l.excoNicHidden, style: RecordStyle.caption),
            ],
          ),
          const SizedBox(height: 12),
          RecordCard(
            children: [
              KeyValueGrid([
                KeyValue(
                  l.excoDob,
                  born == null ? l.recNotRecorded : _birthDate(l, born),
                  missing: born == null,
                ),
                KeyValue(
                  l.excoAge,
                  born != null
                      ? l.excoAgeCalculated(ageFrom(born, DateTime.now()))
                      : member.age?.toString() ?? l.recNotRecorded,
                  missing: born == null && member.age == null,
                ),
                KeyValue(
                  l.recAddress,
                  member.addressLine ?? l.recNotRecorded,
                  missing: member.addressLine == null,
                ),
                KeyValue(
                  l.excoProfession,
                  member.profession ?? l.recNotRecorded,
                  missing: member.profession == null,
                ),
                KeyValue(
                  l.excoPhone,
                  member.phone ?? l.recNotRecorded,
                  missing: member.phone == null,
                ),
              ]),
            ],
          ),
          const SizedBox(height: 12),
          if (canEdit)
            OutlinedButton.icon(
              onPressed: () => _confirmReplace(context),
              icon: const Icon(Icons.sync, size: 18),
              label: Text(l.excoReplaceMember),
            )
          else if (dm)
            Text(
              l.excoDmNicOnly(record.districtName),
              style: RecordStyle.caption,
            ),
        ],
      ),
    );
  }
}

/// V5 M07e: add a member to an empty seat, replace a member (a new person in
/// the seat) or correct their details. Each member is saved on its own, so the
/// Society Officer can enter the Exco a few members at a time.
class ExcoMemberFormScreen extends StatefulWidget {
  const ExcoMemberFormScreen({
    super.key,
    required this.record,
    required this.member,
    required this.replace,
  });

  final SocietyRecord record;
  final ExcoMember member;

  /// true: a new person takes the seat (NIC required). false: edit details.
  /// An empty seat ([ExcoMember.isEmptySeat]) is always a new person.
  final bool replace;

  @override
  State<ExcoMemberFormScreen> createState() => _ExcoMemberFormScreenState();
}

class _ExcoMemberFormScreenState extends State<ExcoMemberFormScreen> {
  final _form = GlobalKey<FormState>();
  bool get _adding => widget.member.isEmptySeat;
  late final _nic = TextEditingController();
  late final _name = TextEditingController(
    text: widget.replace ? '' : widget.member.fullName,
  );
  late final _address = TextEditingController(
    text: widget.replace ? '' : widget.member.addressLine ?? '',
  );
  late final _profession = TextEditingController(
    text: widget.replace ? '' : widget.member.profession ?? '',
  );
  late final _phone = TextEditingController(
    text: widget.replace ? '' : widget.member.phone ?? '',
  );
  late DateTime? _born = widget.replace ? null : widget.member.dateOfBirth;
  late String _office = widget.member.position;
  bool _saving = false;
  String? _error;

  @override
  void dispose() {
    for (final controller in [_nic, _name, _address, _profession, _phone]) {
      controller.dispose();
    }
    super.dispose();
  }

  String? _validateNic(String? value) {
    final l = context.l10n;
    final text = value?.trim() ?? '';
    // Replacing needs the new person's NIC; editing keeps the stored one.
    if (text.isEmpty) {
      return widget.replace || widget.member.nicMasked == null
          ? l.excoNicRequired
          : null;
    }
    return RegExp(r'^(?:[0-9]{9}[vVxX]|[0-9]{12})$').hasMatch(text)
        ? null
        : l.excoNicFormat;
  }

  Future<void> _pickBirthDate() async {
    final now = DateTime.now();
    final picked = await showDatePicker(
      context: context,
      initialDate: _born ?? DateTime(now.year - 40),
      firstDate: DateTime(1900),
      lastDate: now,
    );
    if (picked != null) setState(() => _born = picked);
  }

  Future<void> _save() async {
    setState(() => _error = null);
    if (!_form.currentState!.validate()) return;
    if (_born == null) {
      setState(() => _error = context.l10n.excoDobRequired);
      return;
    }
    setState(() => _saving = true);
    final api = DemoScope.read(context).societyRecords;
    final member = widget.member;
    final updated = ExcoMember(
      id: member.id,
      seatNumber: member.seatNumber,
      fullName: _name.text.trim(),
      position: _office,
      seatType: member.seatType,
      dateOfBirth: DateTime.utc(_born!.year, _born!.month, _born!.day),
      profession: _profession.text.trim(),
      addressLine: _address.text.trim(),
      phone: _phone.text.trim(),
      email: widget.replace ? null : member.email,
      appointedOn: widget.replace ? null : member.appointedOn,
      nicMasked: member.nicMasked,
    );
    try {
      final saved = await api.updateCouncil(
        widget.record.id,
        councilWith(widget.record.exco, replacement: updated),
      );
      final nic = _nic.text.trim();
      if (nic.isNotEmpty) {
        final seat = saved.exco.firstWhere(
          (row) => row.seatNumber == member.seatNumber,
        );
        await api.setNic(widget.record.id, seat.id, nic.toUpperCase());
      }
      if (mounted) Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = context.l10n.recordError(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  Widget _field(
    String label,
    TextEditingController controller, {
    String? Function(String?)? validator,
    String? helper,
    TextInputType? keyboard,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label, required: true),
        TextFormField(
          controller: controller,
          keyboardType: keyboard,
          decoration: InputDecoration(helperText: helper, helperMaxLines: 2),
          validator: validator,
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final member = widget.member;
    final born = _born;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: l.commonClose,
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(false),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              _adding
                  ? l.excoAddTitle
                  : widget.replace
                  ? l.excoReplaceFormTitle
                  : l.excoEditTitle,
            ),
            Text(
              _adding
                  ? l.excoSeatOfGroup(
                      member.seatNumber,
                      l.seatGroup(member.seatType),
                    )
                  : widget.replace
                  ? l.excoMemberReplacing(member.seatNumber, member.fullName)
                  : l.excoMemberOfShort(member.seatNumber),
              style: RecordStyle.caption,
            ),
          ],
        ),
      ),
      body: Form(
        key: _form,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            RecordNote(
              icon: Icons.shield_outlined,
              tone: NoteTone.success,
              message: l.excoPersonal(
                widget.record.nameEn,
                l.excoAccessNote(widget.record),
              ),
            ),
            const SizedBox(height: 14),
            _field(
              l.excoNicField,
              _nic,
              validator: _validateNic,
              keyboard: TextInputType.text,
              helper: widget.replace || member.nicMasked == null
                  ? l.excoNicHintNew
                  : l.excoNicHintKeep(member.nicMasked!),
            ),
            _field(
              l.excoFullName,
              _name,
              validator: (value) => Validators.personName(value, l),
            ),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      FieldLabel(l.excoDob, required: true),
                      OutlinedButton.icon(
                        style: OutlinedButton.styleFrom(
                          alignment: Alignment.centerLeft,
                          backgroundColor: AppColors.surface,
                        ),
                        onPressed: _pickBirthDate,
                        icon: const Icon(
                          Icons.calendar_today_outlined,
                          size: 18,
                        ),
                        label: Text(
                          born == null ? l.excoChooseDate : _birthDate(l, born),
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  flex: 2,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      FieldLabel(l.excoAge),
                      ReadOnlyField(
                        born == null ? '—' : '${ageFrom(born, DateTime.now())}',
                      ),
                    ],
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.only(top: 4, bottom: 14),
              child: Text(l.excoAgeWorkedOut, style: RecordStyle.caption),
            ),
            _field(
              l.recAddress,
              _address,
              validator: (value) => Validators.addressLine(value, l),
            ),
            _field(
              l.excoProfession,
              _profession,
              validator: (value) => Validators.required(
                value,
                'profession',
                l.valProfessionRequired,
              ),
            ),
            _field(
              l.excoPhoneNumber,
              _phone,
              validator: (value) => Validators.sriLankanPhone(value, l),
              keyboard: TextInputType.phone,
            ),
            FieldLabel(l.excoRole, required: true),
            DropdownButtonFormField<String>(
              initialValue: officeBearers.contains(_office)
                  ? _office
                  : 'Member',
              items: [
                for (final office in [...officeBearers, 'Member'])
                  DropdownMenuItem(
                    value: office,
                    child: Text(l.office(office)),
                  ),
              ],
              onChanged: (value) => setState(() => _office = value!),
            ),
            if (officeBearers.contains(_office) &&
                _office != member.position &&
                widget.record.exco.any((other) => other.position == _office))
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  l.excoStaysMember(l.office(_office)),
                  style: RecordStyle.caption,
                ),
              ),
            if (_error != null) ...[
              const SizedBox(height: 14),
              RecordNote(
                icon: Icons.error_outline,
                tone: NoteTone.error,
                message: _error!,
              ),
            ],
          ],
        ),
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving
                      ? null
                      : () => Navigator.of(context).pop(false),
                  child: Text(l.excoCancel),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? l.recSaving : l.excoSaveMember),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

/// V5 M07o: choose who holds an office from the society's 25 members.
class ChooseOfficeBearerScreen extends StatefulWidget {
  const ChooseOfficeBearerScreen({
    super.key,
    required this.record,
    required this.office,
  });

  final SocietyRecord record;
  final String office;

  @override
  State<ChooseOfficeBearerScreen> createState() =>
      _ChooseOfficeBearerScreenState();
}

class _ChooseOfficeBearerScreenState extends State<ChooseOfficeBearerScreen> {
  String _query = '';
  late int? _seat = widget.record.exco
      .where((member) => member.position == widget.office)
      .firstOrNull
      ?.seatNumber;
  bool _saving = false;
  String? _error;

  Future<void> _save() async {
    setState(() {
      _saving = true;
      _error = null;
    });
    try {
      await DemoScope.read(context).societyRecords.updateCouncil(
        widget.record.id,
        councilWith(
          widget.record.exco,
          office: (seat: _seat!, office: widget.office),
        ),
      );
      if (mounted) Navigator.of(context).pop(true);
    } on SocietyRecordException catch (error) {
      if (mounted) setState(() => _error = context.l10n.recordError(error));
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final office = l.office(widget.office);
    final current = widget.record.exco
        .where((member) => member.position == widget.office)
        .firstOrNull;
    final query = _query.toLowerCase();
    final members = [...widget.record.exco]
      ..sort((a, b) => a.seatNumber.compareTo(b.seatNumber));
    final shown = members.where(
      (member) =>
          query.isEmpty ||
          member.fullName.toLowerCase().contains(query) ||
          (member.profession ?? '').toLowerCase().contains(query),
    );
    final chosen = members
        .where((member) => member.seatNumber == _seat)
        .firstOrNull;
    return Scaffold(
      appBar: AppBar(title: Text(l.excoChooseOfficeTitle(office))),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          Text(
            l.excoChooseOfficeIntro,
            style: const TextStyle(color: AppColors.inkBody),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: InputDecoration(
              hintText: l.excoSearch25,
              prefixIcon: const Icon(Icons.search),
            ),
            onChanged: (value) => setState(() => _query = value),
          ),
          const SizedBox(height: 8),
          RadioGroup<int>(
            groupValue: _seat,
            onChanged: (value) => setState(() => _seat = value),
            child: Column(
              children: [
                for (final member in shown)
                  RadioListTile<int>(
                    value: member.seatNumber,
                    title: Text(member.fullName),
                    subtitle: Text(
                      [
                        l.excoMemberNumber(member.seatNumber),
                        if (member.profession != null) member.profession!,
                        if (member.isOfficeBearer) l.office(member.position),
                      ].join(' · '),
                    ),
                  ),
              ],
            ),
          ),
          if (current != null &&
              chosen != null &&
              current.seatNumber != chosen.seatNumber)
            Padding(
              padding: const EdgeInsets.only(top: 8),
              child: Text(
                l.excoNameStaysMember(current.fullName),
                style: RecordStyle.caption,
              ),
            ),
          if (_error != null) ...[
            const SizedBox(height: 12),
            RecordNote(
              icon: Icons.error_outline,
              tone: NoteTone.error,
              message: _error!,
            ),
          ],
        ],
      ),
      bottomNavigationBar: SafeArea(
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 8),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton(
                  onPressed: _saving
                      ? null
                      : () => Navigator.of(context).pop(false),
                  child: Text(l.excoCancel),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed:
                      _saving || _seat == null || _seat == current?.seatNumber
                      ? null
                      : _save,
                  child: Text(_saving ? l.recSaving : l.excoMake(office)),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
