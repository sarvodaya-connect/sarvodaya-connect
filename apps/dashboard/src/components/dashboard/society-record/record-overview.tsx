import Link from "next/link";

import type { SocietyRecord, WorkPlanOverview } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";
import { Pill } from "../ui/pill";
import {
  actorLabel,
  formatDate,
  formatLkr,
  gradeBadgeClass,
  gradeLabel,
  ROLE_LABELS,
  waitingLabel,
} from "@/lib/society-record-format";

import { AnnualSummaryCards } from "./annual-summary-cards";

const STAFF_ORDER = ["DISTRICT_MANAGER", "DEPUTY_DISTRICT_MANAGER", "PROGRAMME_COORDINATOR", "SOCIETY_OFFICER"] as const;
const OFFICES = ["President", "Secretary", "Treasurer"];

function Eyebrow({ children }: { children: string }) {
  return <p className="text-[9px] font-bold uppercase tracking-[0.14em] text-brand-leaf">{children}</p>;
}

function Card({
  action,
  children,
  eyebrow,
  title,
}: {
  action?: React.ReactNode;
  children: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <section className="rounded-card border border-line bg-surface">
      <header className="flex items-start justify-between gap-3 border-b border-line-soft px-4 py-3">
        <div>
          <Eyebrow>{eyebrow}</Eyebrow>
          <h3 className="mt-0.5 text-[13px] font-bold text-ink">{title}</h3>
        </div>
        {action}
      </header>
      <div className="px-4 py-3.5">{children}</div>
    </section>
  );
}

function Field({ label, value }: { label: string; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className={`text-[12px] font-semibold ${value ? "text-ink" : "font-normal text-muted"}`}>
        {value || "Not recorded"}
      </dd>
    </div>
  );
}

/** A decorative map with the society's pin. Coordinates are shown as text. */
function MapPreview({ hasLocation }: { hasLocation: boolean }) {
  return (
    <svg aria-hidden="true" className="h-32 w-full rounded-lg border border-line bg-[#e3efe0]" preserveAspectRatio="none" viewBox="0 0 240 120">
      <path d="M0 22 C60 12 90 38 140 24 S220 30 240 18" fill="none" stroke="#c7dbe7" strokeWidth="9" />
      <path d="M0 96 C70 72 120 90 160 70 S220 64 240 76" fill="none" stroke="#fff" strokeWidth="6" />
      <path d="M100 0 C108 40 122 70 112 120" fill="none" stroke="#fff" strokeWidth="5" />
      {hasLocation && (
        <g transform="translate(112 52)">
          <path d="M0 -14 C-7 -14 -10 -9 -10 -5 C-10 2 0 12 0 12 C0 12 10 2 10 -5 C10 -9 7 -14 0 -14 Z" fill="none" stroke="#c0392b" strokeWidth="2.2" />
          <circle cx="0" cy="-5" fill="#c0392b" r="3" />
        </g>
      )}
    </svg>
  );
}

