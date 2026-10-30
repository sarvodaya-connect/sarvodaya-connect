import 'package:flutter/material.dart';

import '../models/society.dart';
import '../screens/manual_pin_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/map_preview.dart';
import '../widgets/state_views.dart';
import 'grade_change_request_screen.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// M06e edit society information, with the M06u unsaved-changes warning.
/// Changes save directly (no District approval). The S number and grade are
/// read only here: only HQ changes them.
class EditSocietyScreen extends StatefulWidget {
  const EditSocietyScreen({super.key, required this.record});

  final SocietyRecord record;

  @override
  State<EditSocietyScreen> createState() => _EditSocietyScreenState();
}

/// A field on the form, its original value and its label in the M06u warning.
class _Field {
  _Field(this.label, String? original)
    : original = original ?? '',
      controller = TextEditingController(text: original ?? '');

  final String label;
  final String original;
  final TextEditingController controller;

  String get value => controller.text.trim();
  bool get changed => value != original;
}

final _landlinePattern = RegExp(r'^(0\d{9}|\+94\d{9})$');

class _EditSocietyScreenState extends State<EditSocietyScreen> {
  late final _name = _Field('society name', widget.record.nameEn);
  late final _members = _Field(
    'number of members',
    widget.record.memberCount?.toString(),
  );
  late final _address = _Field('address', widget.record.addressLine);
  late final _landline = _Field('landline', widget.record.landline);
  late final _business = _Field(
    'business run by the society',
    widget.record.businessDescription,
  );
  late final _fields = [_name, _members, _address, _landline, _business];
  late GeoLocation? _location =
      widget.record.latitude == null || widget.record.longitude == null
      ? null
      : GeoLocation(
          latitude: widget.record.latitude!,
          longitude: widget.record.longitude!,
        );
  bool _submitted = false;
  bool _saving = false;
  String? _serverError;

  @override
  void initState() {
    super.initState();
    for (final field in _fields) {
      field.controller.addListener(() => setState(() {}));
    }
  }

  @override
  void dispose() {
    for (final field in _fields) {
      field.controller.dispose();
    }
    super.dispose();
  }

  bool get _locationChanged =>
      _location != null &&
      (_location!.latitude != widget.record.latitude ||
          _location!.longitude != widget.record.longitude);

  /// Labels of the changed fields, for the M06u warning.
  List<String> get _changed => [
    for (final field in _fields)
      if (field.changed) field.label,
    if (_locationChanged) 'map location',
  ];

  String? get _nameError =>
      _name.value.length < 2 ? 'Enter the society name.' : null;

  String? get _membersError {
    if (_members.value.isEmpty) return 'Enter the number of members.';
    return RegExp(r'^\d{1,7}$').hasMatch(_members.value)
        ? null
        : 'Use numbers only, for example 418.';
  }

  String? get _addressError =>
      _address.value.isEmpty ? 'Enter the address.' : null;

  String? get _landlineError {
    final digits = _landline.value.replaceAll(RegExp(r'[\s-]'), '');
    if (digits.isEmpty || _landlinePattern.hasMatch(digits)) return null;
    return 'Enter a 10-digit number, for example 037 000 0000, or leave it empty.';
  }

  bool get _valid => [
    _nameError,
    _membersError,
    _addressError,
    _landlineError,
  ].every((error) => error == null);

