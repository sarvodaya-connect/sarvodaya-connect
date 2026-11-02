import type {
  ActivityDimension,
  RegistrarDocumentType,
} from "@sarvodaya-connect/api-contracts";

/**
 * Values mirrored from packages/api-contracts/src/activities.ts. The
 * dashboard imports only types from that package, so these lists are kept
 * here too; keep them in step with the contracts and the API.
 */
export const UN_SDGS = [
  { number: 1, title: "No poverty" },
  { number: 2, title: "Zero hunger" },
  { number: 3, title: "Good health and well-being" },
  { number: 4, title: "Quality education" },
  { number: 5, title: "Gender equality" },
  { number: 6, title: "Clean water and sanitation" },
  { number: 7, title: "Affordable and clean energy" },
  { number: 8, title: "Decent work and economic growth" },
  { number: 9, title: "Industry, innovation and infrastructure" },
  { number: 10, title: "Reduced inequalities" },
  { number: 11, title: "Sustainable cities and communities" },
  { number: 12, title: "Responsible consumption and production" },
  { number: 13, title: "Climate action" },
  { number: 14, title: "Life below water" },
  { number: 15, title: "Life on land" },
  { number: 16, title: "Peace, justice and strong institutions" },
  { number: 17, title: "Partnerships for the goals" },
] as const;

export const REGISTRAR_DOCUMENT_TYPES: readonly RegistrarDocumentType[] = [
  "AUDIT_REPORT",
  "AGM_MINUTES",
  "OFFICE_BEARER_LIST",
  "MEMBERS_LIST",
];

export const ACTIVITY_DIMENSIONS: readonly ActivityDimension[] = ["SOCIAL", "ECONOMIC", "GOVERNANCE"];

export const SARVODAYA_SECTORS = [
  "Community education",
  "Child wellbeing",
  "Culture",
  "Economy",
  "Governance",
  "Health and nutrition",
  "Housing and infrastructure",
  "Spiritual development",
  "Agriculture",
  "Environment",
] as const;
