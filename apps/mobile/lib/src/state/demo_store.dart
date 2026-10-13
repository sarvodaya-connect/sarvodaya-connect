import 'package:flutter/widgets.dart';

import '../data/demo_data.dart';
import '../format.dart';
import '../models/committee.dart';
import '../models/document.dart';
import '../models/profile_draft.dart';
import '../models/society.dart';
import '../models/submission.dart';
import '../models/user.dart';
import '../validation/validators.dart';

/// Thrown when the demo is in offline mode and an action needs the network.
class OfflineException implements Exception {
  const OfflineException();
}

/// Thrown when the demo is set to simulate a general loading error.
class DemoLoadException implements Exception {
  const DemoLoadException();
}

/// Officer's unsent replacement for one Council seat. Kept separate from the
/// approved Council so draft values never change the official record.
class CouncilReplacementDraft {
  const CouncilReplacementDraft({
    required this.memberId,
    required this.fullName,
    required this.phone,
    required this.seatType,
    this.age,
    required this.startDate,
  });

  final String memberId;
  final String fullName;
  final String phone;
  final CouncilSeatType seatType;
  final int? age;
  final DateTime startDate;
}

/// Safe, in-memory demonstration state for SC-26. Nothing is written to a backend:
/// the real API and WSO2 sign-in replace this in later tasks.
class DemoStore extends ChangeNotifier {
  DemoStore({
    this.loadDelay = const Duration(milliseconds: 700),
    DateTime Function()? clock,
  }) : _clock = clock ?? DateTime.now;

  final Duration loadDelay;
  final DateTime Function() _clock;

  DateTime get now => _clock();

  // Demo switches, shown in the "Demo options" sheet.
  bool offline = false;
  bool failLoads = false;
  bool emptyTracker = false;

  /// Demo: the phone has refused location access, so "Use my location" shows
  /// the permission-denied state. No real permission is ever requested.
  bool locationPermissionDenied = false;

  /// Increases whenever a demo option changes, so screens can reload and show the new state.
  int optionsVersion = 0;

  int _selectedTab = 0;
  int get selectedTab => _selectedTab;

  void selectTab(int tab) {
    _selectedTab = tab;
    notifyListeners();
  }

  AuthenticatedUser? _user;
  AuthenticatedUser? get user => _user;

  SocietyDetails _society = demoSociety;

  /// The approved society record. Drafts never change it directly.
  SocietyDetails get society => _society;

  /// Version of the approved record. It increases when the District Centre
  /// (simulated in the demo) saves a newer version.
  int recordVersion = 1;
  DateTime? recordUpdatedAt;
  String? recordUpdatedBy;

  final List<CommitteeMember> _council = List.of(demoCouncil);
  List<CommitteeMember> get council => List.unmodifiable(_council);

  /// Members replaced after approval, kept as history.
  final List<CommitteeMember> _councilHistory = [];
  List<CommitteeMember> get councilHistory =>
      List.unmodifiable(_councilHistory);

  CouncilReplacementDraft? _draft;
  CouncilReplacementDraft? get draft => _draft;

  final List<SocietyDocument> _documents = List.of(demoDocuments);
  List<SocietyDocument> get documents => List.unmodifiable(_documents);

  /// Documents uploaded for the pending Council update (status Draft).
  List<SocietyDocument> get draftDocuments => _documents
      .where((document) => document.status == DocumentStatus.draft)
      .toList();

  final List<SocietySubmission> _submissions = List.of(demoSubmissionHistory);
  List<SocietySubmission> get submissions =>
      emptyTracker ? const [] : List.unmodifiable(_submissions.reversed);

  int _nextReference = 143;

  /// The Council update the demo journey is about, once it has been submitted.
  SocietySubmission? get councilSubmission {
    for (final submission in _submissions.reversed) {
      if (submission.type == SubmissionType.councilUpdate) return submission;
    }
    return null;
  }

  SocietySubmission? submissionById(String id) {
    for (final submission in _submissions) {
      if (submission.id == id) return submission;
    }
    return null;
  }

