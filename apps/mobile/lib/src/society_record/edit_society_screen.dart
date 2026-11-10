import 'package:flutter/material.dart';

import '../l10n/l10n.dart';
import '../l10n/record_l10n.dart';
import '../models/society.dart';
import '../screens/manual_pin_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/street_map.dart';
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

  /// Its name in the M06u warning, in the chosen language.
  final String Function(AppLocalizations l) label;
  final String original;
  final TextEditingController controller;

  String get value => controller.text.trim();
  bool get changed => value != original;
}

final _landlinePattern = RegExp(r'^(0\d{9}|\+94\d{9})$');

class _EditSocietyScreenState extends State<EditSocietyScreen> {
  late final _name = _Field((l) => l.editFieldName, widget.record.nameEn);
  late final _members = _Field(
    (l) => l.editFieldMembers,
    widget.record.memberCount?.toString(),
  );
  late final _address = _Field(
    (l) => l.editFieldAddress,
    widget.record.addressLine,
  );
  late final _landline = _Field(
    (l) => l.editFieldLandline,
    widget.record.landline,
  );
  late final _business = _Field(
    (l) => l.editFieldBusiness,
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

  AppLocalizations get _l => context.l10n;

  /// Labels of the changed fields, for the M06u warning.
  List<String> get _changed => [
    for (final field in _fields)
      if (field.changed) field.label(_l),
    if (_locationChanged) _l.editFieldLocation,
  ];

  String? get _nameError => _name.value.length < 2 ? _l.editNameError : null;

  String? get _membersError {
    if (_members.value.isEmpty) return _l.editMembersRequired;
    return RegExp(r'^\d{1,7}$').hasMatch(_members.value)
        ? null
        : _l.editMembersFormat;
  }

  String? get _addressError =>
      _address.value.isEmpty ? _l.valAddressRequired : null;

  String? get _landlineError {
    final digits = _landline.value.replaceAll(RegExp(r'[\s-]'), '');
    if (digits.isEmpty || _landlinePattern.hasMatch(digits)) return null;
    return _l.editLandlineFormat;
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
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(_l.editSaved)));
      Navigator.of(context).pop(true);
      return true;
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          _serverError = _l.recStillHere(_l.recordError(error));
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
    // English keeps "a, b and c"; other languages list the fields with commas.
    final list = changed.length == 1
        ? changed.single
        : _l.localeName == 'en'
        ? '${changed.sublist(0, changed.length - 1).join(', ')} and ${changed.last}'
        : changed.join(', ');
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
              Text(
                context.l10n.editLeaveTitle,
                textAlign: TextAlign.center,
                style: const TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w800,
                  color: AppColors.ink,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                context.l10n.editLeaveBody(changed.length, list),
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
                child: Text(context.l10n.editKeepEditing),
              ),
              const SizedBox(height: 8),
              OutlinedButton(
                style: compactOutlinedStyle,
                onPressed: () => Navigator.pop(context, 'save'),
                child: Text(context.l10n.editSaveLeave),
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
                child: Text(context.l10n.editDiscard),
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
                ? _l.editWas(field.original)
                : hint,
            error: _submitted || field.changed ? error : null,
          ),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
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
          title: l.editTitle,
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
                      l.editYouCanEdit(record.nameEn),
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
                    l.recSocietyName,
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
                            FieldLabel(l.recSNumber),
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
                            FieldLabel(l.recGrade),
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
                        child: Text(l.editRequestLink),
                      ),
                    ),
                  const SizedBox(height: 12),
                  _text(
                    _members,
                    l.editMembers,
                    required: true,
                    error: _membersError,
                    keyboard: TextInputType.number,
                  ),
                  _text(
                    _address,
                    l.recAddress,
                    required: true,
                    error: _addressError,
                  ),
                  _text(
                    _landline,
                    l.editLandline,
                    error: _landlineError,
                    keyboard: TextInputType.phone,
                    hint: l.editLandlineHint,
                  ),
                  _text(
                    _business,
                    l.editBusiness,
                    maxLines: 4,
                    hint: l.editBusinessHint,
                  ),
                  FieldLabel(l.editMapLocation),
                  Stack(
                    children: [
                      SocietyStreetMap(
                        height: 110,
                        location: _location,
                        onPick: (location) =>
                            setState(() => _location = location),
                        semanticLabel: _location == null
                            ? l.editNoLocation
                            : l.editLocationAt(
                                _location!.latitude.toStringAsFixed(4),
                                _location!.longitude.toStringAsFixed(4),
                              ),
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
                          label: Text(l.editMovePin),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _location == null
                        ? l.editNoLocationYet
                        : (_locationChanged
                              ? l.editCoordinatesChanged
                              : l.editCoordinates)(
                            _location!.latitude.toStringAsFixed(4),
                            _location!.longitude.toStringAsFixed(4),
                          ),
                    style: RecordStyle.caption,
                  ),
                  if (_serverError != null) ...[
                    const SizedBox(height: 12),
                    NoticeBanner(
                      icon: Icons.error_outline,
                      tone: NoticeTone.error,
                      title: l.editNotSaved,
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
            child: Text(l.editCancel),
          ),
          primary: FilledButton(
            onPressed: dirty && !_saving && _valid ? _save : null,
            child: Text(_saving ? l.recSaving : l.editSave),
          ),
        ),
      ),
    );
  }
}
