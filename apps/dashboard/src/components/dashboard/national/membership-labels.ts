/** Membership categories as the API stores them (To Confirm against V5, see the PR). */
export const MEMBERSHIP_LABELS: Record<string, string> = {
  CHILDREN: "Child Members",
  YOUTH: "Youth Members",
  MOTHERS: "Mothers",
  ORDINARY: "Ordinary Members",
  ELDERS_COUNCIL: "Elders’ Council",
};

/** "Counts only, no personal data · 1,018 of 1,076 societies reported for 2026". */
export function membershipNote(year: number | null, reported: number, active: number) {
  if (year === null) return "Counts only, no personal data · no society has entered membership counts yet";
  return `Counts only, no personal data · ${reported.toLocaleString("en-GB")} of ${active.toLocaleString("en-GB")} active societies reported for ${year} · ${Math.max(0, active - reported).toLocaleString("en-GB")} not submitted`;
}
