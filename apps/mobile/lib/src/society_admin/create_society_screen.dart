import 'package:flutter/material.dart';

import '../models/society.dart';
import '../screens/manual_pin_screen.dart';
import '../society_record/record_widgets.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/state_views.dart';
import '../widgets/street_map.dart';
import 'assign_staff_screen.dart';
import 'society_admin_api.dart';
import '../l10n/l10n.dart';
import '../l10n/record_l10n.dart';

String _gradeLabel(AppLocalizations l, String grade) => switch (grade) {
  'A' => l.adminGradeA,
  'B' => l.adminGradeB,
  _ => l.adminGradeC,
};

final _codePattern = RegExp(r'^[A-Za-z0-9][A-Za-z0-9-]{2,19}$');
final _landlinePattern = RegExp(r'^(0\d{9}|\+94\d{9})$');

/// HQ on the phone: create a society record with its basic details (V5 D05n,
/// as on the dashboard). Saving opens Assign staff (D05a). The Exco is not
/// entered here: the Society Officer HQ assigns adds the 25 members, and the
/// record shows the Exco as incomplete until they are all in.
class CreateSocietyScreen extends StatefulWidget {
  const CreateSocietyScreen({super.key});

  @override
  State<CreateSocietyScreen> createState() => _CreateSocietyScreenState();
}

class _CreateSocietyScreenState extends State<CreateSocietyScreen> {
  AppLocalizations get _l => context.l10n;

  final _name = TextEditingController();
  final _code = TextEditingController();
  final _local = TextEditingController();
  final _ds = TextEditingController();
  final _gn = TextEditingController();
  final _address = TextEditingController();
  final _members = TextEditingController();
  final _landline = TextEditingController();
  final _business = TextEditingController();
  late final _controllers = [
    _name,
    _code,
    _local,
    _ds,
    _gn,
    _address,
    _members,
    _landline,
    _business,
  ];
  Future<List<DistrictChoice>>? _districts;
  String? _districtId;
  String _grade = 'C';
  GeoLocation? _location;
  bool _submitted = false;
  bool _saving = false;
  String? _serverError;

  /// The S number the server said is already used, so the error shows on
  /// that field until it is changed.
  String? _takenCode;

  @override
  void initState() {
    super.initState();
    for (final controller in _controllers) {
      controller.addListener(() => setState(() {}));
    }
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    _districts ??= DemoScope.read(context).societyAdmin.fetchDistricts();
  }

  @override
  void dispose() {
    for (final controller in _controllers) {
      controller.dispose();
    }
    super.dispose();
  }

  String _text(TextEditingController controller) => controller.text.trim();

  bool get _dirty =>
      _controllers.any((controller) => _text(controller).isNotEmpty) ||
      _districtId != null ||
      _location != null;

  Map<String, String> get _errors => {
    if (_text(_name).length < 2) 'name': _l.editNameError,
    if (!_codePattern.hasMatch(_text(_code))) 'code': _l.adminCodeRequired,
    if (_takenCode != null && _text(_code).toUpperCase() == _takenCode)
      'code': _serverError ?? _l.adminCodeTaken,
    if (_districtId == null) 'district': _l.adminDistrictRequired,
    if (_text(_ds).length < 2) 'ds': _l.adminDsRequired,
    if (_text(_address).length < 3) 'address': _l.valAddressRequired,
    if (!RegExp(r'^\d{1,7}$').hasMatch(_text(_members)) ||
        (int.tryParse(_text(_members)) ?? 0) < 1)
      'members': _l.adminMembersRequired,
    if (_text(_landline).isNotEmpty &&
        !_landlinePattern.hasMatch(
          _text(_landline).replaceAll(RegExp(r'[\s-]'), ''),
        ))
      'landline': _l.editLandlineFormat,
  };

  Future<void> _save() async {
    setState(() {
      _submitted = true;
      _serverError = null;
      _takenCode = null;
    });
    if (_errors.isNotEmpty) return;
    setState(() => _saving = true);
    final api = DemoScope.read(context).societyAdmin;
    final name = _text(_name);
    try {
      final id = await api.createSociety(
        NewSociety(
          nameEn: name,
          societyCode: _text(_code),
          nameLocal: _text(_local),
          districtId: _districtId!,
          dsDivision: _text(_ds),
          gnDivision: _text(_gn),
          addressLine: _text(_address),
          memberCount: int.parse(_text(_members)),
          landline: _text(_landline),
          grade: _grade,
          businessDescription: _text(_business),
          latitude: _location?.latitude,
          longitude: _location?.longitude,
        ),
      );
      if (!mounted) return;
      // Step 2 · Assign staff, in place of this form.
      Navigator.of(context).pushReplacement(
        MaterialPageRoute<void>(
          builder: (_) => AssignStaffScreen(
            societyId: id,
            societyName: name,
            justCreated: true,
          ),
        ),
      );
    } on SocietyRecordException catch (error) {
      if (!mounted) return;
      setState(() {
        _saving = false;
        _serverError = _l.recordError(error);
        if (error.message.contains('is already used by')) {
          _takenCode = _text(_code).toUpperCase();
        }
      });
    }
  }

  Future<void> _movePin() async {
    final location = await Navigator.of(context).push<GeoLocation>(
      MaterialPageRoute(builder: (_) => ManualPinScreen(initial: _location)),
    );
    if (location != null && mounted) setState(() => _location = location);
  }

