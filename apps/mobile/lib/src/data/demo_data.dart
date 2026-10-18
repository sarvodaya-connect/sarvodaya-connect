// Fictional demonstration data based on Screen Catalogue v3.
// No real people, phone numbers, accounts or society records are used:
// phone numbers use the agreed +94 00 000 000x placeholders and emails use example.invalid.

import '../models/audit.dart';
import '../models/committee.dart';
import '../models/document.dart';
import '../models/membership.dart';
import '../models/notification.dart';
import '../models/society.dart';
import '../models/submission.dart';
import '../models/user.dart';

class DemoAccount {
  const DemoAccount._();

  /// Fictional account. Production sign-in will use Amazon Cognito.
  static const username = 'nimali.officer@example.invalid';
  static const password = 'demo-only';
}

const demoDistrict = DistrictRef(
  id: 'district-kurunegala',
  code: 'KG',
  nameEn: 'Kurunegala',
);

const demoAnuradhapuraDistrict = DistrictRef(
  id: 'district-anuradhapura',
  code: 'AD',
  nameEn: 'Anuradhapura',
);

const demoReviewerName = 'R. Fernando';
const demoReviewerOffice = 'Kurunegala District Centre';

const demoOfficer = AuthenticatedUser(
  id: 'user-demo-officer',
  displayName: 'Nimali Wijesinghe',
  email: DemoAccount.username,
  roles: [UserRole.societyOfficer],
  societyIds: ['society-pahala-kosgama'],
);

const demoDistrictManager = AuthenticatedUser(
  id: 'user-demo-district-manager',
  displayName: 'R. Fernando',
  email: 'district.manager@example.invalid',
  roles: [UserRole.districtManager],
  districtIds: ['district-kurunegala'],
  societyIds: [],
);

const demoHqAdmin = AuthenticatedUser(
  id: 'user-demo-hq-admin',
  displayName: 'S. Perera',
  email: 'hq.admin@example.invalid',
  roles: [UserRole.hqAdmin],
  districtIds: [],
  societyIds: [],
);

final demoSociety = SocietyDetails(
  id: 'society-pahala-kosgama',
  societyCode: 'SSS-104233',
  nameEn: 'Pahala Kosgama SSS',
  nameLocal: 'පහළ කොස්ගම සර්වෝදය සමිතිය',
  district: demoDistrict,
  status: SocietyStatus.active,
  verificationStatus: VerificationStatus.verified,
  profileCompleteness: 86,
  updatedAt: DateTime(2026, 10, 2, 9, 30),
  registrationNumber: 'DEMO/KG/1979/042',
  establishedOn: DateTime(1979, 6, 1),
  address: const SocietyAddress(
    addressLine: 'No. 12, Temple Road',
    village: 'Pahala Kosgama',
    gnDivision: 'Kosgama 1056',
    dsDivision: 'Kuliyapitiya East',
  ),
  location: const GeoLocation(latitude: 7.4672, longitude: 80.0412),
  contacts: const [
    SocietyContact(
      id: 'contact-society',
      label: 'Society phone',
      phone: '+94 00 000 0010',
      isPrimary: false,
    ),
    SocietyContact(
      id: 'contact-secretary',
      fullName: 'N. Wijesinghe',
      position: 'Secretary',
      phone: '+94 00 000 0002',
      isPrimary: true,
    ),
  ],
  lastVerifiedOn: DateTime(2026, 10, 2),
  lastVerifiedBy: demoReviewerName,
);

/// Directory records used by the role-filtered M20 My Societies screen.
final demoSocieties = <SocietyDetails>[
  demoSociety,
  SocietyDetails(
    id: 'society-mawathagama',
    societyCode: 'SSS-104287',
    nameEn: 'Mawathagama SSS',
    district: demoDistrict,
    status: SocietyStatus.active,
    verificationStatus: VerificationStatus.verified,
    profileCompleteness: 72,
    updatedAt: DateTime(2026, 10, 1),
    registrationNumber: 'DEMO/KG/1984/018',
    address: const SocietyAddress(
      addressLine: 'No. 4, Station Road',
      village: 'Mawathagama',
      gnDivision: 'Mawathagama 1020',
      dsDivision: 'Mawathagama',
    ),
    contacts: const [],
  ),
  SocietyDetails(
    id: 'society-wariyapola',
    societyCode: 'SSS-105012',
    nameEn: 'Wariyapola SSS',
    district: demoAnuradhapuraDistrict,
    status: SocietyStatus.active,
    verificationStatus: VerificationStatus.verified,
    profileCompleteness: 94,
    updatedAt: DateTime(2026, 10, 3),
    registrationNumber: 'DEMO/AD/1981/076',
    address: const SocietyAddress(
      addressLine: 'No. 8, Temple Street',
      village: 'Wariyapola',
      gnDivision: 'Wariyapola 1012',
      dsDivision: 'Wariyapola',
    ),
    contacts: const [],
  ),
];