  CommitteeMember? memberById(String id) {
    for (final member in _council) {
      if (member.id == id) return member;
    }
    return null;
  }

  /// Seats filled for each seat type.
  Map<CouncilSeatType, int> get seatsFilled {
    final counts = {for (final type in CouncilSeatType.values) type: 0};
    for (final member in _council) {
      counts[member.seatType] = counts[member.seatType]! + 1;
    }
    return counts;
  }

  int get totalSeats =>
      CouncilSeatType.values.fold(0, (sum, type) => sum + type.seatCount);

  /// True while a change to this member is waiting for the District Centre.
  bool hasPendingChange(String memberId) {
    if (_draft?.memberId == memberId) return true;
    final submission = councilSubmission;
    return submission != null &&
        submission.status != SubmissionStatus.approved &&
        submission.status != SubmissionStatus.rejected &&
        submission.changes.any(
          (change) => change.field.startsWith('$memberId.'),
        );
  }

  /// Simulates fetching data for a screen, including the loading, offline and error states.
  Future<void> load() async {
    await Future<void>.delayed(loadDelay);
    if (offline) throw const OfflineException();
    if (failLoads) throw const DemoLoadException();
  }

  /// Returns true when the demo credentials match. Never stores the password.
  Future<bool> signIn(String username, String password) async {
    await Future<void>.delayed(loadDelay);
    if (offline) throw const OfflineException();
    final matches =
        username.trim().toLowerCase() == DemoAccount.username &&
        password == DemoAccount.password;
    if (matches) {
      _user = demoOfficer;
      notifyListeners();
    }
    return matches;
  }

  void signOut() {
    _user = null;
    _selectedTab = 0;
    notifyListeners();
  }

  void setDemoOptions({
    bool? offline,
    bool? failLoads,
    bool? emptyTracker,
    bool? locationPermissionDenied,
  }) {
    this.offline = offline ?? this.offline;
    this.failLoads = failLoads ?? this.failLoads;
    this.emptyTracker = emptyTracker ?? this.emptyTracker;
    this.locationPermissionDenied =
        locationPermissionDenied ?? this.locationPermissionDenied;
    optionsVersion++;
    notifyListeners();
  }

  void saveDraft(CouncilReplacementDraft draft) {
    _draft = draft;
    notifyListeners();
  }

  void discardDraft() {
    _draft = null;
    _documents.removeWhere(
      (document) => document.status == DocumentStatus.draft,
    );
    notifyListeners();
  }

  /// Adds an uploaded file as a Draft document attached to the pending update.
  SocietyDocument addDraftDocument({
    required DocumentType type,
    required String fileName,
    required String contentType,
    required int sizeBytes,
  }) {
    final document = SocietyDocument(
      id: 'doc-draft-${_documents.length + 1}',
      societyId: society.id,
      documentType: type,
      fileName: fileName,
      contentType: contentType,
      sizeBytes: sizeBytes,
      status: DocumentStatus.draft,
      uploadedBy: _user?.displayName ?? demoOfficer.displayName,
      uploadedAt: now,
    );
    _documents.add(document);
    notifyListeners();
    return document;
  }

  void removeDocument(String id) {
    _documents.removeWhere(
      (document) =>
          document.id == id && document.status == DocumentStatus.draft,
    );
    notifyListeners();
  }

