import type { AccountSummary } from "@sarvodaya-connect/api-contracts";
import {
  InviteForm,
  ReissueForm,
  DisableAccountForm,
} from "@/components/dashboard/identity-forms";
import { platformApi } from "@/lib/platform-api";
import { getCurrentViewer } from "@/lib/current-viewer";
export default async function AccountsPage() {
  await getCurrentViewer();
  const [accounts, options] = await Promise.all([
    platformApi("/identity/accounts"),
    platformApi("/identity/scope-options"),
  ]);
  const societies = { data: options.societies };
  const districts = options.districts;
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Accounts & invitations</h1>
      <p>
        HQ assigns roles and society access. Permanent passwords are private.
      </p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {[
                "Person / username",
                "Role / scope",
                "Activation",
                "Help with sign-in",
              ].map((h) => (
                <th key={h} className="p-3">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {accounts.data.map((a: AccountSummary) => (
              <tr key={a.id} className="border-t">
                <td className="p-3">
                  {a.displayName}
                  <br />
                  {a.username}
                </td>
                <td className="p-3">
                  {
                    (
                      {
                        SOCIETY_OFFICER: "Society Officer",
                        PROGRAMME_COORDINATOR: "SPC",
                        DEPUTY_DISTRICT_MANAGER: "DDM",
                        DISTRICT_MANAGER: "DM",
                        HQ_ADMIN: "HQ",
                      } as Record<string, string>
                    )[a.role]
                  }
                  <br />
                  {options.districts.find(
                    (d: { id: string; nameEn: string }) =>
                      d.id === a.districtId,
                  )?.nameEn ?? "National"}{" "}
                  · {a.societyIds.length} societies
                </td>
                <td className="p-3">
                  {a.status === "PENDING" &&
                  a.invitations[0] &&
                  new Date(a.invitations[0].expiresAt) < new Date()
                    ? "Activation expired"
                    : a.status}
                </td>
                <td className="p-3">
                  {a.status !== "INACTIVE" && (
                    <>
                      <ReissueForm id={a.id} />
                      <details>
                        <summary>Change assignments</summary>
                        <InviteForm
                          account={a}
                          societies={societies.data}
                          districts={
                            Array.isArray(districts)
                              ? districts
                              : districts.data
                          }
                        />
                      </details>
                      <DisableAccountForm id={a.id} />
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!accounts.data.length && (
          <p className="p-5">
            No accounts yet. Invite the first account below.
          </p>
        )}
      </div>
      <InviteForm
        societies={societies.data}
        districts={Array.isArray(districts) ? districts : districts.data}
      />
    </div>
  );
}
