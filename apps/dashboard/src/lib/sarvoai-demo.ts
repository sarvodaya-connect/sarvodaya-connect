import type { AssistantAnswer } from "@sarvodaya-connect/api-contracts";

/**
 * Demonstration mode only: fictional SarvoAI answers to the V5 example
 * questions, so every state can be shown without Amazon Bedrock. The page
 * labels them "Sample data". With demonstration mode off, every question goes
 * to the API (POST /assistant/questions).
 */
const asOf = () => new Date().toISOString();

const KURUNEGALA = {
  financialYears: ["FY 2025/26"],
  district: "Kurunegala",
  currency: "LKR" as const,
  societiesIncluded: 88,
  societiesExcluded: 10,
  excludedReason: "figures not added",
};

const PROFIT_ROWS: [string, string, number, number][] = [
  ["Pahala Kosgama SSS", "Kuliyapitiya East", 612400, 1884000],
  ["Giriulla SSS", "Narammala", 544900, 1402300],
  ["Nikaweratiya SSS", "Nikaweratiya", 498250, 1655700],
  ["Wariyapola North SSS", "Wariyapola", 471800, 1190400],
  ["Maho Ihala SSS", "Maho", 455100, 1322900],
  ["Polgahawela SSS", "Polgahawela", -38600, 962100],
];

