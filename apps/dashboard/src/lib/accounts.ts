import type { AccountSummary, ScopeOptions, UserRole } from "@sarvodaya-connect/api-contracts";

/** V5 D16 role tabs. */
export const ACCOUNT_TABS = [
  { key: "all", label: "All", roles: null },
  { key: "officers", label: "Society Officers", roles: ["SOCIETY_OFFICER"] },
  { key: "spcs", label: "SPCs", roles: ["PROGRAMME_COORDINATOR"] },
  { key: "managers", label: "DDMs and DMs", roles: ["DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"] },
  { key: "hq", label: "HQ", roles: ["HQ_ADMIN"] },
] as const satisfies readonly { key: string; label: string; roles: readonly UserRole[] | null }[];

export type AccountTab = (typeof ACCOUNT_TABS)[number]["key"];

export type AccountFilters = { tab: AccountTab; q: string; role: string; district: string };

export function parseAccountFilters(params: Record<string, string | string[] | undefined>): AccountFilters {
  const one = (key: string) => {
    const value = params[key];
    return (Array.isArray(value) ? value[0] : value)?.trim() ?? "";
  };
  const tab = ACCOUNT_TABS.find((item) => item.key === one("tab"))?.key ?? "all";
  return { tab, q: one("q").slice(0, 100), role: one("role"), district: one("district") };
}

function inTab(account: AccountSummary, tab: AccountTab) {
  const roles = ACCOUNT_TABS.find((item) => item.key === tab)!.roles as readonly UserRole[] | null;
  return roles === null || roles.includes(account.role);
}

export function filterAccounts(accounts: AccountSummary[], filters: AccountFilters) {
  const query = filters.q.toLowerCase();
  return accounts.filter(
    (account) =>
      inTab(account, filters.tab) &&
      (!filters.role || account.role === filters.role) &&
      (!filters.district || account.districtId === filters.district) &&
      (!query ||
        account.displayName.toLowerCase().includes(query) ||
        account.username.toLowerCase().includes(query)),
  );
}

export function tabCounts(accounts: AccountSummary[]): Record<AccountTab, number> {
  return Object.fromEntries(
    ACCOUNT_TABS.map((tab) => [tab.key, accounts.filter((account) => inTab(account, tab.key)).length]),
  ) as Record<AccountTab, number>;
}

/** V5 D16 Scope column, for example "12 societies · Kurunegala" or "Kurunegala District". */
export function scopeLabel(account: AccountSummary, options: ScopeOptions): string {
  const district = options.districts.find((item) => item.id === account.districtId)?.nameEn;
  switch (account.role) {
    case "HQ_ADMIN":
      return "National";
    case "DISTRICT_MANAGER":
      return district ? `${district} District` : "No district assigned";
    case "SOCIETY_OFFICER": {
      const society = options.societies.find((item) => item.id === account.societyIds[0]);
      return society?.nameEn ?? "No society assigned";
    }
    default: {
      const count = account.societyIds.length;
      const societies = `${count} ${count === 1 ? "society" : "societies"}`;
      return district ? `${societies} · ${district}` : societies;
    }
  }
}

const dateFormat = new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", timeZone: "Asia/Colombo" });

/** V5 D16 Password column. The password itself is never sent to the dashboard. */
export function passwordLabel(account: AccountSummary): string {
  if (!account.passwordSetAt) return "Not set yet";
  const when = dateFormat.format(new Date(account.passwordSetAt));
  return `${account.passwordSetCount > 1 ? "Set again by HQ" : "Set by HQ"} · ${when}`;
}

export function statusLabel(account: AccountSummary): { label: string; tone: "active" | "inactive" | "pending" } {
  if (account.status === "ACTIVE") return { label: "Active", tone: "active" };
  if (account.status === "INACTIVE") return { label: "Inactive", tone: "inactive" };
  // Accounts made before V5 that never had a password set by HQ.
  return { label: "Needs a password", tone: "pending" };
}