  /// The changes the District Manager will see for the current draft.
  /// Only fields whose value differs from the approved record are included.
  List<SubmissionChange> draftChanges() {
    final draft = _draft;
    if (draft == null) return const [];
    final outgoing = memberById(draft.memberId);
    final role = outgoing?.position ?? 'Council member';
    final startDate = formatDate(draft.startDate);
    final previousStart = outgoing?.appointedOn == null
        ? null
        : formatDate(outgoing!.appointedOn!);
    return [
      SubmissionChange(
        field: '${draft.memberId}.fullName',
        label: '$role name',
        previousValue: outgoing?.fullName,
        proposedValue: draft.fullName,
      ),
      if (Validators.normalisePhone(draft.phone) !=
          Validators.normalisePhone(outgoing?.phone ?? ''))
        SubmissionChange(
          field: '${draft.memberId}.phone',
          label: '$role phone',
          previousValue: outgoing?.phone,
          proposedValue: draft.phone,
        ),
      if (draft.seatType != outgoing?.seatType)
        SubmissionChange(
          field: '${draft.memberId}.seatType',
          label: 'Seat type',
          previousValue: outgoing?.seatType.label,
          proposedValue: draft.seatType.label,
        ),
      if (draft.age != null && draft.age != outgoing?.age)
        SubmissionChange(
          field: '${draft.memberId}.age',
          label: 'Age',
          previousValue: outgoing?.age?.toString(),
          proposedValue: draft.age.toString(),
        ),
      if (startDate != previousStart)
        SubmissionChange(
          field: '${draft.memberId}.appointedOn',
          label: '$role start date',
          previousValue: previousStart,
          proposedValue: startDate,
        ),
    ];
  }

  // ----- Society profile editing (SC-25 M04) -----

  /// Fictional coordinates returned by "Use my location" in the demo.
  static const demoDeviceLocation = GeoLocation(
    latitude: 7.4675,
    longitude: 80.0419,
  );

  ProfileEditDraft? _profileDraft;
  ProfileEditDraft? get profileDraft => _profileDraft;

  ProfileValues get approvedProfile => ProfileValues.fromSociety(_society);

  /// True when the saved profile draft was started from an older record version.
  bool get profileDraftOutdated =>
      _profileDraft != null && _profileDraft!.baseVersion != recordVersion;

  /// The profile update waiting for review, if any.
  SocietySubmission? get pendingProfileSubmission {
    for (final submission in _submissions.reversed) {
      if (submission.type == SubmissionType.profileUpdate &&
          submission.isLocked) {
        return submission;
      }
    }
    return null;
  }

  /// Saves the edits as a draft on the phone. Throws [ConflictingUpdateException]
  /// when [baseVersion] is older than the approved record, so an outdated draft
  /// can never silently replace newer data.
  void saveProfileDraft({
    required ProfileValues values,
    required ProfileValues base,
    required int baseVersion,
    required LocationSource locationSource,
  }) {
    if (baseVersion != recordVersion) throw const ConflictingUpdateException();
    _profileDraft = ProfileEditDraft(
      values: values,
      base: base,
      baseVersion: baseVersion,
      locationSource: locationSource,
      savedAt: now,
    );
    notifyListeners();
  }

  void discardProfileDraft() {
    _profileDraft = null;
    notifyListeners();
  }

  /// Rebases [values] (started from [base]) onto the latest approved record.
  /// Fields the officer did not change take the newer approved value; fields the
  /// officer changed keep the officer's value. Returns the rebased values and the
  /// fields that were changed both by the officer and in the newer record.
  ({ProfileValues values, List<String> bothChanged}) rebaseProfile(
    ProfileValues values,
    ProfileValues base,
  ) {
    final latest = approvedProfile;
    final officerChanged = values.changedFieldsComparedTo(base).toSet();
    final recordChanged = latest.changedFieldsComparedTo(base).toSet();
    final rebased = ProfileValues(
      addressLine: officerChanged.contains(ProfileField.address)
          ? values.addressLine
          : latest.addressLine,
      village: officerChanged.contains(ProfileField.village)
          ? values.village
          : latest.village,
      phone: officerChanged.contains(ProfileField.phone)
          ? values.phone
          : latest.phone,
      email: officerChanged.contains(ProfileField.email)
          ? values.email
          : latest.email,
      location: officerChanged.contains(ProfileField.location)
          ? values.location
          : latest.location,
    );
    return (
      values: rebased,
      bothChanged: officerChanged.intersection(recordChanged).toList(),
    );
  }

