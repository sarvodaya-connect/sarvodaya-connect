import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../models/profile_draft.dart';
import '../models/society.dart';
import '../models/user.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../validation/validators.dart';
import '../widgets/map_preview.dart';
import '../widgets/profile_widgets.dart';
import '../widgets/section_card.dart';
import '../widgets/state_views.dart';
import 'manual_pin_screen.dart';
import 'profile_review_screen.dart';

/// SC-25 M04 · Edit society profile. Saving creates a draft; the approved record
/// does not change until the District Centre approves the update.
class EditProfileScreen extends StatefulWidget {
  const EditProfileScreen({super.key});

  @override
  State<EditProfileScreen> createState() => _EditProfileScreenState();
}

class _EditProfileScreenState extends State<EditProfileScreen> {
  final _formKey = GlobalKey<FormState>();
  final _scroll = ScrollController();
  final _address = TextEditingController();
  final _village = TextEditingController();
  final _phone = TextEditingController();
  final _email = TextEditingController();
  GeoLocation? _location;
  LocationSource _locationSource = LocationSource.approved;
  late ProfileValues _base;
  late int _baseVersion;
  bool _initialised = false;
  bool _attempted = false;
  int _errorCount = 0;
  String? _locationError;
  bool _permissionDenied = false;
  List<String> _reloadNotes = const [];

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_initialised) return;
    _initialised = true;
    final store = DemoScope.read(context);
    final draft = store.profileDraft;
    // Reopening the form restores the saved draft, including an outdated one,
    // so the conflicting-update state can be shown instead of losing it.
    if (draft != null) {
      _apply(draft.values);
      _locationSource = draft.locationSource;
      _base = draft.base;
      _baseVersion = draft.baseVersion;
    } else {
      _apply(store.approvedProfile);
      _base = store.approvedProfile;
      _baseVersion = store.recordVersion;
    }
  }

  @override
  void dispose() {
    for (final controller in [_address, _village, _phone, _email]) {
      controller.dispose();
    }
    _scroll.dispose();
    super.dispose();
  }

  void _apply(ProfileValues values) {
    _address.text = values.addressLine;
    _village.text = values.village;
    _phone.text = values.phone;
    _email.text = values.email;
    _location = values.location;
  }

  ProfileValues get _current => ProfileValues(
    addressLine: _address.text.trim(),
    village: _village.text.trim().replaceAll(RegExp(r'\s+'), ' '),
    phone: _phone.text.trim(),
    email: _email.text.trim(),
    location: _location,
  );

  void _scrollToTop() => _scroll.animateTo(
    0,
    duration: const Duration(milliseconds: 250),
    curve: Curves.easeOut,
  );

  void _useMyLocation() {
    final store = DemoScope.read(context);
    if (store.locationPermissionDenied) {
      setState(() => _permissionDenied = true);
      return;
    }
    setState(() {
      _location = DemoStore.demoDeviceLocation;
      _locationSource = LocationSource.device;
      _locationError = null;
      _permissionDenied = false;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Location added from this phone (demonstration location).',
        ),
      ),
    );
  }

  Future<void> _placePin() async {
    final picked = await Navigator.of(context).push<GeoLocation>(
      MaterialPageRoute(builder: (_) => ManualPinScreen(initial: _location)),
    );
    if (picked == null || !mounted) return;
    setState(() {
      _location = picked;
      _locationSource = LocationSource.manual;
      _locationError = null;
      _permissionDenied = false;
    });
  }

  /// Reload Record: newer approved values replace fields the officer did not
  /// change; the officer's own edits are kept and listed if they overlap.
  void _reloadRecord() {
    final store = DemoScope.read(context);
    final result = store.rebaseProfile(_current, _base);
    setState(() {
      _apply(result.values);
      _base = store.approvedProfile;
      _baseVersion = store.recordVersion;
      _reloadNotes = result.bothChanged;
    });
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(
        content: Text(
          'Record reloaded. Your edits are kept — check them before saving.',
        ),
      ),
    );
  }

  void _save() {
    final store = DemoScope.read(context);
    final valid = _formKey.currentState!.validate();
    final locationError = Validators.gpsLocation(_location);
    final errors = [
      Validators.addressLine(_address.text),
      Validators.villageName(_village.text),
      Validators.sriLankanPhone(_phone.text),
      Validators.optionalEmail(_email.text),
      locationError,
    ].whereType<String>().length;
    setState(() {
      _attempted = true;
      _errorCount = errors;
      _locationError = locationError;
    });
    if (_baseVersion != store.recordVersion) {
      // Never save an outdated draft over the newer record.
      _scrollToTop();
      return;
    }
    if (!valid || locationError != null) {
      // Entered values stay in the fields; only the messages appear.
      _scrollToTop();
      return;
    }
    final values = _current;
    if (values.changedFieldsComparedTo(store.approvedProfile).isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('Nothing has changed from the approved record.'),
        ),
      );
      return;
    }
    try {
      store.saveProfileDraft(
        values: values,
        base: _base,
        baseVersion: _baseVersion,
        locationSource: _locationSource,
      );
    } on ConflictingUpdateException {
      setState(() {});
      return;
    }
    Navigator.of(context).pushReplacement(
      MaterialPageRoute<void>(builder: (_) => const ProfileReviewScreen()),
    );
  }

  String? _approvedHint(String approved, TextEditingController controller) {
    if (controller.text.trim() == approved) return null;
    return approved.isEmpty ? 'Approved: Missing' : 'Approved: $approved';
  }

  @override
  Widget build(BuildContext context) {
    final store = DemoScope.of(context);
    if (store.activeRole != UserRole.societyOfficer) {
      return Scaffold(
        appBar: AppBar(title: const Text('Society profile')),
        body: const Center(
          child: Padding(
            padding: EdgeInsets.all(24),
            child: StateMessage(
              icon: Icons.lock_outline,
              title: 'Read-only access',
              message: 'Your role can view society information but cannot edit these details.',
            ),
          ),
        ),
      );
    }
    final approved = store.approvedProfile;
    final conflict = _baseVersion != store.recordVersion;

    return Scaffold(
      appBar: AppBar(title: const Text('Edit profile')),
      body: Form(
        key: _formKey,
        child: ListView(
          controller: _scroll,
          padding: const EdgeInsets.all(16),
          children: [
            // Notices share one fixed slot so showing them never shifts (and
            // rebuilds) the form fields below, which would drop their errors.
            Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                if (conflict) ...[
                  ConflictNotice(
                    updatedBy: store.recordUpdatedBy ?? 'The District Centre',
                    updatedAt: store.recordUpdatedAt ?? store.now,
                    onReload: _reloadRecord,
                    draftKeptMessage: 'Your changes are kept on this screen, but they have not been saved.',
                  ),
                  const SizedBox(height: 12),
                ],
                if (_reloadNotes.isNotEmpty) ...[
                  NoticeBanner(
                    icon: Icons.info_outline,
                    tone: NoticeTone.warning,
                    title: 'Check ${_reloadNotes.join(', ')}',
                    message: 'This was also changed in the newer record. Your value is kept; the approved value is shown under the field.',
                  ),
                  const SizedBox(height: 12),
                ],
                if (_attempted && _errorCount > 0) ...[
                  NoticeBanner(
                    icon: Icons.error_outline,
                    tone: NoticeTone.error,
                    title: _errorCount == 1
                        ? 'Fix 1 field before saving'
                        : 'Fix $_errorCount fields before saving',
                    message: 'Your other answers have been kept.',
                  ),
                  const SizedBox(height: 12),
                ],
                const NoticeBanner(
                  icon: Icons.edit_note,
                  title: 'Changes are saved as a draft',
                  message: 'The approved record does not change until the District Centre approves your update.',
                ),
                const SizedBox(height: 12),
              ],
            ),
            SectionCard(
              title: 'Address',
              children: [
                TextFormField(
                  controller: _address,
                  decoration: InputDecoration(
                    labelText: 'Address *',
                    helperText: _approvedHint(approved.addressLine, _address),
                  ),
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() {}),
                  validator: Validators.addressLine,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _village,
                  decoration: InputDecoration(
                    labelText: 'Village or town *',
                    helperText: _approvedHint(approved.village, _village),
                  ),
                  textCapitalization: TextCapitalization.words,
                  textInputAction: TextInputAction.next,
                  onChanged: (_) => setState(() {}),
                  validator: Validators.villageName,
                ),
              ],
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: 'Contact',
              children: [
                TextFormField(
                  controller: _phone,
                  decoration: InputDecoration(
                    labelText: 'Society phone *',
                    hintText: 'For example +94 00 000 0010',
                    helperText:
                        _approvedHint(approved.phone, _phone) ??
                        'Sri Lankan number starting with +94 or 0',
                  ),
                  keyboardType: TextInputType.phone,
                  textInputAction: TextInputAction.next,
                  inputFormatters: [
                    FilteringTextInputFormatter.allow(RegExp(r'[0-9+\s\-]')),
                  ],
                  onChanged: (_) => setState(() {}),
                  validator: Validators.sriLankanPhone,
                ),
                const SizedBox(height: 14),
                TextFormField(
                  controller: _email,
                  decoration: InputDecoration(
                    labelText: 'Society email',
                    hintText: 'society@example.invalid',
                    helperText:
                        _approvedHint(approved.email, _email) ?? 'Optional',
                  ),
                  keyboardType: TextInputType.emailAddress,
                  textInputAction: TextInputAction.done,
                  onChanged: (_) => setState(() {}),
                  validator: Validators.optionalEmail,
                ),
              ],
            ),
            const SizedBox(height: 12),
            SectionCard(
              title: 'GPS location *',
              highlight: _locationError != null,
              children: [
                MapPreview(location: _location),
                const SizedBox(height: 10),
                if (_location == null)
                  const InfoRow(label: 'Location', value: null)
                else
                  InfoRow(
                    label: _locationSource.label,
                    value: _location!.label,
                  ),
                if (_location != approved.location && approved.location != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      'Approved: ${approved.location!.label}',
                      style: const TextStyle(
                        color: AppColors.muted,
                        fontSize: 12,
                      ),
                    ),
                  ),
                if (_locationError != null)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: Text(
                      _locationError!,
                      style: const TextStyle(color: AppColors.danger),
                    ),
                  ),
                if (_permissionDenied) ...[
                  LocationPermissionDenied(
                    onOpenSettings: () => showOpenSettingsDemo(context),
                    onPlacePin: _placePin,
                  ),
                  const SizedBox(height: 10),
                ],
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    OutlinedButton.icon(
                      onPressed: _useMyLocation,
                      icon: const Icon(Icons.my_location),
                      label: const Text('Use my location'),
                    ),
                    OutlinedButton.icon(
                      onPressed: _placePin,
                      icon: const Icon(Icons.push_pin_outlined),
                      label: const Text('Place pin manually'),
                    ),
                  ],
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
          child: const Text('Save draft'),
        ),
      ),
    );
  }
}