/// Sections counted for profile completeness. Society email is deliberately missing in the demo.
const demoCompletedSections = [
  'Registration',
  'Address',
  'GPS location',
  'Executive Council',
  'Office bearers',
  'Society phone',
];
const demoMissingSections = ['Society email'];

CommitteeMember _member(
  String id,
  String name,
  String position,
  CouncilSeatType seat,
  int phoneSuffix, {
  int? age,
  bool primary = false,
  DateTime? appointedOn,
  String? email,
}) {
  return CommitteeMember(
    id: id,
    fullName: name,
    position: position,
    seatType: seat,
    phone: '+94 00 000 ${phoneSuffix.toString().padLeft(4, '0')}',
    email: email ?? '$id@example.invalid',
    age: age,
    appointedOn: appointedOn ?? DateTime(2024, 6, 1),
    isActive: true,
    isPrimaryContact: primary,
  );
}

/// All 25 seats filled: Children 3/3, Youth 3/3, Mothers 3/3, Ordinary 9/9, Elders 7/7.
final demoCouncil = <CommitteeMember>[
  _member(
    'cm-president',
    'A. Jayasekara',
    'President',
    CouncilSeatType.ordinary,
    1,
  ),
  _member(
    'cm-secretary',
    'N. Wijesinghe',
    'Secretary',
    CouncilSeatType.mother,
    2,
    primary: true,
  ),
  _member(
    'cm-treasurer',
    'K. Perera',
    'Treasurer',
    CouncilSeatType.ordinary,
    3,
  ),
  _member(
    'cm-child-1',
    'T. Senanayake',
    'Executive member',
    CouncilSeatType.child,
    11,
    age: 13,
  ),
  _member(
    'cm-child-2',
    'M. Dissanayake',
    'Executive member',
    CouncilSeatType.child,
    12,
    age: 11,
  ),
  _member(
    'cm-child-3',
    'S. Kumara',
    'Executive member',
    CouncilSeatType.child,
    13,
    age: 9,
  ),
  _member(
    'cm-youth-1',
    'R. Kumari',
    'Executive member',
    CouncilSeatType.youth,
    14,
    age: 19,
  ),
  _member(
    'cm-youth-2',
    'H. Silva',
    'Executive member',
    CouncilSeatType.youth,
    15,
    age: 23,
  ),
  _member(
    'cm-youth-3',
    'D. Fernando',
    'Executive member',
    CouncilSeatType.youth,
    25,
    age: 21,
  ),
  _member(
    'cm-mother-1',
    'P. Herath',
    'Executive member',
    CouncilSeatType.mother,
    16,
  ),
  _member(
    'cm-mother-2',
    'D. Gunawardena',
    'Executive member',
    CouncilSeatType.mother,
    17,
  ),
  _member(
    'cm-ordinary-1',
    'W. Bandara',
    'Executive member',
    CouncilSeatType.ordinary,
    18,
  ),
  _member(
    'cm-ordinary-2',
    'S. Ekanayake',
    'Executive member',
    CouncilSeatType.ordinary,
    19,
  ),
  _member(
    'cm-ordinary-3',
    'M. Karunaratne',
    'Executive member',
    CouncilSeatType.ordinary,
    20,
  ),
  _member(
    'cm-ordinary-4',
    'J. Abeysinghe',
    'Executive member',
    CouncilSeatType.ordinary,
    21,
  ),
  _member(
    'cm-ordinary-5',
    'R. Samarasinghe',
    'Executive member',
    CouncilSeatType.ordinary,
    22,
  ),
  _member(
    'cm-ordinary-6',
    'K. Wijeratne',
    'Executive member',
    CouncilSeatType.ordinary,
    23,
  ),
  _member(
    'cm-ordinary-7',
    'U. Weerasinghe',
    'Executive member',
    CouncilSeatType.ordinary,
    24,
  ),
  _member(
    'cm-elder-1',
    'H. Pathirana',
    'Elders Council',
    CouncilSeatType.elder,
    31,
  ),
  _member(
    'cm-elder-2',
    'D. Amarasinghe',
    'Elders Council',
    CouncilSeatType.elder,
    32,
  ),
  _member(
    'cm-elder-3',
    'G. Mendis',
    'Elders Council',
    CouncilSeatType.elder,
    33,
  ),
  _member(
    'cm-elder-4',
    'L. Fonseka',
    'Elders Council',
    CouncilSeatType.elder,
    34,
  ),
  _member(
    'cm-elder-5',
    'S. Tennakoon',
    'Elders Council',
    CouncilSeatType.elder,
    35,
  ),
  _member(
    'cm-elder-6',
    'A. Liyanage',
    'Elders Council',
    CouncilSeatType.elder,
    36,
  ),
  _member(
    'cm-elder-7',
    'P. Senanayake',
    'Elders Council',
    CouncilSeatType.elder,
    37,
  ),
];