  /// "Reload Record" for a saved draft: keeps the officer's edits on top of the
  /// newer approved record. Returns fields that need the officer's attention.
  List<String> reloadProfileDraft() {
    final draft = _profileDraft;
    if (draft == null) return const [];
    final result = rebaseProfile(draft.values, draft.base);
    _profileDraft = ProfileEditDraft(
      values: result.values,
      base: approvedProfile,
      baseVersion: recordVersion,
      locationSource: draft.locationSource,
      savedAt: now,
    );
    notifyListeners();
    return result.bothChanged;
  }

  /// Fields that differ between the draft and the approved record.
  List<SubmissionChange> profileDraftChanges() {
    final draft = _profileDraft;
    if (draft == null) return const [];
    final approved = approvedProfile;
    return [
      for (final field in draft.values.changedFieldsComparedTo(approved))
        SubmissionChange(
          field: 'society.${field.toLowerCase().replaceAll(' ', '_')}',
          label: field,
          previousValue: approved.valueOf(field),
          proposedValue: draft.values.valueOf(field) ?? '',
        ),
    ];
  }

  /// Sends the profile draft to the District Manager. The approved record is not
  /// changed until the update is approved.
  Future<SocietySubmission> submitProfileUpdate() async {
    final draft = _profileDraft;
    if (draft == null) throw StateError('There is no profile draft to submit.');
    if (draft.baseVersion != recordVersion) {
      throw const ConflictingUpdateException();
    }
    await Future<void>.delayed(loadDelay);
    if (offline) throw const OfflineException();
    final submittedAt = now;
    final reference =
        'SUB-2026-${(_nextReference++).toString().padLeft(4, '0')}';
    final submission = SocietySubmission(
      id: 'sub-profile-$reference',
      reference: reference,
      societyId: society.id,
      type: SubmissionType.profileUpdate,
      title: 'Society profile update',
      submittedBy: _user?.displayName ?? demoOfficer.displayName,
      status: SubmissionStatus.submitted,
      changes: profileDraftChanges(),
      submittedAt: submittedAt,
      updatedAt: submittedAt,
      timeline: [
        TimelineEvent(
          status: SubmissionStatus.draft,
          title: 'Draft started',
          at: draft.savedAt,
        ),
        TimelineEvent(
          status: SubmissionStatus.submitted,
          title: 'Submitted to District Manager',
          at: submittedAt,
          detail: 'Awaiting review by the $demoReviewerOffice',
        ),
      ],
    );
    _submissions.add(submission);
    _profileDraft = null;
    notifyListeners();
    return submission;
  }

  /// Demo: the District Centre saves a newer version of the society record
  /// (here, a corrected society phone number) while the officer has a draft open.
  void demoNewerRecord() {
    final nextPhone = recordVersion.isOdd
        ? '+94 00 000 0011'
        : '+94 00 000 0012';
    _society = _society.copyWith(
      contacts: [
        for (final contact in _society.contacts)
          contact.label == 'Society phone'
              ? SocietyContact(
                  id: contact.id,
                  label: contact.label,
                  phone: nextPhone,
                  isPrimary: contact.isPrimary,
                )
              : contact,
      ],
      updatedAt: now,
    );
    recordVersion++;
    recordUpdatedAt = now;
    recordUpdatedBy = demoReviewerName;
    optionsVersion++;
    notifyListeners();
  }

