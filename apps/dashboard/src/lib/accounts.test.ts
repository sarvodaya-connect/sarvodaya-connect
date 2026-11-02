import type { AccountSummary, ScopeOptions } from "@sarvodaya-connect/api-contracts";
import { describe, expect, it } from "vitest";

import { filterAccounts, parseAccountFilters, passwordLabel, scopeLabel, statusLabel, tabCounts } from "./accounts";
import { suggestUsername } from "./sign-in-messages";

const options: ScopeOptions = {
  districts: [{ id: "d1", nameEn: "Kurunegala", code: "KG" }],
  societies: [
    { id: "s1", nameEn: "Pahala Kosgama SSS", societyCode: "S-1", districtId: "d1" },
    { id: "s2", nameEn: "Wellawa SSS", societyCode: "S-2", districtId: "d1" },
  ],
};

const account = (overrides: Partial<AccountSummary>): AccountSummary => ({
  id: "a1",
  username: "n.wijesinghe",
  displayName: "N. Wijesinghe",
  phone: "+94000000000",
  email: null,
  role: "SOCIETY_OFFICER",
  districtId: "d1",
  societyIds: ["s1"],
  status: "ACTIVE",
  passwordSetAt: "2026-10-18T04:00:00.000Z",
  passwordSetCount: 1,
  temporaryDistrictView: false,
  ...overrides,
});

describe("V5 D16 account rows", () => {
  it("describes each role's scope", () => {
    expect(scopeLabel(account({}), options)).toBe("Pahala Kosgama SSS");
    expect(scopeLabel(account({ role: "PROGRAMME_COORDINATOR", societyIds: ["s1", "s2"] }), options)).toBe("2 societies · Kurunegala");
    expect(scopeLabel(account({ role: "DISTRICT_MANAGER", societyIds: [] }), options)).toBe("Kurunegala District");
    expect(scopeLabel(account({ role: "HQ_ADMIN", districtId: null, societyIds: [] }), options)).toBe("National");
  });

  it("says when HQ set the password, never the password itself", () => {
    expect(passwordLabel(account({}))).toBe("Set by HQ · 18 Oct");
    expect(passwordLabel(account({ passwordSetCount: 2 }))).toBe("Set again by HQ · 18 Oct");
    expect(passwordLabel(account({ passwordSetAt: null, passwordSetCount: 0 }))).toBe("Not set yet");
  });

  it("labels older accounts that still need a password", () => {
    expect(statusLabel(account({ status: "PENDING" }))).toEqual({ label: "Needs a password", tone: "pending" });
  });
});

describe("V5 D16 tabs and filters", () => {
  const rows = [
    account({ id: "so", displayName: "N. Wijesinghe" }),
    account({ id: "spc", role: "PROGRAMME_COORDINATOR", displayName: "S. Karunaratne", username: "s.karunaratne" }),
    account({ id: "ddm", role: "DEPUTY_DISTRICT_MANAGER", displayName: "P. Dissanayake", username: "p.dissanayake" }),
    account({ id: "hq", role: "HQ_ADMIN", districtId: null, displayName: "K. Mendis", username: "k.mendis" }),
  ];

  it("counts each tab", () => {
    expect(tabCounts(rows)).toEqual({ all: 4, officers: 1, spcs: 1, managers: 1, hq: 1 });
  });

  it("filters by tab, name or username, role and district", () => {
    const ids = (params: Record<string, string>) => filterAccounts(rows, parseAccountFilters(params)).map((row) => row.id);
    expect(ids({ tab: "managers" })).toEqual(["ddm"]);
    expect(ids({ q: "karuna" })).toEqual(["spc"]);
    expect(ids({ q: "K.MENDIS" })).toEqual(["hq"]);
    expect(ids({ district: "d1" })).toEqual(["so", "spc", "ddm"]);
    expect(ids({ role: "HQ_ADMIN" })).toEqual(["hq"]);
    expect(ids({ tab: "nonsense" })).toHaveLength(4);
  });
});

describe("suggestUsername", () => {
  it("suggests a username from the full name", () => {
    expect(suggestUsername("P. Jayaweera")).toBe("p.jayaweera");
    expect(suggestUsername("  Sunethra  Karunaratne ")).toBe("sunethra.karunaratne");
  });
});
