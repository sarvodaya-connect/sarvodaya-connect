import 'package:flutter/material.dart';

import '../drafts/draft_store.dart';
import '../l10n/l10n.dart';
import '../l10n/l10n_format.dart';
import '../l10n/record_l10n.dart';
import '../models/society.dart';
import '../screens/manual_pin_screen.dart';
import '../state/demo_store.dart';
import '../theme/app_theme.dart';
import '../widgets/count_field.dart' show parseCount;
import '../widgets/street_map.dart';
import '../widgets/state_views.dart';
import 'grade_change_request_screen.dart';
import 'profile_draft_merge.dart';
import 'record_widgets.dart';
import 'society_record_api.dart';
import 'society_record_models.dart';

/// M06e edit society information, with the M06u unsaved-changes warning.
/// Changes save directly (no District approval). The S number and grade are
/// read only here: only HQ changes them.
///
/// Issue #127: what is typed is kept on the phone as a draft until it is
/// saved to the record or discarded, so leaving the screen, a lost
/// connection, a failed save or an app restart never loses it. Before saving,
/// the newest record is fetched: fields only changed on the server are taken
/// from it, and fields changed on both sides are marked for review first.
class EditSocietyScreen extends StatefulWidget {
  const EditSocietyScreen({super.key, required this.record});

  final SocietyRecord record;

  @override
  State<EditSocietyScreen> createState() => _EditSocietyScreenState();
}

/// A field on the form, its original value and its label in the M06u warning.
class _Field {
  _Field(this.key, this.label, String? original)
    : original = original ?? '',
      controller = TextEditingController(text: original ?? '');

  /// Its name in a draft (one of [profileDraftFields]).
  final String key;

  /// Its name in the M06u warning, in the chosen language.
  final String Function(AppLocalizations l) label;

  /// The record's value this edit is compared with. A newer record replaces
  /// it (issue #127).
  String original;
  final TextEditingController controller;

  String get value => controller.text.trim();
  bool get changed => value != original;
}

final _landlinePattern = RegExp(r'^(0\d{9}|\+94\d{9})$');

/// Issue #141: the most members for each of female and male, and in all.
const maxMembers = 1000000;

class _EditSocietyScreenState extends State<EditSocietyScreen> {
  /// The newest record this screen has: the one it opened with, or a newer
  /// one fetched before saving or by Reload record.
  late SocietyRecord _record = widget.record;

  late final _name = _Field(
    'nameEn',
    (l) => l.editFieldName,
    widget.record.nameEn,
  );
  late final _female = _Field(
    'femaleMembers',
    (l) => l.editFieldFemale,
    widget.record.femaleMembers?.toString(),
  );
  late final _male = _Field(
    'maleMembers',
    (l) => l.editFieldMale,
    widget.record.maleMembers?.toString(),
  );
  late final _address = _Field(
    'addressLine',
    (l) => l.editFieldAddress,
    widget.record.addressLine,
  );
  late final _landline = _Field(
    'landline',
    (l) => l.editFieldLandline,
    widget.record.landline,
  );
  late final _business = _Field(
    'businessDescription',
    (l) => l.editFieldBusiness,
    widget.record.businessDescription,
  );
  late final _fields = [_name, _female, _male, _address, _landline, _business];
  late GeoLocation? _baseLocation = _locationOf(
    profileValuesOf(widget.record)['location']!,
  );
  late GeoLocation? _location = _baseLocation;
  bool _submitted = false;
  bool _saving = false;
  String? _serverError;

  /// When the draft on this phone was last saved. Null while there is none.
  DateTime? _draftSavedAt;

  /// Fields changed both here and on the server, for review (issue #127).
  Set<String> _conflicts = const {};

  /// The newer record filled in fields this draft had not changed.
  bool _tookNewer = false;

  /// The last save could not reach the server; the draft is kept.
  bool _connectionRequired = false;

  /// The newest record no longer lets this account edit it.
  bool _noLongerAllowed = false;

  /// Set while a draft or merge is put into the form, so that is not saved
  /// again as typing.
  bool _applying = false;

  @override
  void initState() {
    super.initState();
    for (final field in _fields) {
      field.controller.addListener(() {
        setState(() {});
        _keepDraft();
      });
    }
    WidgetsBinding.instance.addPostFrameCallback((_) => _restoreDraft());
  }

  static GeoLocation? _locationOf(String value) {
    final parts = value.split(',');
    if (parts.length != 2) return null;
    final latitude = double.tryParse(parts[0]);
    final longitude = double.tryParse(parts[1]);
    return latitude == null || longitude == null
        ? null
        : GeoLocation(latitude: latitude, longitude: longitude);
  }