  /// Sends the draft to the District Manager. Throws [OfflineException] when offline;
  /// the draft is kept on the phone in that case.
  Future<SocietySubmission> submitCouncilUpdate() async {
    if (_draft == null) throw StateError('There is no draft to submit.');
    await Future<void>.delayed(loadDelay);
    if (offline) throw const OfflineException();
    final submittedAt = now;
    final reference =
        'SUB-2026-${(_nextReference++).toString().padLeft(4, '0')}';
    final attached = [
      for (final document in draftDocuments)
        SocietyDocument(
          id: document.id,
          societyId: document.societyId,
          documentType: document.documentType,
          fileName: document.fileName,
          contentType: document.contentType,
          sizeBytes: document.sizeBytes,
          status: DocumentStatus.submitted,
          uploadedBy: document.uploadedBy,
          uploadedAt: document.uploadedAt,
          submissionReference: reference,
        ),
    ];
    final submission = SocietySubmission(
      id: 'sub-council-$reference',
      reference: reference,
      societyId: society.id,
      type: SubmissionType.councilUpdate,
      title: 'Council update',
      submittedBy: _user?.displayName ?? demoOfficer.displayName,
      status: SubmissionStatus.submitted,
      changes: draftChanges(),
      documents: attached,
      submittedAt: submittedAt,
      updatedAt: submittedAt,
      timeline: [
        TimelineEvent(
          status: SubmissionStatus.draft,
          title: 'Draft started',
          at: submittedAt,
        ),
        TimelineEvent(
          status: SubmissionStatus.submitted,
          title: 'Submitted to District Manager',
          at: submittedAt,
          detail: 'Awaiting review by the $demoReviewerOffice',
        ),
      ],
    );
    _documents
      ..removeWhere((document) => document.status == DocumentStatus.draft)
      ..addAll(attached);
    _submissions.add(submission);
    notifyListeners();
    return submission;
  }

  // ----- Demonstration of the District Manager's side (reviews happen on the web dashboard) -----

  void demoStartReview(String id) {
    _update(
      id,
      (submission) => submission.copyWith(
        status: SubmissionStatus.underReview,
        reviewStartedAt: now,
        reviewerDisplayName: demoReviewerName,
        updatedAt: now,
        timeline: [
          ...submission.timeline,
          TimelineEvent(
            status: SubmissionStatus.underReview,
            title: 'Under Review',
            at: now,
            actor: demoReviewerName,
          ),
        ],
      ),
    );
  }

  /// Returns the start-date field, as in the AGM demo script.
  void demoRequestChanges(String id) {
    const comment = 'Start date must match the AGM minutes (28 Sep 2026).';
    _update(id, (submission) {
      // The demo script returns the start date; fall back to the first change.
      final field =
          submission.changes
              .where((change) => change.field.endsWith('.appointedOn'))
              .firstOrNull
              ?.field ??
          submission.changes.first.field;
      return submission.copyWith(
        status: SubmissionStatus.changesRequested,
        correctionStatus: CorrectionStatus.required,
        updatedAt: now,
        changes: [
          for (final change in submission.changes)
            change.field == field
                ? change.copyWith(correctionStatus: CorrectionStatus.required)
                : change,
        ],
        reviews: [
          ...submission.reviews,
          ReviewRecord(
            id: 'rev-${submission.reviews.length + 1}',
            reviewerUserId: 'user-demo-dm',
            reviewerDisplayName: demoReviewerName,
            decision: ReviewDecision.changesRequested,
            comment: comment,
            field: field,
            decidedAt: now,
          ),
        ],
        timeline: [
          ...submission.timeline,
          TimelineEvent(
            status: SubmissionStatus.changesRequested,
            title: 'Changes Requested',
            at: now,
            actor: demoReviewerName,
            detail: 'Treasurer start date: $comment',
          ),
        ],
      );
    });
  }

  void demoApprove(String id) {
    const comment = 'Council update approved. Thank you.';
    final submission = submissionById(id);
    if (submission == null) return;
    _update(
      id,
      (submission) => submission.copyWith(
        status: SubmissionStatus.approved,
        updatedAt: now,
        reviews: [
          ...submission.reviews,
          ReviewRecord(
            id: 'rev-${submission.reviews.length + 1}',
            reviewerUserId: 'user-demo-dm',
            reviewerDisplayName: demoReviewerName,
            decision: ReviewDecision.approved,
            comment: comment,
            decidedAt: now,
          ),
        ],
        timeline: [
          ...submission.timeline,
          TimelineEvent(
            status: SubmissionStatus.approved,
            title: 'Approved',
            at: now,
            actor: demoReviewerName,
            detail: comment,
          ),
        ],
      ),
    );
    _applyApprovedReplacement();
  }

  // ----- Officer's correction loop -----

