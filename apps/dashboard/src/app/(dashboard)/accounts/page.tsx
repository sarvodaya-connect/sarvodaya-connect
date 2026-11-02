import Link from "next/link";
import type { AccountSummary, ScopeOptions } from "@sarvodaya-connect/api-contracts";

import { AdministrationTabs } from "@/components/dashboard/accounts/administration-tabs";
import { EmptyState, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import {
  CreateAccountDrawer,
  ROLE_LABELS,
  SetPasswordDialog,
} from "@/components/dashboard/identity-forms";
import {
  ACCOUNT_TABS,
  filterAccounts,
  parseAccountFilters,
  passwordLabel,
  scopeLabel,
  statusLabel,
  tabCounts,
} from "@/lib/accounts";
import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

const statusTone = {
  active: "bg-success-bg text-success-text",
  inactive: "bg-danger-bg text-danger-text",
  pending: "bg-warn-bg text-warn-text",
};

const selectClass =
  "h-[38px] rounded-[10px] border border-line bg-surface px-3 text-xs text-ink outline-none focus:border-brand-leaf focus:ring-3 focus:ring-brand-mint";

/** V5 D16 Accounts, with D16i (create) and D16t (set a new password). HQ only. */
export default async function AccountsPage({ searchParams }: PageProps<"/accounts">) {
  // Non-HQ viewers are sent away here; the API refuses them as well.
  await getCurrentViewer();
  const filters = parseAccountFilters(await searchParams);
  const [accounts, options]: [{ data: AccountSummary[] }, ScopeOptions] = await Promise.all([
    platformApi("/identity/accounts"),
    platformApi("/identity/scope-options"),
  ]);
  const counts = tabCounts(accounts.data);
  const rows = filterAccounts(accounts.data, filters);
  const hasFilters = Boolean(filters.q || filters.role || filters.district);
  const tabHref = (tab: string) => {
    const params = new URLSearchParams({ ...(tab !== "all" && { tab }) });
    for (const key of ["q", "role", "district"] as const) if (filters[key]) params.set(key, filters[key]);
    const query = params.toString();
    return query ? `/accounts?${query}` : "/accounts";
  };
  const total = accounts.data.length;

  return (
    <div className="flex flex-col gap-4">
      <AdministrationTabs current="accounts" />
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-ink">Accounts</h2>
          <p className="mt-0.5 text-xs text-ink-soft">
            {total.toLocaleString("en-GB")} {total === 1 ? "account" : "accounts"} · usernames, passwords, roles and scopes are set here
          </p>
        </div>
        <CreateAccountDrawer options={options} />
      </div>

      <nav aria-label="Account roles" className="flex flex-wrap gap-x-6 gap-y-2 border-b border-line">
        {ACCOUNT_TABS.map((tab) => (
          <Link
            aria-current={filters.tab === tab.key ? "page" : undefined}
            className={`-mb-px flex items-center gap-1.5 border-b-2 pb-2.5 text-[13px] ${
              filters.tab === tab.key ? "border-brand-forest font-semibold text-ink" : "border-transparent text-ink-soft hover:text-ink"
            }`}
            href={tabHref(tab.key)}
            key={tab.key}
          >
            {tab.label}
            <span className="rounded-md bg-state-grey px-1.5 text-[10.5px] text-ink-soft">{counts[tab.key].toLocaleString("en-GB")}</span>
          </Link>
        ))}
      </nav>

      <form action="/accounts" className="flex flex-wrap items-center gap-2.5" role="search">
        {filters.tab !== "all" && <input name="tab" type="hidden" value={filters.tab} />}
        <label className="relative w-full max-w-[280px]">
          <span className="sr-only">Name or username</span>
          <Icon className="absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[#6a776e]" name="search" strokeWidth={2} />
          <input
            className="h-[38px] w-full rounded-[10px] border border-line bg-surface pl-[34px] pr-3 text-xs outline-none focus:border-brand-leaf focus:ring-3 focus:ring-brand-mint"
            defaultValue={filters.q}
            name="q"
            placeholder="Name or username"
            type="search"
          />
        </label>
        <label>
          <span className="sr-only">Role</span>
          <select className={selectClass} defaultValue={filters.role} name="role">
            <option value="">Role: All</option>
            {Object.entries(ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>Role: {label}</option>
            ))}
          </select>
        </label>
        <label>
          <span className="sr-only">District</span>
          <select
            className={`${selectClass} ${filters.district ? "border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] font-semibold text-[var(--banner-edit-text)]" : ""}`}
            defaultValue={filters.district}
            name="district"
          >
            <option value="">District: All</option>
            {options.districts.map((district) => (
              <option key={district.id} value={district.id}>District: {district.nameEn}</option>
            ))}
          </select>
        </label>
        <button className={secondaryButtonClass} type="submit">Apply</button>
        {hasFilters && (
          <Link className="text-xs font-semibold text-brand-action underline underline-offset-2" href={filters.tab === "all" ? "/accounts" : `/accounts?tab=${filters.tab}`}>
            Clear filters
          </Link>
        )}
      </form>

      <section className="overflow-hidden rounded-card border border-line bg-surface">
        {rows.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-left text-[13px]">
              <caption className="sr-only">Accounts</caption>
              <thead className="bg-surface-muted text-[11.5px] font-semibold text-ink-soft">
                <tr>
                  {["Name and username", "Role", "Scope", "Status", "Password"].map((heading) => (
                    <th className="px-3 py-3 font-semibold first:pl-4" key={heading} scope="col">{heading}</th>
                  ))}
                  <th className="px-3 py-3" scope="col"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line-soft">
                {rows.map((account) => {
                  const status = statusLabel(account);
                  const scope = scopeLabel(account, options);
                  return (
                    <tr key={account.id}>
                      <td className="py-3 pl-4 pr-3">
                        <strong className="block font-semibold text-ink">{account.displayName}</strong>
                        <span className="text-[11.5px] text-ink-soft">{account.username}</span>
                      </td>
                      <td className="px-3 py-3">{ROLE_LABELS[account.role]}</td>
                      <td className="px-3 py-3">
                        {scope}
                        {account.temporaryDistrictView && (
                          <span className="mt-1 flex w-fit items-center gap-1 rounded-md bg-[var(--banner-temporary-bg)] px-1.5 text-[10.5px] font-semibold text-[var(--banner-temporary-text)]">
                            <span aria-hidden="true">●</span> Temporary view: district
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${statusTone[status.tone]}`}>
                          <span aria-hidden="true">●</span> {status.label}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-ink-soft">{passwordLabel(account)}</td>
                      <td className="py-3 pl-3 pr-4 text-right">
                        <SetPasswordDialog
                          account={{
                            id: account.id,
                            displayName: account.displayName,
                            username: account.username,
                            scopeLabel: `${ROLE_LABELS[account.role]} · ${scope}`,
                          }}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : hasFilters || filters.tab !== "all" ? (
          <EmptyState
            action={<Link className={secondaryButtonClass} href="/accounts">Clear all filters</Link>}
            description="No account matches this name, role or district."
            icon="search"
            title="No accounts match"
          />
        ) : (
          <EmptyState
            description="Create the first account and give the username and password to the person yourself."
            icon="user"
            title="No accounts yet"
          />
        )}
      </section>

      <p className="flex gap-2.5 rounded-xl border border-[var(--banner-edit-line)] bg-[var(--banner-edit-bg)] px-3.5 py-2.5 text-xs text-[var(--banner-edit-text)]">
        <Icon className="mt-0.5 size-4 shrink-0" name="lock" strokeWidth={2} />
        <span>
          <strong className="block">Passwords are set by HQ.</strong>
          HQ creates each account with a username and a permanent password, and gives them to the person. If someone forgets their password, HQ sets a new one here.
        </span>
      </p>
    </div>
  );
}