  Future<bool> _save() async {
    setState(() {
      _submitted = true;
      _serverError = null;
    });
    if (!_valid || _changed.isEmpty) return false;
    setState(() => _saving = true);
    final changes = <String, Object>{
      if (_name.changed) 'nameEn': _name.value,
      if (_members.changed) 'memberCount': int.parse(_members.value),
      if (_address.changed) 'addressLine': _address.value,
      if (_landline.changed) 'landline': _landline.value,
      if (_business.changed) 'businessDescription': _business.value,
      if (_locationChanged) ...{
        'latitude': _location!.latitude,
        'longitude': _location!.longitude,
      },
    };
    try {
      await DemoScope.read(context).societyRecords
          .updateRecord(widget.record.id, changes);
      if (!mounted) return true;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Saved. The change is in the society history.'),
        ),
      );
      Navigator.of(context).pop(true);
      return true;
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _serverError = '${error.message} Your changes are still here.';
        });
      }
      return false;
    }
  }

  Future<void> _movePin() async {
    final location = await Navigator.of(context).push<GeoLocation>(
      MaterialPageRoute(builder: (_) => ManualPinScreen(initial: _location)),
    );
    if (location != null && mounted) setState(() => _location = location);
  }

  /// M06u: names the fields that would be lost.
  Future<void> _confirmLeave() async {
    final changed = _changed;
    final list = changed.length == 1
        ? changed.single
        : '${changed.sublist(0, changed.length - 1).join(', ')} and ${changed.last}';
    final choice = await showDialog<String>(
      context: context,
      builder: (context) => Dialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        insetPadding: const EdgeInsets.symmetric(horizontal: 32),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(18, 20, 18, 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 40,
                  decoration: const BoxDecoration(
                    color: Color(0xFFFFF1C7),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(
                    Icons.warning_amber_rounded,
                    size: 20,
                    color: AppColors.warning,
                  ),
                ),
              ),
              const SizedBox(height: 12),
              const Text(
                'Leave without saving?',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'You changed ${changed.length} ${changed.length == 1 ? 'field' : 'fields'}: $list. '
                'If you leave now, these changes are lost.',
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 12,
                  height: 1.4,
                  color: AppColors.inkSoft,
                ),
              ),
              const SizedBox(height: 16),
              FilledButton(
                style: compactFilledStyle,
                onPressed: () => Navigator.pop(context, 'keep'),
                child: const Text('Keep editing'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                style: compactOutlinedStyle,
                onPressed: () => Navigator.pop(context, 'save'),
                child: const Text('Save and leave'),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                style: compactOutlinedStyle.copyWith(
                  foregroundColor: const WidgetStatePropertyAll(
                    AppColors.danger,
                  ),
                  side: const WidgetStatePropertyAll(
                    BorderSide(color: Color(0xFFE6B4AE)),
                  ),
                ),
                onPressed: () => Navigator.pop(context, 'discard'),
                child: const Text('Discard changes'),
              ),
            ],
          ),
        ),
      ),
    );
    if (!mounted) return;
    if (choice == 'discard') Navigator.of(context).pop(false);
    if (choice == 'save') await _save();
  }

  Widget _text(
    _Field field,
    String label, {
    bool required = false,
    String? error,
    TextInputType? keyboard,
    int maxLines = 1,
    String? hint,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label, required: required),
        TextField(
          controller: field.controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          minLines: 1,
          style: recordInputStyle,
          decoration: changedDecoration(
            changed: field.changed,
            helper: field.changed && field.original.isNotEmpty
                ? 'Was ${field.original}'
                : hint,
            error: _submitted || field.changed ? error : null,
          ),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final record = widget.record;
    final dirty = _changed.isNotEmpty;
    return PopScope(
      canPop: !dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: recordFormAppBar(
          context,
          title: 'Edit society information',
          actions: [if (dirty) const UnsavedChip()],
        ),
        body: Column(
          children: [
            Container(
              width: double.infinity,
              color: const Color(0xFFE4EFE5),
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 7),
              child: Row(
                children: [
                  const Icon(
                    Icons.shield_outlined,
                    size: 13,
                    color: AppColors.pine,
                  ),
                  const SizedBox(width: 6),
                  Expanded(
                    child: Text(
                      '${record.nameEn} · you can edit this society',
                      style: const TextStyle(
                        color: AppColors.pine,
                        fontSize: 11,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ],
              ),
            ),
            Expanded(
              child: ListView(
                padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
                children: [
                  _text(
                    _name,
                    'Society name',
                    required: true,
                    error: _nameError,
                  ),
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        flex: 3,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const FieldLabel('S number'),
                            ReadOnlyField(record.societyCode),
                          ],
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        flex: 2,
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.stretch,
                          children: [
                            const FieldLabel('Grade'),
                            ReadOnlyField(record.grade ?? '–'),
                          ],
                        ),
                      ),
                    ],
                  ),
                  if (record.permissions.canRequestGradeChange &&
                      record.openGradeRequest == null)
                    Align(
                      alignment: Alignment.centerLeft,
                      child: TextButton(
                        style: compactTextStyle,
                        onPressed: () => Navigator.of(context).push(
                          MaterialPageRoute<bool>(
                            builder: (_) =>
                                GradeChangeRequestScreen(record: record),
                          ),
                        ),
                        child: const Text('Request a grade change →'),
                      ),
                    ),
                  const SizedBox(height: 12),
                  _text(
                    _members,
                    'Number of members',
                    required: true,
                    error: _membersError,
                    keyboard: TextInputType.number,
                  ),
                  _text(
                    _address,
                    'Address',
                    required: true,
                    error: _addressError,
                  ),
                  _text(
                    _landline,
                    'Landline (if the society has one)',
                    error: _landlineError,
                    keyboard: TextInputType.phone,
                    hint: 'For example 037 000 0000. Leave empty if none.',
                  ),
                  _text(
                    _business,
                    'Business run by the society',
                    maxLines: 4,
                    hint: 'Information only — no sales, stock or accounts.',
                  ),
                  const FieldLabel('Map location'),
                  Stack(
                    children: [
                      MapPreview(
                        height: 110,
                        location: _location,
                        semanticLabel: _location == null
                            ? 'No map location set'
                            : 'Map location ${_location!.latitude.toStringAsFixed(4)}, ${_location!.longitude.toStringAsFixed(4)}',
                      ),
                      Positioned(
                        right: 8,
                        bottom: 8,
                        child: OutlinedButton.icon(
                          style: compactOutlinedStyle.copyWith(
                            backgroundColor: const WidgetStatePropertyAll(
                              AppColors.surface,
                            ),
                            minimumSize: const WidgetStatePropertyAll(
                              Size(0, 30),
                            ),
                          ),
                          onPressed: _movePin,
                          icon: const Icon(Icons.place_outlined, size: 14),
                          label: const Text('Move pin'),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _location == null
                        ? 'No location set yet.'
                        : '${_location!.latitude.toStringAsFixed(4)}° N, ${_location!.longitude.toStringAsFixed(4)}° E${_locationChanged ? ' · changed' : ''}',
                    style: RecordStyle.caption,
                  ),
                  if (_serverError != null) ...[
                    const SizedBox(height: 12),
                    NoticeBanner(
                      icon: Icons.error_outline,
                      tone: NoticeTone.error,
                      title: 'Not saved',
                      message: _serverError,
                    ),
                  ],
                ],
              ),
            ),
          ],
        ),
        bottomNavigationBar: BottomActionBar(
          secondary: OutlinedButton(
            onPressed: () => Navigator.of(context).maybePop(),
            child: const Text('Cancel'),
          ),
          primary: FilledButton(
            onPressed: dirty && !_saving && _valid ? _save : null,
            child: Text(_saving ? 'Saving…' : 'Save changes'),
          ),
        ),
      ),
    );
  }
}
