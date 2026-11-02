import 'package:flutter/material.dart';

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

/// The 25 seats with one seat replaced or one office moved. An office is held
/// by one member, so its previous holder becomes a member (V5 M07o).
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
    // V5 M07x: a member is replaced, never removed, so the Exco keeps 25.
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
                'Replace ${member.fullName}?',
                style: const TextStyle(
                  fontSize: 17,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'The Exco must always have 25 members, so a member can\'t just be removed. Enter the person who takes this place — both changes are saved together.',
                style: TextStyle(color: AppColors.inkBody, height: 1.4),
              ),
              const SizedBox(height: 6),
              Text(
                '${member.fullName}\'s details stay in the change history.',
                style: RecordStyle.caption,
              ),
              const SizedBox(height: 16),
              FilledButton(
                onPressed: () => Navigator.pop(sheet, true),
                child: const Text('Enter the new member'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                onPressed: () => Navigator.pop(sheet, false),
                child: const Text('Cancel'),
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
    final canEdit = record.permissions.canEdit;
    final born = member.dateOfBirth;
    final dm =
        record.permissions.viewOnlyReason == ViewOnlyReason.districtManager;
    return Scaffold(
      appBar: AppBar(
        title: const Text('Exco member'),
        actions: [
          if (canEdit)
            Padding(
              padding: const EdgeInsets.only(right: 12),
              child: OutlinedButton.icon(
                onPressed: () => _openForm(context, replace: false),
                icon: const Icon(Icons.edit_outlined, size: 16),
                label: const Text('Edit'),
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
              title: 'View only',
              message: 'District Manager · ${accessNote(record)}',
            )
          else
            RecordNote(
              icon: Icons.shield_outlined,
              tone: NoteTone.success,
              message:
                  'Personal details · ${record.nameEn} · ${accessNote(record)}',
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
                          'Exco member ${member.seatNumber} of 25',
                          style: RecordStyle.caption,
                        ),
                      ],
                    ),
                  ),
                  if (member.isOfficeBearer)
                    RecordChip(member.position, tone: ChipTone.info),
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          RecordCard(
            title: 'NIC number',
            children: [
              NicRevealButton(
                societyId: record.id,
                memberId: member.id,
                masked: member.nicMasked,
              ),
              const SizedBox(height: 6),
              const Text(
                'Hidden by default. Anyone who can open this society can show it when they need to check it.',
                style: RecordStyle.caption,
              ),
            ],
          ),
          const SizedBox(height: 12),
          RecordCard(
            children: [
              KeyValueGrid([
                KeyValue(
                  'Date of birth',
                  born == null ? 'Not recorded' : formatBirthDate(born),
                  missing: born == null,
                ),
                KeyValue(
                  'Age',
                  born != null
                      ? '${ageFrom(born, DateTime.now())} · calculated'
                      : member.age?.toString() ?? 'Not recorded',
                  missing: born == null && member.age == null,
                ),
                KeyValue(
                  'Address',
                  member.addressLine ?? 'Not recorded',
                  missing: member.addressLine == null,
                ),
                KeyValue(
                  'Profession',
                  member.profession ?? 'Not recorded',
                  missing: member.profession == null,
                ),
                KeyValue(
                  'Phone',
                  member.phone ?? 'Not recorded',
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
              label: const Text('Replace this member'),
            )
          else if (dm)
            Text(
              'You can show NIC numbers for ${record.districtName} societies only. You cannot edit or replace members.',
              style: RecordStyle.caption,
            ),
        ],
      ),
    );
  }
}

/// V5 M07e: replace a member (a new person in the seat) or correct their details.
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
  final bool replace;

  @override
  State<ExcoMemberFormScreen> createState() => _ExcoMemberFormScreenState();
}

class _ExcoMemberFormScreenState extends State<ExcoMemberFormScreen> {
  final _form = GlobalKey<FormState>();
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
    final text = value?.trim() ?? '';
    // Replacing needs the new person's NIC; editing keeps the stored one.
    if (text.isEmpty) {
      return widget.replace || widget.member.nicMasked == null
          ? 'Enter the NIC number.'
          : null;
    }
    return RegExp(r'^(?:[0-9]{9}[vVxX]|[0-9]{12})$').hasMatch(text)
        ? null
        : 'Use 12 digits, or 9 digits and V.';
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
      setState(() => _error = 'Enter the date of birth.');
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
      if (mounted) setState(() => _error = error.message);
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
    final member = widget.member;
    final born = _born;
    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          tooltip: 'Close',
          icon: const Icon(Icons.close),
          onPressed: () => Navigator.of(context).pop(false),
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(widget.replace ? 'Replace Exco member' : 'Edit Exco member'),
            Text(
              widget.replace
                  ? 'Member ${member.seatNumber} of 25 · replacing ${member.fullName}'
                  : 'Member ${member.seatNumber} of 25',
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
              message:
                  'Personal details · ${widget.record.nameEn} · ${accessNote(widget.record)}',
            ),
            const SizedBox(height: 14),
            _field(
              'NIC number',
              _nic,
              validator: _validateNic,
              keyboard: TextInputType.text,
              helper: widget.replace || member.nicMasked == null
                  ? '12 digits, or 9 digits and V. Masked after saving; anyone with access to this society can show it.'
                  : 'Leave empty to keep ${member.nicMasked}. 12 digits, or 9 digits and V.',
            ),
            _field('Full name', _name, validator: Validators.personName),
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(
                  flex: 3,
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      const FieldLabel('Date of birth', required: true),
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
                          born == null
                              ? 'Choose a date'
                              : formatBirthDate(born),
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
                      const FieldLabel('Age'),
                      ReadOnlyField(
                        born == null ? '—' : '${ageFrom(born, DateTime.now())}',
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const Padding(
              padding: EdgeInsets.only(top: 4, bottom: 14),
              child: Text(
                'Age is worked out from the date of birth.',
                style: RecordStyle.caption,
              ),
            ),
            _field('Address', _address, validator: Validators.addressLine),
            _field(
              'Profession',
              _profession,
              validator: (value) => Validators.required(value, 'profession'),
            ),
            _field(
              'Phone number',
              _phone,
              validator: Validators.sriLankanPhone,
              keyboard: TextInputType.phone,
            ),
            const FieldLabel('Role in the Exco', required: true),
            DropdownButtonFormField<String>(
              initialValue: officeBearers.contains(_office)
                  ? _office
                  : 'Member',
              items: [
                for (final office in [...officeBearers, 'Member'])
                  DropdownMenuItem(value: office, child: Text(office)),
              ],
              onChanged: (value) => setState(() => _office = value!),
            ),
            if (officeBearers.contains(_office) && _office != member.position)
              Padding(
                padding: const EdgeInsets.only(top: 6),
                child: Text(
                  'The current $_office will stay an Exco member, without an office.',
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
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed: _saving ? null : _save,
                  child: Text(_saving ? 'Saving…' : 'Save member'),
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
      if (mounted) setState(() => _error = error.message);
    } finally {
      if (mounted) setState(() => _saving = false);
    }
  }

  @override
  Widget build(BuildContext context) {
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
      appBar: AppBar(title: Text('Choose the ${widget.office}')),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(14, 12, 14, 24),
        children: [
          const Text(
            'Office bearers are chosen from the society\'s Exco members. Pick one person for this office.',
            style: TextStyle(color: AppColors.inkBody),
          ),
          const SizedBox(height: 12),
          TextField(
            decoration: const InputDecoration(
              hintText: 'Search the 25 Exco members',
              prefixIcon: Icon(Icons.search),
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
                        'Member ${member.seatNumber}',
                        if (member.profession != null) member.profession!,
                        if (member.isOfficeBearer) member.position,
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
                '${current.fullName} will stay an Exco member, without an office.',
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
                  child: const Text('Cancel'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton(
                  onPressed:
                      _saving || _seat == null || _seat == current?.seatNumber
                      ? null
                      : _save,
                  child: Text(_saving ? 'Saving…' : 'Make ${widget.office}'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
