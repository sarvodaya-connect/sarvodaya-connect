import type { IconName } from "@/components/dashboard/icon";

/** V5 D40 "Try asking" and "Example questions". */
export const SARVOAI_EXAMPLES: { icon: IconName; title: string; question: string; tone: string }[] = [
  { icon: "document", title: "Brief me on a society", question: "Give me an overview of a society for the latest completed financial year. Help me choose the society.", tone: "bg-[#e5eef8] text-[#315d88]" },
  { icon: "document", title: "Find missing annual documents", question: "Which societies are missing Registrar uploads for FY 2025/26?", tone: "bg-[#fff5d9] text-[#7a5a00]" },
  { icon: "chart", title: "What should HQ follow up on?", question: "What outstanding work should HQ follow up on today?", tone: "bg-[#e6f0e7] text-[#26744b]" },
  { icon: "user", title: "Who is the president of a society?", question: "Who is the president of Pahala Kosgama SSS?", tone: "bg-[#e5eef8] text-[#315d88]" },
  { icon: "chart", title: "Average profit in a district for a year", question: "What was the average profit for societies in Kurunegala in FY 2025/26?", tone: "bg-[#e6f0e7] text-[#26744b]" },
  { icon: "chart", title: "Societies above a profit amount over five years", question: "Which societies had more than LKR 100,000 profit in the last five years?", tone: "bg-[#f1e9f6] text-[#7a3f96]" },
  { icon: "document", title: "Societies that have not submitted their yearly figures", question: "Which societies have not submitted their profit and expense figures for FY 2025/26?", tone: "bg-[#fff5d9] text-[#7a5a00]" },
];

/** V5 D40 "What SarvoAI uses" — the only records the API's tools read. */
export const SARVOAI_USES = [
  "Society profile and status",
  "Exco list from the latest AGM",
  "Total profit for each year",
  "Total expenses for each year",
  "Which yearly figures have been submitted",
  "Registrar upload completeness (not document contents)",
  "Approved activity metadata and recorded follow-up queues",
];

export const SARVOAI_NEVER = "Share capital, savings, loans, assets, cash and bank balances, member NICs, passwords";