  static String _locationText(GeoLocation? location) =>
      location == null ? '' : '${location.latitude},${location.longitude}';

  Map<String, String> get _base => {
    for (final field in _fields) field.key: field.original,
    'location': _locationText(_baseLocation),
  };

  Map<String, String> get _values => {
    for (final field in _fields) field.key: field.value,
    'location': _locationText(_location),
  };

  /// Puts a draft or a merge into the form.
  void _apply(Map<String, String> base, Map<String, String> values) {
    _applying = true;
    for (final field in _fields) {
      field.original = base[field.key] ?? '';
      final value = values[field.key] ?? field.original;
      if (field.controller.text != value) field.controller.text = value;
    }
    _baseLocation = _locationOf(base['location'] ?? '');
    _location = _locationOf(values['location'] ?? '') ?? _baseLocation;
    _applying = false;
  }

  /// Issue #127: reopens a draft saved earlier, checked against this record.
  Future<void> _restoreDraft() async {
    final store = DemoScope.read(context);
    final draft = await store.drafts.read(
      DraftKind.societyProfile,
      widget.record.id,
    );
    if (draft == null || !mounted) return;
    final merge = mergeProfileDraft(
      base: Map<String, String>.from(draft.data['base'] as Map),
      values: Map<String, String>.from(draft.data['values'] as Map),
      latest: profileValuesOf(_record),
    );
    setState(() {
      _apply(merge.base, merge.values);
      _draftSavedAt = draft.savedAt;
      _conflicts = merge.conflicts;
      _tookNewer = merge.tookNewer.isNotEmpty;
    });
    if (merge.changedOnServer) _keepDraft();
  }

  /// Keeps what is typed on the phone; with nothing changed, no draft is kept.
  void _keepDraft() {
    if (_applying || !mounted) return;
    final drafts = DemoScope.read(context).drafts;
    final id = widget.record.id;
    if (_changed.isEmpty) {
      if (_draftSavedAt != null) {
        drafts.discard(DraftKind.societyProfile, id);
        setState(() => _draftSavedAt = null);
      }
      return;
    }
    drafts
        .save(DraftKind.societyProfile, id, {'base': _base, 'values': _values})
        .then((savedAt) {
          if (savedAt != null && mounted && _changed.isNotEmpty) {
            setState(() => _draftSavedAt = savedAt);
          }
        });
  }