  void correctField(String id, String field, String value) {
    _update(
      id,
      (submission) => submission.copyWith(
        updatedAt: now,
        changes: [
          for (final change in submission.changes)
            change.field == field
                ? change.copyWith(
                    correctionStatus: CorrectionStatus.corrected,
                    correctedValue: value,
                  )
                : change,
        ],
      ),
    );
  }

  Future<void> resubmit(String id) async {
    await Future<void>.delayed(loadDelay);
    if (offline) throw const OfflineException();
    _update(
      id,
      (submission) => submission.copyWith(
        status: SubmissionStatus.resubmitted,
        correctionStatus: CorrectionStatus.corrected,
        updatedAt: now,
        timeline: [
          ...submission.timeline,
          TimelineEvent(
            status: SubmissionStatus.resubmitted,
            title: 'Resubmitted',
            at: now,
            detail:
                'Corrected: ${submission.changes.where((c) => c.correctionStatus == CorrectionStatus.required || c.correctedValue != null).map((c) => '${c.label} ${c.previousValue ?? ''} → ${c.currentValue}').join(', ')}',
          ),
        ],
      ),
    );
  }

  void _applyApprovedReplacement() {
    final draft = _draft;
    if (draft == null) return;
    final index = _council.indexWhere((member) => member.id == draft.memberId);
    if (index < 0) return;
    final outgoing = _council[index];
    final submission = councilSubmission;
    final startChange = submission?.changes.where(
      (change) => change.field.endsWith('.appointedOn'),
    );
    final correctedStart = startChange != null && startChange.isNotEmpty
        ? startChange.first.correctedValue
        : null;
    final startDate = correctedStart != null
        ? _parseDisplayDate(correctedStart) ?? draft.startDate
        : draft.startDate;
    _councilHistory.add(
      CommitteeMember(
        id: outgoing.id,
        fullName: outgoing.fullName,
        position: outgoing.position,
        seatType: outgoing.seatType,
        phone: outgoing.phone,
        appointedOn: outgoing.appointedOn,
        endedOn: startDate,
        isActive: false,
      ),
    );
    _council[index] = CommitteeMember(
      id: '${outgoing.id}-new',
      fullName: draft.fullName,
      position: outgoing.position,
      seatType: draft.seatType,
      phone: draft.phone,
      age: draft.age,
      appointedOn: startDate,
      isActive: true,
      isPrimaryContact: outgoing.isPrimaryContact,
    );
    _draft = null;
  }

  void _update(
    String id,
    SocietySubmission Function(SocietySubmission) change,
  ) {
    final index = _submissions.indexWhere((submission) => submission.id == id);
    if (index < 0) return;
    _submissions[index] = change(_submissions[index]);
    notifyListeners();
  }

  static DateTime? _parseDisplayDate(String value) {
    const months = [
      'Jan',
      'Feb',
      'Mar',
      'Apr',
      'May',
      'Jun',
      'Jul',
      'Aug',
      'Sep',
      'Oct',
      'Nov',
      'Dec',
    ];
    final parts = value.split(' ');
    if (parts.length != 3) return null;
    final day = int.tryParse(parts[0]);
    final month = months.indexOf(parts[1]) + 1;
    final year = int.tryParse(parts[2]);
    if (day == null || month == 0 || year == null) return null;
    return DateTime(year, month, day);
  }
}

/// Makes the [DemoStore] available to every screen.
class DemoScope extends InheritedNotifier<DemoStore> {
  const DemoScope({super.key, required DemoStore store, required super.child})
    : super(notifier: store);

  static DemoStore of(BuildContext context) {
    final scope = context.dependOnInheritedWidgetOfExactType<DemoScope>();
    assert(scope != null, 'DemoScope not found above this widget.');
    return scope!.notifier!;
  }

  /// Reads the store without rebuilding when it changes (for callbacks).
  static DemoStore read(BuildContext context) {
    final scope = context.getInheritedWidgetOfExactType<DemoScope>();
    assert(scope != null, 'DemoScope not found above this widget.');
    return scope!.notifier!;
  }
}
