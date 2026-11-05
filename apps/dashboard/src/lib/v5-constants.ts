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
  { number: 1, title: "No Poverty" },
  { number: 2, title: "Zero Hunger" },
  { number: 3, title: "Good Health and Well-Being" },
  { number: 4, title: "Quality Education" },
  { number: 5, title: "Gender Equality" },
  { number: 6, title: "Clean Water and Sanitation" },
  { number: 7, title: "Affordable and Clean Energy" },
  { number: 8, title: "Decent Work and Economic Growth" },
  { number: 9, title: "Industry, Innovation and Infrastructure" },
  { number: 10, title: "Reduced Inequalities" },
  { number: 11, title: "Sustainable Cities and Communities" },
  { number: 12, title: "Responsible Consumption and Production" },
  { number: 13, title: "Climate Action" },
  { number: 14, title: "Life Below Water" },
  { number: 15, title: "Life on Land" },
  { number: 16, title: "Peace, Justice and Strong Institutions" },
  { number: 17, title: "Partnerships for the Goals" },
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