/** D05 society record overview below the yearly summary. */
export function RecordOverview({ record, workPlan }: { record: SocietyRecord; workPlan: WorkPlanOverview | null }) {
  const base = `/societies/${record.id}`;
  const address = [record.address.addressLine, record.address.dsDivision && `${record.address.dsDivision} DS`, record.address.gnDivision && `${record.address.gnDivision} GN`]
    .filter(Boolean)
    .join(" · ");
  const committee = [...record.committee]
    .filter((member) => member.isActive)
    .sort((a, b) => {
      const rank = (position: string) => (OFFICES.includes(position) ? OFFICES.indexOf(position) : 9);
      return rank(a.position) - rank(b.position) || (a.seatNumber ?? 99) - (b.seatNumber ?? 99);
    });
  const staff = [...record.staff].sort((a, b) => STAFF_ORDER.indexOf(a.role as never) - STAFF_ORDER.indexOf(b.role as never));
  const request = record.openGradeRequest;

  return (
    <>
      <AnnualSummaryCards societyId={record.id} societyName={record.nameEn} staff={record.staff} summary={record.annualSummary} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            action={
              record.permissions.canEdit && (
                <Link className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft" href={`${base}?panel=edit`}>
                  Edit
                </Link>
              )
            }
            eyebrow="Record"
            title="Society details"
          >
            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label="Society name" value={record.nameEn} />
              <Field label="S number" value={record.societyCode} />
              <Field label="Number of members" value={record.memberCount?.toLocaleString("en-GB")} />
              <Field label="Landline" value={record.landline ?? "No landline"} />
              <div className="sm:col-span-2">
                <Field label="Address" value={address} />
              </div>
            </dl>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <MapPreview hasLocation={Boolean(record.location)} />
              <div>
                <p className="text-[10px] text-muted">Business run by the society</p>
                <p className="mt-0.5 text-[12px] text-ink">{record.businessDescription || "None recorded."}</p>
                <p className="mt-1.5 text-[10px] text-muted">Information only — no sales, stock or accounts are kept.</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted">
              Map location{" "}
              {record.location
                ? `${record.location.latitude.toFixed(4)}° N, ${record.location.longitude.toFixed(4)}° E`
                : "not set"}{" "}
              · details can be edited by the Society Officer, SPC, DDM and HQ.
            </p>
          </Card>

          <Card
            action={
              <Link className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2" href={`${base}/exco`}>
                All {committee.length} members
              </Link>
            }
            eyebrow="Exco"
            title={`Exco · ${committee.length} members`}
          >
            {committee.length === 0 ? (
              <p className="text-[12px] text-muted">No Exco members recorded yet.</p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#f6f7f4] text-[10px] text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Office</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Age</th>
                    <th className="px-2 py-1.5 font-medium">Phone</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {committee.slice(0, 5).map((member) => (
                    <tr key={member.id}>
                      <td className="px-2 py-2 text-ink-soft">{OFFICES.includes(member.position) ? member.position : "Member"}</td>
                      <td className="px-2 py-2 font-semibold text-ink">{member.fullName}</td>
                      <td className="px-2 py-2 text-ink-soft">{member.age ?? "—"}</td>
                      <td className="px-2 py-2 text-ink-soft">{member.phone ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card eyebrow="Assigned by HQ" title="Responsible staff">
            {staff.length === 0 ? (
              <p className="text-[12px] text-muted">No staff are assigned to this society yet.</p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#f6f7f4] text-[10px] text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">Role</th>
                    <th className="px-2 py-1.5 font-medium">Name</th>
                    <th className="px-2 py-1.5 font-medium">Account</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {staff.map((member) => (
                    <tr key={`${member.role}-${member.displayName}`}>
                      <td className="px-2 py-2 text-ink-soft">{ROLE_LABELS[member.role]}</td>
                      <td className="px-2 py-2 text-ink">{member.displayName}</td>
                      <td className="px-2 py-2">
                        <Pill tone={member.accountStatus === "ACTIVE" ? "on-time" : member.accountStatus === "PENDING" ? "fast-target" : "overdue"}>
                          {member.accountStatus === "ACTIVE" ? "Active" : member.accountStatus === "PENDING" ? "Waiting" : "Disabled"}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!staff.some((member) => member.role === "SOCIETY_OFFICER") && (
              <p className="mt-2 text-[10px] text-muted">No Society Officer is assigned.</p>
            )}
          </Card>

          <Card
            action={
              <Link className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2" href={`${base}/grade`}>
                Grade history
              </Link>
            }
            eyebrow="HQ only"
            title="Grade"
          >
            <div className="flex items-center gap-3">
              <span className={`grid size-8 place-items-center rounded-md text-sm font-bold ${record.grade ? gradeBadgeClass[record.grade] : "bg-[#eef1ec] text-muted"}`}>
                {record.grade ?? "–"}
              </span>
              <div>
                <p className="text-[12px] font-bold text-ink">{record.grade ? gradeLabel(record.grade) : "Grade not set"}</p>
                {record.gradeChangedAt && record.gradeChangedBy && (
                  <p className="text-[10px] text-muted">
                    Set by {actorLabel(record.gradeChangedBy)} · {formatDate(record.gradeChangedAt)}
                  </p>
                )}
              </div>
            </div>
            {request && (
              <div className="mt-3 rounded-lg border border-[#ecd89c] bg-warn-bg px-3 py-2 text-[11px] text-warn-text">
                <p className="flex items-center gap-1.5 font-bold">
                  <Icon className="size-3.5" name="clock" />
                  Request {request.fromGrade ?? "–"} → {request.toGrade} · waiting {waitingLabel(request.requestedAt)}
                </p>
                <p>
                  Sent by {actorLabel(request.requestedBy)} · {formatDate(request.requestedAt)}
                </p>
              </div>
            )}
            <p className="mt-3 text-[10px] text-muted">Only HQ changes grades — by approving a request or editing the grade directly.</p>
          </Card>

          <Card
            action={
              <Link className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2" href={`${base}/work-plan`}>
                Open plan
              </Link>
            }
            eyebrow="Plan"
            title={`Annual work plan ${workPlan?.year ?? ""}`.trim()}
          >
            {workPlan && workPlan.activities.length > 0 ? (
              <p className="text-[12px] text-ink">
                {workPlan.activities.length} {workPlan.activities.length === 1 ? "activity" : "activities"} ·{" "}
                <span className="font-semibold">{formatLkr(workPlan.totalAllocated)}</span> allocated for planning
              </p>
            ) : (
              <p className="text-[12px] text-muted">No activities planned yet.</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