  Future<void> _discardDraft() async {
    final l = _l;
    final ok = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: AppColors.surface,
        surfaceTintColor: Colors.transparent,
        title: Text(l.draftDiscardTitle),
        content: Text(l.draftDiscardBody),
        actionsOverflowDirection: VerticalDirection.down,
        actionsOverflowButtonSpacing: 8,
        actions: [
          OutlinedButton(
            onPressed: () => Navigator.pop(context, false),
            child: Text(l.draftKeep),
          ),
          FilledButton(
            style: FilledButton.styleFrom(backgroundColor: AppColors.danger),
            onPressed: () => Navigator.pop(context, true),
            child: Text(l.draftDiscard),
          ),
        ],
      ),
    );
    if (ok != true || !mounted) return;
    await DemoScope.read(context).drafts
        .discard(DraftKind.societyProfile, widget.record.id);
    if (!mounted) return;
    final current = profileValuesOf(_record);
    setState(() {
      _apply(current, current);
      _draftSavedAt = null;
      _conflicts = const {};
      _tookNewer = false;
      _connectionRequired = false;
      _noLongerAllowed = false;
      _serverError = null;
      _submitted = false;
    });
  }

  /// The Reload Record flow (issue #127): fetches the newest record and
  /// merges it into the form, keeping what was typed. Null when it could not
  /// be fetched or may no longer be edited; the draft is kept either way.
  Future<ProfileMerge?> _reload() async {
    final store = DemoScope.read(context);
    final SocietyRecord latest;
    try {
      latest = await store.societyRecords.fetchRecord(widget.record.id);
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          if (error.offline || error.status == null) {
            _connectionRequired = true;
          } else if (error.status == 403 || error.status == 404) {
            _noLongerAllowed = true;
          } else {
            _serverError = _l.recStillHere(_l.recordError(error));
          }
        });
      }
      return null;
    }
    if (!mounted) return null;
    if (!latest.permissions.canEdit) {
      setState(() => _noLongerAllowed = true);
      return null;
    }
    final merge = mergeProfileDraft(
      base: _base,
      values: _values,
      latest: profileValuesOf(latest),
    );
    setState(() {
      _record = latest;
      _apply(merge.base, merge.values);
      _conflicts = merge.conflicts;
      _tookNewer = merge.tookNewer.isNotEmpty;
    });
    _keepDraft();
    return merge;
  }

  Future<void> _reloadRecord() async {
    setState(() {
      _connectionRequired = false;
      _noLongerAllowed = false;
      _serverError = null;
    });
    await _reload();
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
      (_location!.latitude != _baseLocation?.latitude ||
          _location!.longitude != _baseLocation?.longitude);

  AppLocalizations get _l => context.l10n;

  /// Labels of the changed fields, for the M06u warning.
  List<String> get _changed => [
    for (final field in _fields)
      if (field.changed) field.label(_l),
    if (_locationChanged) _l.editFieldLocation,
  ];

  String? get _nameError => _name.value.length < 2 ? _l.editNameError : null;

  int? get _femaleCount => parseCount(_female.value, max: maxMembers);
  int? get _maleCount => parseCount(_male.value, max: maxMembers);

  /// Issue #141: both boxes empty keeps an older record's total until the
  /// split is entered; otherwise both are needed, as whole numbers.
  bool get _keepsOldTotal =>
      _female.value.isEmpty &&
      _male.value.isEmpty &&
      !_record.hasMemberSplit &&
      _record.memberCount != null;

  String? get _membersError {
    if (_keepsOldTotal) return null;
    if ((_female.value.isNotEmpty && _femaleCount == null) ||
        (_male.value.isNotEmpty && _maleCount == null)) {
      return _l.editMembersFormat;
    }
    if (_female.value.isEmpty || _male.value.isEmpty) {
      return _l.editMembersBoth;
    }
    if (_femaleCount! + _maleCount! > maxMembers) return _l.editMembersTooMany;
    return null;
  }

  /// Female plus male while both are valid; the old total while it is kept.
  int? get _total {
    if (_keepsOldTotal) return _record.memberCount;
    if (_membersError != null) return null;
    return _femaleCount! + _maleCount!;
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
    if (_saving) return false;
    setState(() {
      _submitted = true;
      _serverError = null;
      _connectionRequired = false;
      _noLongerAllowed = false;
    });
    if (!_valid || _changed.isEmpty) return false;
    setState(() => _saving = true);
    // Issue #127: check the newest record first. Permissions are checked
    // again, untouched fields take newer values, and fields changed on both
    // sides stop the save until the person has seen them.
    final merge = await _reload();
    if (!mounted) return false;
    if (merge == null || merge.conflicts.isNotEmpty || !_valid) {
      setState(() => _saving = false);
      return false;
    }
    final drafts = DemoScope.read(context).drafts;
    if (_changed.isEmpty) {
      // The record already has every change: nothing is left to send.
      await drafts.discard(DraftKind.societyProfile, widget.record.id);
      if (!mounted) return true;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(_l.editSaved)));
      Navigator.of(context).pop(true);
      return true;
    }
    final changes = <String, Object>{
      if (_name.changed) 'nameEn': _name.value,
      // The API works out the total; both counts go together.
      if (_female.changed || _male.changed) ...{
        'femaleMembers': _femaleCount!,
        'maleMembers': _maleCount!,
      },
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
      // Saved only once the server has it.
      await drafts.discard(DraftKind.societyProfile, widget.record.id);
      if (!mounted) return true;
      ScaffoldMessenger.of(context)
          .showSnackBar(SnackBar(content: Text(_l.editSaved)));
      Navigator.of(context).pop(true);
      return true;
    } on SocietyRecordException catch (error) {
      if (mounted) {
        setState(() {
          _saving = false;
          if (error.offline || error.status == null) {
            _connectionRequired = true;
          } else if (error.status == 403 || error.status == 404) {
            _noLongerAllowed = true;
          } else {
            _serverError = _l.recStillHere(_l.recordError(error));
          }
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
                style: compactOutlinedStyle,
                onPressed: () => Navigator.pop(context, 'keepDraft'),
                child: Text(context.l10n.draftKeepLeave),
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
    switch (choice) {
      case 'discard':
        await DemoScope.read(context).drafts
            .discard(DraftKind.societyProfile, widget.record.id);
        if (mounted) Navigator.of(context).pop(false);
      case 'keepDraft':
        // The draft stays on this phone and is offered again next time.
        Navigator.of(context).pop(false);
      case 'save':
        await _save();
    }
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
            helper: _conflicts.contains(field.key)
                ? _l.draftConflictField(field.original)
                : field.changed && field.original.isNotEmpty
                ? _l.editWas(field.original)
                : hint,
            error: _submitted || field.changed ? error : null,
          ),
        ),
      ],
    ),
  );

  /// Issue #141: female and male side by side, and the total worked out from
  /// them. The total is read only: it is shown, never typed.
  Widget _members(AppLocalizations l) {
    final total = _total;
    final error = _submitted || _female.changed || _male.changed
        ? _membersError
        : null;
    Widget count(_Field field, String label) => Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        FieldLabel(label, required: !_keepsOldTotal),
        TextField(
          controller: field.controller,
          keyboardType: TextInputType.number,
          style: recordInputStyle,
          decoration: changedDecoration(
            changed: field.changed,
            helper: _conflicts.contains(field.key)
                ? _l.draftConflictField(field.original)
                : field.changed && field.original.isNotEmpty
                ? _l.editWas(field.original)
                : null,
            // The message is shown once, under both boxes.
            error: error == null ? null : '',
          ),
        ),
      ],
    );
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(child: count(_female, l.editFemale)),
              const SizedBox(width: 10),
              Expanded(child: count(_male, l.editMale)),
            ],
          ),
          if (error != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                error,
                style: const TextStyle(fontSize: 12, color: AppColors.danger),
              ),
            ),
          const SizedBox(height: 10),
          FieldLabel(l.editTotal),
          Semantics(
            label: l.editTotal,
            value: total == null ? '—' : l.number(total),
            liveRegion: true,
            readOnly: true,
            excludeSemantics: true,
            child: ReadOnlyField(total == null ? '—' : l.number(total)),
          ),
          const SizedBox(height: 4),
          Text(
            _keepsOldTotal
                ? l.editMembersOldTotal(_record.memberCount!)
                : l.editTotalHelp,
            style: RecordStyle.caption,
          ),
        ],
      ),
    );
  }

  /// Issue #127: Saved on this phone, Connection required and changed on the
  /// server, each with what the person can do next.
  List<Widget> _draftNotices(AppLocalizations l) {
    Widget gap(Widget child) =>
        Padding(padding: const EdgeInsets.only(bottom: 12), child: child);
    final savedAt = _draftSavedAt;
    return [
      if (_noLongerAllowed)
        gap(
          NoticeBanner(
            icon: Icons.lock_outline,
            tone: NoticeTone.error,
            title: l.draftNoAccessTitle,
            message: l.draftNoAccessMessage,
          ),
        ),
      if (_connectionRequired)
        gap(
          NoticeBanner(
            icon: Icons.cloud_off_outlined,
            tone: NoticeTone.warning,
            title: l.draftConnectionTitle,
            message: l.draftConnectionMessage,
            action: Align(
              alignment: AlignmentDirectional.centerStart,
              child: OutlinedButton.icon(
                style: compactOutlinedStyle,
                onPressed: _saving ? null : _save,
                icon: const Icon(Icons.refresh, size: 16),
                label: Text(l.commonTryAgain),
              ),
            ),
          ),
        ),
      if (_conflicts.isNotEmpty || _tookNewer)
        gap(
          NoticeBanner(
            icon: Icons.sync_problem_outlined,
            tone: NoticeTone.warning,
            title: l.draftChangedTitle,
            message: _conflicts.isNotEmpty
                ? l.draftConflictMessage(_conflicts.length)
                : l.draftNewerMessage,
          ),
        ),
      if (savedAt != null)
        gap(
          NoticeBanner(
            icon: Icons.save_outlined,
            title: l.draftSavedTitle,
            message: l.draftSavedMessage(l.accessDateTime(savedAt)),
            action: Wrap(
              spacing: 8,
              runSpacing: 4,
              children: [
                OutlinedButton(
                  style: compactOutlinedStyle,
                  onPressed: _saving ? null : _reloadRecord,
                  child: Text(l.draftReload),
                ),
                TextButton(
                  style: compactTextStyle.copyWith(
                    foregroundColor: const WidgetStatePropertyAll(
                      AppColors.danger,
                    ),
                  ),
                  onPressed: _saving ? null : _discardDraft,
                  child: Text(l.draftDiscard),
                ),
              ],
            ),
          ),
        ),
    ];
  }

  @override
  Widget build(BuildContext context) {
    final l = context.l10n;
    final record = _record;
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
                  // One slot whatever it holds: notices coming and going
                  // never move the fields, so typing keeps its focus.
                  Column(
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: _draftNotices(l),
                  ),
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
                  _members(l),
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
