import type {
  DistrictSummary,
  SocietyDetails,
  SocietyStatus,
  SocietySummary,
  SubmissionStatus,
  VerificationStatus,
} from "@sarvodaya-connect/api-contracts";

export const districts = [
  { id: "district-kurunegala", code: "KG", nameEn: "Kurunegala", societyCount: 148 },
  { id: "district-kegalle", code: "KE", nameEn: "Kegalle", societyCount: 126 },
  { id: "district-matale", code: "MT", nameEn: "Matale", societyCount: 84 },
  { id: "district-kandy", code: "KD", nameEn: "Kandy", societyCount: 132 },
] satisfies DistrictSummary[];

const districtById = Object.fromEntries(districts.map((district) => [district.id, district]));

type SocietyFixture = [
  id: string,
  societyCode: string,
  nameEn: string,
  districtId: string,
  status: SocietyStatus,
  verificationStatus: VerificationStatus,
  profileCompleteness: number,
  updatedAt: string,
];

const societyFixtures: SocietyFixture[] = [
  ["society-pahala-kosgama", "SSS-KG-001", "Pahala Kosgama Sarvodaya Shramadana Society", "district-kurunegala", "ACTIVE", "VERIFIED", 86, "2026-11-12T12:30:00.000Z"],
  ["society-kuliyapitiya", "SSS-KG-014", "Kuliyapitiya Sarvodaya Shramadana Society", "district-kurunegala", "ACTIVE", "VERIFIED", 92, "2026-11-10T09:20:00.000Z"],
  ["society-wellawa", "SSS-KG-028", "Wellawa Sarvodaya Shramadana Society", "district-kurunegala", "ACTIVE", "PENDING", 78, "2026-11-09T14:05:00.000Z"],
  ["society-maho", "SSS-KG-033", "Maho Sarvodaya Shramadana Society", "district-kurunegala", "UNDER_REVIEW", "PENDING", 71, "2026-11-08T08:45:00.000Z"],
  ["society-rambukkana", "SSS-KE-021", "Rambukkana Sarvodaya Shramadana Society", "district-kegalle", "ACTIVE", "VERIFIED", 88, "2026-11-07T10:30:00.000Z"],
  ["society-galewela", "SSS-MT-008", "Galewela Sarvodaya Shramadana Society", "district-matale", "ACTIVE", "UNVERIFIED", 64, "2026-11-06T11:15:00.000Z"],
  ["society-kundasale", "SSS-KD-042", "Kundasale Sarvodaya Shramadana Society", "district-kandy", "INACTIVE", "UNVERIFIED", 57, "2026-10-29T06:10:00.000Z"],
];

export const societies: SocietySummary[] = societyFixtures.map(
  ([id, societyCode, nameEn, districtId, status, verificationStatus, profileCompleteness, updatedAt]) => ({
  id,
  societyCode,
  nameEn,
  district: {
    id: districtById[districtId]!.id,
    code: districtById[districtId]!.code,
    nameEn: districtById[districtId]!.nameEn,
  },
  status,
  verificationStatus,
  profileCompleteness,
  updatedAt,
}));

function buildDetails(summary: SocietySummary): SocietyDetails {
  const isFeatured = summary.id === "society-pahala-kosgama";
  return {
    ...summary,
    establishedOn: isFeatured ? "1984-06-01" : "1996-01-15",
    address: {
      addressLine: isFeatured ? "No. 12, Temple Road" : "Community Centre Road",
      village: isFeatured ? "Pahala Kosgama" : summary.nameEn.split(" ")[0],
      gnDivision: isFeatured ? "Kosgama 221A" : "Demonstration GN Division",
      dsDivision: isFeatured ? "Polgahawela" : summary.district.nameEn,
    },
    location: isFeatured ? { latitude: 7.3351, longitude: 80.2847 } : undefined,
    contacts: [
      {
        id: `${summary.id}-contact-1`,
        fullName: "Nimal Perera",
        position: "President",
        phone: "+94 00 000 0001",
        email: "nimal.perera@example.invalid",
        isPrimary: true,
      },
    ],
    committee: [
      { id: "committee-1", fullName: "Nimal Perera", position: "President", phone: "+94 00 000 0001", appointedOn: "2024-06-01", isActive: true },
      { id: "committee-2", fullName: "M. Jayasinghe", position: "Secretary", phone: "+94 00 000 0002", appointedOn: "2024-06-01", isActive: true },
      { id: "committee-3", fullName: "R. Jayasinghe", position: "Treasurer", phone: "+94 00 000 0003", appointedOn: "2026-09-28", isActive: true },
      { id: "committee-4", fullName: "S. Kumari", position: "Vice President", phone: "+94 00 000 0004", appointedOn: "2024-06-01", isActive: true },
      { id: "committee-5", fullName: "A. Hettiarachchi", position: "Committee Member", phone: "+94 00 000 0005", appointedOn: "2024-06-01", isActive: true },
    ],
    documents: [
      { id: "document-1", societyId: summary.id, documentType: "AGM_MINUTES", fileName: "AGM-minutes-2026.pdf", contentType: "application/pdf", sizeBytes: 1480000, status: isFeatured ? "APPROVED" : "SUBMITTED", uploadedBy: "Nimal Perera", uploadedAt: "2026-11-12T05:12:00.000Z" },
      { id: "document-2", societyId: summary.id, documentType: "REGISTRATION", fileName: "registration-certificate.pdf", contentType: "application/pdf", sizeBytes: 860000, status: "APPROVED", uploadedBy: "District Office", uploadedAt: "2024-01-18T08:30:00.000Z" },
    ],
    history: [
      { id: "history-1", eventType: "COMMITTEE_UPDATED", summary: "Treasurer updated from K. Perera to R. Jayasinghe", actorDisplayName: "Nimal Perera", occurredAt: "2026-11-12T06:15:00.000Z" },
      { id: "history-2", eventType: "PROFILE_VERIFIED", summary: "Society profile verified by District Manager", actorDisplayName: "S. Tharmalingam", occurredAt: "2026-11-12T06:46:00.000Z" },
    ],
    createdAt: "2024-01-18T08:00:00.000Z",
  };
}

export const societyDetails = societies.map(buildDetails);

export function getSociety(id: string) {
  return societyDetails.find((society) => society.id === id);
}

export type ReviewQueueItem = {
  id: string;
  reference: string;
  societyId: string;
  societyName: string;
  societyCode: string;
  type: "Committee update" | "Activity report";
  submittedAt: string;
  status: SubmissionStatus;
  waitingLabel: string;
};

export const reviewQueue: ReviewQueueItem[] = [
  { id: "review-1", reference: "SUB-2026-0142", societyId: "society-pahala-kosgama", societyName: "Pahala Kosgama Sarvodaya Shramadana Society", societyCode: "SSS-KG-001", type: "Committee update", submittedAt: "12 Nov 2026, 10:15 a.m.", status: "SUBMITTED", waitingLabel: "42 min" },
  { id: "review-2", reference: "SUB-2026-0141", societyId: "society-pahala-kosgama", societyName: "Pahala Kosgama Sarvodaya Shramadana Society", societyCode: "SSS-KG-001", type: "Activity report", submittedAt: "12 Nov 2026, 9:48 a.m.", status: "SUBMITTED", waitingLabel: "1 hr 9 min" },
];
