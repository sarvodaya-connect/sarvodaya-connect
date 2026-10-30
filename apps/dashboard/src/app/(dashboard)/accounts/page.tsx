import type { AccountSummary } from "@sarvodaya-connect/api-contracts";
import {
  InviteForm,
  SetPasswordForm,
  DisableAccountForm,
} from "@/components/dashboard/identity-forms";
import { PageHeading } from "@/components/dashboard/page-heading";
import { SectionCard } from "@/components/dashboard/ui/section-card";
import { platformApi } from "@/lib/platform-api";
import { getCurrentViewer } from "@/lib/current-viewer";

const roleLabels: Record<string, string> = {
  SOCIETY_OFFICER: "Society Officer",
  PROGRAMME_COORDINATOR: "SPC",
  DEPUTY_DISTRICT_MANAGER: "DDM",
  DISTRICT_MANAGER: "DM",
  HQ_ADMIN: "HQ",
};

function statusLabel(account: AccountSummary) {
  if (
    account.status === "PENDING" &&
    account.invitations[0] &&
    new Date(account.invitations[0].expiresAt) < new Date()
  ) {
    return "Invitation expired";
  }
  return account.status === "PENDING" ? "Invitation pending" : account.status;
}

function statusStyle(label: string) {
  if (label === "ACTIVE") return "bg-[#e5f3e8] text-[#25643f]";
  if (label === "INACTIVE" || label === "Invitation expired")
    return "bg-[#fbe9e7] text-[#a8312a]";
  return "bg-[#fff4d6] text-[#7a5a00]";
}

export default async function AccountsPage() {
  await getCurrentViewer();
  const [accounts, options] = await Promise.all([
    platformApi("/identity/accounts"),
    platformApi("/identity/scope-options"),
  ]);
  const districts = Array.isArray(options.districts)
    ? options.districts
    : options.districts.data;
  const activeCount = accounts.data.filter(
    (account: AccountSummary) => account.status === "ACTIVE",
  ).length;
  const pendingCount = accounts.data.filter(
    (account: AccountSummary) => account.status === "PENDING",
  ).length;

  return (
    <div className="mx-auto max-w-[1440px] space-y-6">
      <PageHeading
        title="Staff accounts"
        description="HQ creates each username and permanent password, assigns access, and can set a replacement password when responsibility changes."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        {[
          { label: "Total accounts", value: accounts.data.length },
          { label: "Active", value: activeCount },
          { label: "Pending activation", value: pendingCount },
        ].map((item) => (
          <div
            key={item.label}
            className="rounded-card border border-line bg-white px-5 py-4"
          >
            <p className="text-xs font-medium text-muted">{item.label}</p>
            <p className="mt-1 text-2xl font-semibold text-ink">{item.value}</p>
          </div>
        ))}
      </div>

      <SectionCard
        title="Team accounts"
        description="Each person can only access the records allowed by their role and assignment."
        action={
          <span className="rounded-full bg-[#e6f0e7] px-3 py-1 text-xs font-semibold text-[#174a32]">
            {accounts.data.length} {accounts.data.length === 1 ? "account" : "accounts"}
          </span>
        }
        padded={false}
      >
        {accounts.data.length ? (
          <div className="divide-y divide-line-soft">
            {accounts.data.map((account: AccountSummary) => {
              const district = districts.find(
                (item: { id: string; nameEn: string }) =>
                  item.id === account.districtId,
              );
              const state = statusLabel(account);
              return (
                <article
                  key={account.id}
                  className="grid gap-4 px-5 py-5 transition-colors hover:bg-[#fcfcf8] md:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)_minmax(260px,1.1fr)] md:items-center md:px-6"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-ink">
                      {account.displayName}
                    </p>
                    <p className="mt-1 text-sm text-muted">@{account.username}</p>
                  </div>
                  <div className="space-y-1">
                    <span className="inline-flex rounded-full bg-[#f4f8f3] px-2.5 py-1 text-xs font-semibold text-[#174a32]">
                      {roleLabels[account.role] ?? account.role}
                    </span>
                    <p className="text-sm text-[#3e4b43]">
                      {district?.nameEn ?? "National access"}
                      {account.role !== "HQ_ADMIN" && (
                        <span className="text-muted">
                          {` · ${account.societyIds.length} ${account.societyIds.length === 1 ? "society" : "societies"}`}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-3 md:justify-end">
                    <span
                      className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${statusStyle(state)}`}
                    >
                      {state}
                    </span>
                    <details className="group relative">
                        <summary className="cursor-pointer list-none rounded-lg border border-line px-3 py-2 text-sm font-medium text-[#174a32] hover:bg-[#f4f8f3] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#80b56f]">
                          Manage
                        </summary>
                        <div className="absolute right-0 z-10 mt-2 w-[min(90vw,360px)] rounded-xl border border-line bg-white p-4 shadow-lg">
                          <SetPasswordForm id={account.id} username={account.username} />
                          <details className="mt-4 border-t border-line-soft pt-3">
                            <summary className="cursor-pointer text-sm font-medium text-[#174a32]">
                              Change role or assignments
                            </summary>
                            <div className="mt-3">
                              <InviteForm
                                account={account}
                                societies={options.societies}
                                districts={districts}
                              />
                            </div>
                          </details>
                          <div className="mt-4 border-t border-line-soft pt-3">
                            <DisableAccountForm id={account.id} />
                          </div>
                        </div>
                    </details>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="px-6 py-10 text-center">
            <p className="font-medium text-ink">No staff accounts yet</p>
            <p className="mt-1 text-sm text-muted">
              Create an account below and securely hand the username and password to its assigned staff member.
            </p>
          </div>
        )}
      </SectionCard>

      <InviteForm societies={options.societies} districts={districts} />
    </div>
  );
}