/// Fictional member counts for the approved 2026 membership snapshot.
const demoMembership = MembershipSummary(
  year: 2026,
  categories: [
    MembershipCategoryCounts(category: 'Children', female: 178, male: 164),
    MembershipCategoryCounts(category: 'Youth', female: 246, male: 219),
    MembershipCategoryCounts(category: 'Mothers', female: 526, male: 0),
    MembershipCategoryCounts(category: 'Ordinary', female: 1485, male: 1328),
    MembershipCategoryCounts(category: 'Elders Council', female: 82, male: 65),
  ],
);

final demoDocuments = <SocietyDocument>[
  SocietyDocument(
    id: 'doc-office-bearers-2026',
    societyId: 'society-pahala-kosgama',
    documentType: DocumentType.officeBearerList,
    fileName: 'Office-bearer list 2026.pdf',
    contentType: 'application/pdf',
    sizeBytes: 420000,
    status: DocumentStatus.approved,
    uploadedBy: 'N. Wijesinghe',
    uploadedAt: DateTime(2026, 3, 20),
  ),
  SocietyDocument(
    id: 'doc-members-2026',
    societyId: 'society-pahala-kosgama',
    documentType: DocumentType.membersList,
    fileName: 'Members list 2026 (signed).pdf',
    contentType: 'application/pdf',
    sizeBytes: 960000,
    status: DocumentStatus.approved,
    uploadedBy: 'N. Wijesinghe',
    uploadedAt: DateTime(2026, 3, 20),
    restrictedToReviewers: true,
  ),
  SocietyDocument(
    id: 'doc-audit-2024',
    societyId: 'society-pahala-kosgama',
    documentType: DocumentType.auditReport,
    fileName: 'Audit report FY 2024-25.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1800000,
    status: DocumentStatus.approved,
    uploadedBy: 'N. Wijesinghe',
    uploadedAt: DateTime(2025, 9, 28),
  ),
];

/// Files offered by the demonstration file chooser. Two are invalid on purpose,
/// so the upload size and type errors can be shown.
class DemoFile {
  const DemoFile({
    required this.name,
    required this.contentType,
    required this.sizeBytes,
    required this.description,
  });

  final String name;
  final String contentType;
  final int sizeBytes;
  final String description;
}

const demoFiles = [
  DemoFile(
    name: 'AGM minutes 2026-09-28.pdf',
    contentType: 'application/pdf',
    sizeBytes: 1400000,
    description: 'PDF · 2 pages',
  ),
  DemoFile(
    name: 'AGM minutes photo.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 14000000,
    description: 'Photo · too large for the demo limit',
  ),
  DemoFile(
    name: 'AGM minutes draft.docx',
    contentType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    sizeBytes: 220000,
    description: 'Word document · type not accepted',
  ),
  DemoFile(
    name: 'Audit report FY 2025-26 (signed).pdf',
    contentType: 'application/pdf',
    sizeBytes: 2100000,
    description: 'PDF · 6 pages · signed by the auditor',
  ),
];

// ----- Annual audit (M12) -----

