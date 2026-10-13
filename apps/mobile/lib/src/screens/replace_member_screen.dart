import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../format.dart';
import '../models/committee.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';

/// Replace a Council member (SC-25 step 5). Saving creates a Draft; the approved
/// Council is not changed until the District Centre approves it.
class ReplaceMemberScreen extends StatefulWidget {
  const ReplaceMemberScreen({super.key, required this.memberId});

  final String memberId;

  @override
  State<ReplaceMemberScreen> createState() => _ReplaceMemberScreenState();
}

class _ReplaceMemberScreenState extends State<ReplaceMemberScreen> {
  final _formKey = GlobalKey<FormState>();
  final _scroll = ScrollController();
  final _name = TextEditingController();
  final _phone = TextEditingController();
  final _age = TextEditingController();
  final _startDateText = TextEditingController();
  CouncilSeatType? _seatType;
  DateTime? _startDate;
  int _errorCount = 0;
  bool _attempted = false;
  bool _initialised = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialised) return;
    _initialised = true;
    final store = DemoScope.read(context);
    final outgoing = store.memberById(widget.memberId);
    final draft = store.draft;
    _seatType = outgoing?.seatType;
    // Reopening the form restores the saved draft so nothing has to be typed again.
    if (draft != null && draft.memberId == widget.memberId) {
      _name.text = draft.fullName;
      _phone.text = draft.phone;
      _seatType = draft.seatType;
      _age.text = draft.age?.toString() ?? '';
      _setStartDate(draft.startDate);
    }
  }

  @override
  void dispose() {
    for (final controller in [_name, _phone, _age, _startDateText]) {
      controller.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  void _setStartDate(DateTime? date) {
    _startDate = date;
    _startDateText.text = date == null ? '' : formatDate(date);
  }

  Future<void> _pickDate() async {
    final store = DemoScope.read(context);
    final today = store.now;
    final picked = await showDatePicker(
      context: context,
      initialDate: _startDate ?? today,
      firstDate: DateTime(2000),
      lastDate: today,
      helpText: 'Start date in the Council',
    );
    if (picked != null) setState(() => _setStartDate(picked));
  }

  void _save() {
    final store = DemoScope.read(context);
    final valid = _formKey.currentState!.validate();
    final errors = [
      Validators.personName(_name.text),
      Validators.sriLankanPhone(_phone.text),
      Validators.seatType(_seatType),
      Validators.ageForSeat(_age.text, _seatType),
      Validators.startDate(_startDate, today: store.now),
    ].whereType<String>().length;
    setState(() {
      _attempted = true;
      _errorCount = errors;
    });
    if (!valid) {
      // Entered values stay in the fields; only the summary and inline messages appear.
      _scroll.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
      return;
    }
    final age = _age.text.trim().isEmpty ? null : int.parse(_age.text.trim());
    store.saveDraft(
      CouncilReplacementDraft(
        memberId: widget.memberId,
        fullName: _name.text.trim().replaceAll(RegExp(r'\s+'), ' '),
        phone: _phone.text.trim(),
        seatType: _seatType!,
        age: age,
        startDate: _startDate!,
      ),
    );
    Navigator.of(context).pop();
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text('Saved as a draft. It is not sent until you submit it.'),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    final outgoing = store.memberById(widget.memberId);
    if (outgoing == null) {
      return Scaffold(
        appBar: AppBar(),
        body: StateMessage(
          icon: Icons.person_off_outlined,
          tone: StateTone.error,
          title: 'This seat could not be found',
          message:
              'The Council may have changed. Go back and open the seat again.',
          primaryLabel: 'Back to Council',
          onPrimary: () => Navigator.of(context).pop(),
        ),
      );
    }
    final range = _seatType?.ageRange;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Replace ${outgoing.isOfficeBearer ? outgoing.position : 'member'}',
        ),
      ),
      body: Form(
        key: _formKey,
        child: ListView(
          controller: _scroll,
          padding: const EdgeInsets.all(16),
          children: [
            // Always present, so showing the summary never shifts the form fields
            // (a shift would rebuild them and drop their inline error messages).
            _ErrorSummary(
              count: _attempted ? _errorCount : 0,
              label: 'before saving',
            ),
            SectionCard(
              title: 'Replacing',
              children: [
                InfoRow(label: outgoing.position, value: outgoing.fullName),
                InfoRow(
                  label: 'Seat',
                  value:
                      '${outgoing.seatType.label} seat'
                      '${outgoing.appointedOn == null ? '' : ' · since ${formatDate(outgoing.appointedOn!)}'}',
                ),
                const Text(
                  'The outgoing member is kept in the Council history.',
                  style: TextStyle(color: AppColors.muted, fontSize: 13),
                ),
              ],
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: 'New member',
              children: [
                TextFormField(
                  controller: _name,
                  decoration: const InputDecoration(
                    labelText: 'Full name *',
                    hintText: 'For example S. Tharmalingam',
                  ),
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  validator: Validators.personName,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _phone,
                  decoration: const InputDecoration(
                    labelText: 'Phone *',
                    hintText: '+94 00 000 0003',
                    helperText: 'Sri Lankan number starting with +94 or 0',
                  ),
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s\-]')),
                  ],
                  validator: Validators.sriLankanPhone,
                ),
                const SizedBox(height: 14),
                DropdownButtonFormField<CouncilSeatType>(
                  isExpanded: true,
                  initialValue: _seatType,
                  decoration: const InputDecoration(labelText: 'Seat type *'),
                  items: [
                    for (final type in CouncilSeatType.values)
                      DropdownMenuItem(
                        value: type,
                        child: Text(
                          type.ageRange == null
                              ? type.label
                              : '${type.label} (${type.ageRange!.min}–${type.ageRange!.max})',
                        ),
                      ),
                  ],
                  onChanged: (value) => setState(() => _seatType = value),
                  validator: Validators.seatType,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _age,
                  decoration: InputDecoration(
                    labelText: range == null ? 'Age' : 'Age *',
                    helperText: range == null
                        ? 'Optional for this seat'
                        : 'Required: ${range.min}–${range.max} years',
                  ),
                  keyboardType: TextInputType.number,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [
                    FilteringTextInputFormatter.digitsOnly,
                    LengthLimitingTextInputFormatter(3),
                  ],
                  validator: (value) => Validators.ageForSeat(value, _seatType),
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _startDateText,
                  readOnly: true,
                  onTap: _pickDate,
                  decoration: InputDecoration(
                    labelText: 'Start date *',
                    hintText: 'Choose a date',
                    helperText: 'The date agreed at the AGM',
                    suffixIcon: IconButton(
                      tooltip: 'Choose start date',
                      icon: const Icon(Icons.calendar_today_outlined),
                      onPressed: _pickDate,
                    ),
                  ),
                  validator: (_) =>
                      Validators.startDate(_startDate, today: store.now),
                ),
              ],
            ),
          ],
        ),
      ),
      bottomNavigationBar: BottomActionBar(
        secondary: OutlinedButton(
          onPressed: () => Navigator.of(context).pop(),
          child: const Text('Cancel'),
        ),
        primary: FilledButton(
          onPressed: _save,
          child: const Text('Save as draft'),
        ),
      ),
    );
  }
}

/// Validation summary shown above a form after a failed save.
class _ErrorSummary extends StatelessWidget {
  const _ErrorSummary({required this.count, required this.label});

  final int count;
  final String label;

  @override
  Widget build(BuildContext context) {
    if (count == 0) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: NoticeBanner(
        icon: Icons.error_outline,
        tone: NoticeTone.error,
        title: count == 1 ? 'Fix 1 field $label' : 'Fix $count fields $label',
        message: 'Your other answers have been kept.',
      ),
    );
  }
}