export function demoAnswer(question: string, history: { role: string; text: string }[] = []): AssistantAnswer {
  const q = question.toLowerCase();
  const earlier = history.map((turn) => turn.text.toLowerCase()).join(" ");

  if (/share capital|savings|loan|asset|cash|bank/.test(q)) {
    return {
      kind: "UNSUPPORTED",
      summary:
        "Sarvodaya Connect records only each society’s total profit and total expenses for the year. Share capital, savings, loans, assets and cash balances are not recorded, so there is nothing to answer from.",
      options: ["Average profit in Kurunegala, FY 2025/26", "Total expenses in Kurunegala, FY 2025/26"],
      details: { recordsUsed: [] },
      dataAsOf: asOf(),
    };
  }
  if (/\bbest\b/.test(q)) {
    return {
      kind: "CLARIFY",
      summary: "What do you mean by “best”? Pick one, or rewrite the question with a year and a district.",
      options: ["Highest total profit in FY 2025/26", "Class A societies", "Profit above LKR 100,000 for five years"],
      details: { recordsUsed: [] },
      dataAsOf: asOf(),
    };
  }
  if (q.includes("president")) {
    return {
      kind: "ANSWER",
      summary: "The president of Pahala Kosgama SSS is A. Jayasekara.",
      options: [],
      table: { columns: ["Society", "Position", "Name", "Appointed"], rows: [["Pahala Kosgama SSS", "President", "A. Jayasekara", "14 Jun 2026"]], totalRows: 1 },
      details: { recordsUsed: ["Exco list · Pahala Kosgama SSS (S-104233)", "Society profile · Kurunegala, Kuliyapitiya East DS"], calculation: "Direct lookup of the President on the current Exco. Contact details and NICs are not shown." },
      dataAsOf: asOf(),
    };
  }
  if (q.includes("mannar")) {
    return {
      kind: "NO_MATCH",
      summary: "None of the 15 Mannar societies with FY 2025/26 figures had a total profit above LKR 1,000,000. One society has not added its figure.",
      options: ["More than LKR 250,000", "All districts", "Change the year"],
      scope: { financialYears: ["FY 2025/26"], district: "Mannar", currency: "LKR", societiesIncluded: 15, societiesExcluded: 1, excludedReason: "not added" },
      details: { recordsUsed: ["Annual summary · total profit for the year, FY 2025/26 · Mannar"] },
      dataAsOf: asOf(),
    };
  }
  if (q.includes("mullaitivu")) {
    return {
      kind: "INCOMPLETE",
      summary:
        "Only 6 of 17 societies have added their figures. That is too few for a reliable district average, so SarvoAI is not giving one. The 6 societies that did submit averaged LKR 142,300 — this is not the district average.",
      options: ["See the 11 not added", "Ask about FY 2024/25 instead"],
      scope: { financialYears: ["FY 2025/26"], district: "Mullaitivu", currency: "LKR", societiesIncluded: 6, societiesExcluded: 11, excludedReason: "not added" },
      details: { recordsUsed: ["Annual summary · total profit for the year, FY 2025/26 · Mullaitivu"] },
      dataAsOf: asOf(),
    };
  }
  if (q.includes("highest") && earlier.includes("average profit")) {
    return {
      kind: "ANSWER",
      summary: "Pahala Kosgama SSS had the highest total profit: LKR 612,400.",
      options: [],
      scope: KURUNEGALA,
      table: { columns: ["Society", "DS division", "Total profit FY 2025/26 (LKR)"], rows: PROFIT_ROWS.slice(0, 5).map(([name, ds, profit]) => [name, ds, profit]), totalRows: 88 },
      details: { recordsUsed: ["Annual summary · total profit for the year, FY 2025/26 · the same 88 Kurunegala societies"], calculation: "Societies ordered by total profit for FY 2025/26, highest first." },
      dataAsOf: asOf(),
    };
  }
  if (q.includes("average")) {
    return {
      kind: "ANSWER",
      summary: "The average total profit for the year was LKR 298,400 per society across 88 Kurunegala societies in FY 2025/26.",
      options: [],
      scope: KURUNEGALA,
      table: { columns: ["Society", "DS division", "Total profit FY 2025/26 (LKR)", "Total expenses FY 2025/26 (LKR)"], rows: PROFIT_ROWS, totalRows: 88 },
      details: {
        recordsUsed: ["Annual summary · total profit for the year, entered by the Society Officer or SPC", "Society profile · district and status (98 active in Kurunegala)"],
        calculation: "LKR 26,259,200 combined profit ÷ 88 societies = LKR 298,400. Rounded to the nearest LKR 100. A society with a loss counts as a negative profit.",
      },
      dataAsOf: asOf(),
    };
  }
  if (/more than lkr 100,000|above lkr 100,000|100,000 profit/.test(q)) {
    if (!/each of the five years|in each|every year/.test(q + " " + earlier)) {
      return {
        kind: "CLARIFY",
        summary: "Before I answer — which do you mean? “More than LKR 100,000 profit in the last five years” can be read in three ways.",
        options: ["More than LKR 100,000 in each of the five years", "More than LKR 100,000 in at least one of the five years", "More than LKR 100,000 combined over the five years"],
        details: { recordsUsed: [] },
        dataAsOf: asOf(),
      };
    }
    return {
      kind: "ANSWER",
      summary: "187 societies had a total profit above LKR 100,000 in each of the five years from FY 2021/22 to FY 2025/26.",
      options: [],
      scope: { financialYears: ["FY 2021/22", "FY 2022/23", "FY 2023/24", "FY 2024/25", "FY 2025/26"], currency: "LKR", societiesIncluded: 862, societiesExcluded: 214, excludedReason: "a year missing" },
      table: {
        columns: ["Society", "District", "FY 21/22", "FY 22/23", "FY 23/24", "FY 24/25", "FY 25/26"],
        rows: [
          ["Pahala Kosgama SSS", "Kurunegala", 402100, 455800, 511300, 580200, 612400],
          ["Haputale SSS", "Badulla", 188400, 204900, 176300, 231000, 249600],
          ["Giriulla SSS", "Kurunegala", 301200, 322000, 398500, 470100, 544900],
        ],
        totalRows: 187,
      },
      details: { recordsUsed: ["Annual summary · total profit for the year, FY 2021/22 to FY 2025/26"], calculation: "Societies above LKR 100,000 in every one of the five years. 214 societies are missing a figure for at least one year, so SarvoAI cannot say whether they qualify; they are not counted." },
      dataAsOf: asOf(),
    };
  }
  if (/not (submitted|added)|missing/.test(q)) {
    return {
      kind: "ANSWER",
      summary: "108 societies have not submitted their total profit and total expenses for FY 2025/26. The due date was 30 Sep 2026.",
      options: [],
      scope: { financialYears: ["FY 2025/26"], societiesIncluded: 1076 },
      table: {
        columns: ["Society", "District", "Missing"],
        rows: [
          ["Mullaitivu Town SSS", "Mullaitivu", "Both figures"],
          ["Hangurankatha SSS", "Nuwara Eliya", "Total expenses"],
          ["Thambuttegama SSS", "Anuradhapura", "Both figures"],
        ],
        totalRows: 108,
      },
      details: { recordsUsed: ["Annual summary status · FY 2025/26 · all 25 districts, 1,076 active societies"] },
      dataAsOf: asOf(),
    };
  }
  return {
    kind: "UNSUPPORTED",
    summary: "This demonstration only answers the example questions. With demonstration mode off, SarvoAI answers from the society records.",
    options: ["Who is the president of Pahala Kosgama SSS?", "What was the average profit for societies in Kurunegala in FY 2025/26?"],
    details: { recordsUsed: [] },
    dataAsOf: asOf(),
  };
}