  Future<void> _confirmLeave() async {
    final leave = await showDialog<bool>(
      context: context,
      builder: (dialog) => AlertDialog(
        title: Text(_l.editLeaveTitle),
        content: Text(_l.adminLeaveBody),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: Text(_l.editKeepEditing),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: Text(_l.adminLeave),
          ),
        ],
      ),
    );
    if (leave == true && mounted) Navigator.of(context).pop();
  }

  Widget _field(
    TextEditingController controller,
    String label, {
    String? errorKey,
    bool required = false,
    String? hint,
    TextInputType? keyboard,
    int maxLines = 1,
  }) => Padding(
    padding: const EdgeInsets.only(bottom: 12),
    child: Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label, required: required),
        TextField(
          controller: controller,
          keyboardType: keyboard,
          maxLines: maxLines,
          minLines: 1,
          style: recordInputStyle,
          decoration: changedDecoration(
            changed: false,
            helper: hint,
            error: errorKey == null
                ? null
                : (_submitted || errorKey == 'code' && _takenCode != null)
                ? _errors[errorKey]
                : null,
          ),
        ),
      ],
    ),
  );

  @override
  Widget build(BuildContext context) {
    final errors = _errors;
    return PopScope(
      canPop: !_dirty || _saving,
      onPopInvokedWithResult: (didPop, _) {
        if (!didPop) _confirmLeave();
      },
      child: Scaffold(
        appBar: recordFormAppBar(
          context,
          title: _l.adminCreateTitle,
          subtitle: _l.adminStep1,
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          children: [
            NoticeBanner(
              icon: Icons.groups_outlined,
              title: _l.adminExcoLaterTitle,
              message: _l.adminExcoLaterBody,
            ),
            const SizedBox(height: 14),
            _field(_name, _l.adminNameEn, errorKey: 'name', required: true),
            _field(
              _code,
              _l.recSNumber,
              errorKey: 'code',
              required: true,
              hint: _l.adminCodeHint,
            ),
            _field(_local, _l.adminNameLocal),
            FieldLabel(_l.adminDistrict, required: true),
            FutureBuilder<List<DistrictChoice>>(
              future: _districts,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        Expanded(
                          child: Text(
                            _l.adminDistrictsError,
                            style: RecordStyle.caption,
                          ),
                        ),
                        TextButton(
                          onPressed: () => setState(
                            () =>
                                _districts = DemoScope.read(context)
                                    .societyAdmin
                                    .fetchDistricts(),
                          ),
                          child: Text(_l.commonTryAgain),
                        ),
                      ],
                    ),
                  );
                }
                final districts = snapshot.data ?? const <DistrictChoice>[];
                return Padding(
                  padding: const EdgeInsets.only(bottom: 12),
                  child: DropdownButtonFormField<String>(
                    initialValue: _districtId,
                    isExpanded: true,
                    hint: Text(
                      snapshot.connectionState == ConnectionState.done
                          ? _l.adminChooseDistrict
                          : _l.adminLoadingDistricts,
                    ),
                    decoration: changedDecoration(
                      changed: false,
                      error: _submitted ? errors['district'] : null,
                    ),
                    items: [
                      for (final district in districts)
                        DropdownMenuItem(
                          value: district.id,
                          child: Text(district.name),
                        ),
                    ],
                    onChanged: (value) => setState(() => _districtId = value),
                  ),
                );
              },
            ),
            _field(_ds, _l.adminDs, errorKey: 'ds', required: true),
            _field(_gn, _l.adminGn),
            _field(
              _address,
              _l.recAddress,
              errorKey: 'address',
              required: true,
            ),
            _field(
              _members,
              _l.editMembers,
              errorKey: 'members',
              required: true,
              keyboard: TextInputType.number,
            ),
            _field(
              _landline,
              _l.editLandline,
              errorKey: 'landline',
              keyboard: TextInputType.phone,
              hint: _l.editLandlineHint,
            ),
            FieldLabel(_l.adminStartingGrade, required: true),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: DropdownButtonFormField<String>(
                initialValue: _grade,
                isExpanded: true,
                decoration: changedDecoration(
                  changed: false,
                  helper: _l.adminGradeHint,
                ),
                items: [
                  for (final grade in const ['A', 'B', 'C'])
                    DropdownMenuItem(
                      value: grade,
                      child: Text(_gradeLabel(_l, grade)),
                    ),
                ],
                onChanged: (value) => setState(() => _grade = value ?? 'C'),
              ),
            ),
            _field(
              _business,
              _l.adminBusiness,
              maxLines: 3,
              hint: _l.editBusinessHint,
            ),
            FieldLabel(_l.editMapLocation),
            Stack(
              children: [
                SocietyStreetMap(
                  height: 140,
                  location: _location,
                  onPick: (location) => setState(() => _location = location),
                  semanticLabel: _location == null
                      ? _l.editNoLocation
                      : _l.adminLocationAt(_location!.label),
                ),
                Positioned(
                  right: 8,
                  bottom: 8,
                  child: OutlinedButton.icon(
                    style: compactOutlinedStyle.copyWith(
                      backgroundColor: const WidgetStatePropertyAll(
                        AppColors.surface,
                      ),
                      minimumSize: const WidgetStatePropertyAll(Size(0, 30)),
                    ),
                    onPressed: _movePin,
                    icon: const Icon(Icons.place_outlined, size: 14),
                    label: Text(
                      _location == null ? _l.editSetPin : _l.editMovePin,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              _location == null ? _l.adminLocationOptional : _location!.label,
              style: RecordStyle.caption,
            ),
            if (_serverError != null && _takenCode == null) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: _l.adminNotCreated,
                message: '$_serverError What you typed is still here.',
              ),
            ],
            if (_submitted && errors.isNotEmpty) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: _l.adminCheckFields,
                message: errors.values.first,
              ),
            ],
          ],
        ),
        bottomNavigationBar: BottomActionBar(
          secondary: OutlinedButton(
            onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
            child: Text(_l.editCancel),
          ),
          primary: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? _l.recSaving : _l.adminSaveAssign),
          ),
        ),
      ),
    );
  }
}