/// FY 2025/26 ends on 31 March 2026; the signed report is due by 30 September.
final demoAuditYearEnd = DateTime(2026, 3, 31);
final demoAuditDueOn = DateTime(2026, 9, 30);

/// Required steps for FY 2025/26 that are already complete. The report steps
/// are worked out from the document library (see DemoStore.currentAudit).
final demoAuditCompletedSteps = <AuditChecklistItem>[
  AuditChecklistItem(
    id: 'audit-2026-accounts',
    title: 'Accounts closed for the year',
    description: 'Cash book and bank book balanced on 31 Mar 2026',
    status: AuditItemStatus.complete,
    completedOn: DateTime(2026, 4, 5),
  ),
  AuditChecklistItem(
    id: 'audit-2026-auditor',
    title: 'Auditor appointed',
    description: 'Approved at the committee meeting',
    status: AuditItemStatus.complete,
    completedOn: DateTime(2026, 4, 12),
  ),
  AuditChecklistItem(
    id: 'audit-2026-records',
    title: 'Records given to the auditor',
    description: 'Cash book, receipts, bank statements and asset register',
    status: AuditItemStatus.complete,
    completedOn: DateTime(2026, 6, 18),
  ),
];

/// Last year's audit, already approved by the District Centre.
final demoPreviousAudit = AnnualAudit(
  id: 'audit-fy-2024-25',
  financialYear: 'FY 2024/25',
  dueOn: DateTime(2025, 9, 30),
  status: AuditStatus.approved,
  reportDocumentId: 'doc-audit-2024',
  reviewedBy: demoReviewerName,
  reviewedOn: DateTime(2025, 10, 6),
  reviewerComment: 'Clear and complete. Keep receipts with the cash book.',
  items: [
    for (final (id, title) in [
      ('accounts', 'Accounts closed for the year'),
      ('auditor', 'Auditor appointed'),
      ('records', 'Records given to the auditor'),
      ('signed', 'Audit report signed by the auditor'),
      ('uploaded', 'Audit report uploaded'),
      ('district', 'Checked by the District Centre'),
    ])
      AuditChecklistItem(
        id: 'audit-2025-$id',
        title: title,
        description: 'Completed',
        status: AuditItemStatus.complete,
      ),
  ],
);

// ----- Notifications (M16) -----

/// Fictional notifications. The newest ones are dated relative to [now] so
/// the "Today" group is never empty during a demonstration.
List<AppNotification> demoNotifications(DateTime now) => [
  AppNotification(
    id: 'note-registrar-request',
    kind: NotificationKind.request,
    title: 'HQ asked for the 4 Registrar documents',
    message: 'Upload the audit report, AGM minutes, office-bearer list and signed members list for FY 2025/26.',
    receivedAt: now.subtract(const Duration(minutes: 45)),
    target: NotificationTarget.documents,
  ),
  AppNotification(
    id: 'note-audit-overdue',
    kind: NotificationKind.reminder,
    title: 'Audit report FY 2025/26 is overdue',
    message:
        'It was due on 30 Sep 2026. Upload it as soon as the auditor signs it.',
    receivedAt: now.subtract(const Duration(hours: 2)),
    target: NotificationTarget.audit,
  ),
  AppNotification(
    id: 'note-review-tank',
    kind: NotificationKind.review,
    title: 'Tank cleaning shramadana is under review',
    message: '$demoReviewerName started reviewing your activity report.',
    receivedAt: now.subtract(const Duration(hours: 3)),
    target: NotificationTarget.submission,
    targetId: 'sub-activity-tank',
  ),
  AppNotification(
    id: 'note-district-meeting',
    kind: NotificationKind.notice,
    title: 'District society meeting on 25 Oct 2026',
    message:
        '$demoReviewerOffice, 10:00. Bring a copy of your latest AGM minutes.',
    receivedAt: now.subtract(const Duration(days: 3)),
  ),
  AppNotification(
    id: 'note-location-verified',
    kind: NotificationKind.approved,
    title: 'Society location verified',
    message: '$demoReviewerName checked the society GPS location.',
    receivedAt: DateTime(2026, 10, 2, 9, 30),
    read: true,
    target: NotificationTarget.societyProfile,
  ),
  AppNotification(
    id: 'note-membership-q2',
    kind: NotificationKind.approved,
    title: 'Membership Apr–Jun approved',
    message: 'Counts match the register. Thank you.',
    receivedAt: DateTime(2026, 7, 2, 14, 10),
    read: true,
    target: NotificationTarget.submission,
    targetId: 'sub-membership-q2',
  ),
];

