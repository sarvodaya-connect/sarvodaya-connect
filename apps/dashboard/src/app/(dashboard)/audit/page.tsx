import { platformApi } from "@/lib/platform-api";
import { getCurrentViewer } from "@/lib/current-viewer";
export default async function AuditPage() {
  await getCurrentViewer();
  const { data } = await platformApi("/identity/audit");
  return (
    <section className="space-y-4">
      <h1 className="text-2xl font-semibold">Change & access log</h1>
      <p>
        Latest 200 recorded events. Full NICs, credentials and passwords are
        never included.
      </p>
      <div className="overflow-x-auto rounded border bg-white">
        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              {["When", "Who", "Action", "Record", "Details"].map((t) => (
                <th className="p-3" key={t}>
                  {t}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map(
              (e: {
                id: string;
                createdAt: string;
                actorId: string;
                action: string;
                targetId: string;
                detail: string;
              }) => (
                <tr key={e.id} className="border-t">
                  <td className="p-3">
                    {new Date(e.createdAt).toLocaleString("en-GB", {
                      timeZone: "Asia/Colombo",
                    })}
                  </td>
                  <td className="p-3">{e.actorId}</td>
                  <td className="p-3">{e.action}</td>
                  <td className="p-3">{e.targetId}</td>
                  <td className="p-3">{e.detail}</td>
                </tr>
              ),
            )}
          </tbody>
        </table>
        {!data.length && (
          <p className="p-5">No changes or access events recorded yet.</p>
        )}
      </div>
    </section>
  );
}
