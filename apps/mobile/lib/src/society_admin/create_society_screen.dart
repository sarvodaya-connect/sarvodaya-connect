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

const _gradeLabels = {
  'A': 'A · Strong',
  'B': 'B · Developing',
  'C': 'C · Needs Strengthening',
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
    if (_text(_name).length < 2) 'name': 'Enter the society name.',
    if (!_codePattern.hasMatch(_text(_code)))
      'code': 'Enter the S number, for example S-104233.',
    if (_takenCode != null && _text(_code).toUpperCase() == _takenCode)
      'code': _serverError ?? 'This S number is already used.',
    if (_districtId == null) 'district': 'Choose the district.',
    if (_text(_ds).length < 2) 'ds': 'Enter the DS division.',
    if (_text(_address).length < 3) 'address': 'Enter the address.',
    if (!RegExp(r'^\d{1,7}$').hasMatch(_text(_members)) ||
        (int.tryParse(_text(_members)) ?? 0) < 1)
      'members': 'Enter the number of members, for example 164.',
    if (_text(_landline).isNotEmpty &&
        !_landlinePattern.hasMatch(
          _text(_landline).replaceAll(RegExp(r'[\s-]'), ''),
        ))
      'landline': 'Enter a 10-digit number, for example 037 000 0000, or leave it empty.',
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
        _serverError = error.message;
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
        title: const Text('Leave Without Saving?'),
        content: const Text(
          'The society has not been created. What you typed will be lost.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialog, false),
            child: const Text('Keep editing'),
          ),
          TextButton(
            onPressed: () => Navigator.pop(dialog, true),
            child: const Text('Leave'),
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
          title: 'Create a Society Record',
          subtitle: 'Step 1 of 2 · Society details',
        ),
        body: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 16),
          children: [
            const NoticeBanner(
              icon: Icons.groups_outlined,
              title: 'The Exco Is Entered Later',
              message: 'Next, assign a Society Officer. They add the 25 Exco members and can save as they go. The record shows the Exco as incomplete until all 25 seats are filled.',
            ),
            const SizedBox(height: 14),
            _field(
              _name,
              'Society name (English)',
              errorKey: 'name',
              required: true,
            ),
            _field(
              _code,
              'S number',
              errorKey: 'code',
              required: true,
              hint: 'For example S-104233.',
            ),
            _field(_local, 'Name in Sinhala or Tamil'),
            const FieldLabel('District', required: true),
            FutureBuilder<List<DistrictChoice>>(
              future: _districts,
              builder: (context, snapshot) {
                if (snapshot.hasError) {
                  return Padding(
                    padding: const EdgeInsets.only(bottom: 12),
                    child: Row(
                      children: [
                        const Expanded(
                          child: Text(
                            'The districts could not be loaded.',
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
                          child: const Text('Try again'),
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
                          ? 'Choose a district'
                          : 'Loading districts…',
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
            _field(_ds, 'DS division', errorKey: 'ds', required: true),
            _field(_gn, 'GN division'),
            _field(_address, 'Address', errorKey: 'address', required: true),
            _field(
              _members,
              'Number of members',
              errorKey: 'members',
              required: true,
              keyboard: TextInputType.number,
            ),
            _field(
              _landline,
              'Landline (if the society has one)',
              errorKey: 'landline',
              keyboard: TextInputType.phone,
              hint: 'For example 037 000 0000. Leave empty if none.',
            ),
            const FieldLabel('Starting grade', required: true),
            Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: DropdownButtonFormField<String>(
                initialValue: _grade,
                isExpanded: true,
                decoration: changedDecoration(
                  changed: false,
                  helper: 'Only HQ sets or changes the grade.',
                ),
                items: [
                  for (final entry in _gradeLabels.entries)
                    DropdownMenuItem(
                      value: entry.key,
                      child: Text(entry.value),
                    ),
                ],
                onChanged: (value) => setState(() => _grade = value ?? 'C'),
              ),
            ),
            _field(
              _business,
              'Business run by the society (optional)',
              maxLines: 3,
              hint: 'Information only — no sales, stock or accounts.',
            ),
            const FieldLabel('Map location'),
            Stack(
              children: [
                SocietyStreetMap(
                  height: 140,
                  location: _location,
                  onPick: (location) => setState(() => _location = location),
                  semanticLabel: _location == null
                      ? 'No map location set'
                      : 'Map location ${_location!.label}',
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
                    label: Text(_location == null ? 'Set pin' : 'Move pin'),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 4),
            Text(
              _location == null
                  ? 'Optional. It can be set later by HQ or the society\'s staff.'
                  : _location!.label,
              style: RecordStyle.caption,
            ),
            if (_serverError != null && _takenCode == null) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: 'The Society Was Not Created',
                message: '$_serverError What you typed is still here.',
              ),
            ],
            if (_submitted && errors.isNotEmpty) ...[
              const SizedBox(height: 12),
              NoticeBanner(
                icon: Icons.error_outline,
                tone: NoticeTone.error,
                title: 'Check the Highlighted Fields',
                message: errors.values.first,
              ),
            ],
          ],
        ),
        bottomNavigationBar: BottomActionBar(
          secondary: OutlinedButton(
            onPressed: _saving ? null : () => Navigator.of(context).maybePop(),
            child: const Text('Cancel'),
          ),
          primary: FilledButton(
            onPressed: _saving ? null : _save,
            child: Text(_saving ? 'Saving…' : 'Save and assign staff'),
          ),
        ),
      ),
    );
  }
}