/// Earlier submissions so the tracker has realistic history.
final demoSubmissionHistory = <SocietySubmission>[
  SocietySubmission(
    id: 'sub-membership-q3',
    reference: 'SUB-2026-0139',
    societyId: 'society-pahala-kosgama',
    type: SubmissionType.membershipCounts,
    title: 'Membership Jul–Sep',
    submittedBy: 'Nimali Wijesinghe',
    status: SubmissionStatus.submitted,
    submittedAt: DateTime(2026, 10, 9, 16, 20),
    updatedAt: DateTime(2026, 10, 9, 16, 20),
    timeline: [
      TimelineEvent(
        status: SubmissionStatus.draft,
        title: 'Draft started',
        at: DateTime(2026, 10, 9, 15, 50),
      ),
      TimelineEvent(
        status: SubmissionStatus.submitted,
        title: 'Submitted to District Manager',
        at: DateTime(2026, 10, 9, 16, 20),
      ),
    ],
  ),
  SocietySubmission(
    id: 'sub-activity-tank',
    reference: 'SUB-2026-0131',
    societyId: 'society-pahala-kosgama',
    type: SubmissionType.activityReport,
    title: 'Tank cleaning shramadana',
    submittedBy: 'Nimali Wijesinghe',
    status: SubmissionStatus.underReview,
    submittedAt: DateTime(2026, 10, 6, 11, 5),
    updatedAt: DateTime(2026, 10, 7, 9, 0),
    reviewStartedAt: DateTime(2026, 10, 7, 9, 0),
    reviewerDisplayName: demoReviewerName,
    timeline: [
      TimelineEvent(
        status: SubmissionStatus.draft,
        title: 'Draft started',
        at: DateTime(2026, 10, 6, 10, 30),
      ),
      TimelineEvent(
        status: SubmissionStatus.submitted,
        title: 'Submitted to District Manager',
        at: DateTime(2026, 10, 6, 11, 5),
      ),
      TimelineEvent(
        status: SubmissionStatus.underReview,
        title: 'Under Review',
        at: DateTime(2026, 10, 7, 9, 0),
        actor: demoReviewerName,
      ),
    ],
  ),
  SocietySubmission(
    id: 'sub-payment',
    reference: 'SUB-2026-0128',
    societyId: 'society-pahala-kosgama',
    type: SubmissionType.payment,
    title: 'Payment LKR 12,500.00',
    submittedBy: 'Nimali Wijesinghe',
    status: SubmissionStatus.draft,
    updatedAt: DateTime(2026, 10, 5, 18, 40),
    timeline: [
      TimelineEvent(
        status: SubmissionStatus.draft,
        title: 'Draft started',
        at: DateTime(2026, 10, 5, 18, 40),
        detail: 'Saved on this phone, waiting for internet',
      ),
    ],
  ),
  SocietySubmission(
    id: 'sub-membership-q2',
    reference: 'SUB-2026-0102',
    societyId: 'society-pahala-kosgama',
    type: SubmissionType.membershipCounts,
    title: 'Membership Apr–Jun',
    submittedBy: 'Nimali Wijesinghe',
    status: SubmissionStatus.approved,
    submittedAt: DateTime(2026, 7, 1, 10, 0),
    updatedAt: DateTime(2026, 7, 2, 14, 10),
    reviews: [
      ReviewRecord(
        id: 'rev-q2',
        reviewerUserId: 'user-demo-dm',
        reviewerDisplayName: demoReviewerName,
        decision: ReviewDecision.approved,
        comment: 'Counts match the register. Thank you.',
        decidedAt: DateTime(2026, 7, 2, 14, 10),
      ),
    ],
    timeline: [
      TimelineEvent(
        status: SubmissionStatus.submitted,
        title: 'Submitted to District Manager',
        at: DateTime(2026, 7, 1, 10, 0),
      ),
      TimelineEvent(
        status: SubmissionStatus.approved,
        title: 'Approved',
        at: DateTime(2026, 7, 2, 14, 10),
        actor: demoReviewerName,
        detail: 'Counts match the register. Thank you.',
      ),
    ],
  ),
];
