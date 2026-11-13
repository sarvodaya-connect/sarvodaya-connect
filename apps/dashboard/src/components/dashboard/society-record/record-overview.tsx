import Link from "next/link";

import type { SocietyRecord, WorkPlanOverview } from "@sarvodaya-connect/api-contracts";

import { ENGLISH } from "@/i18n/english";
import { actorName, excoMissing, gradeFull, officeName, recordDate, roleName, waiting } from "@/i18n/society-record";
import { formatNumber, localeTag, type Translator } from "@/i18n/translate";
import { mapboxToken } from "@/lib/mapbox";

import { secondaryButtonClass } from "../data-states";
import { Icon } from "../icon";
import { SocietyLocationMap } from "../maps/society-location-map";
import { Pill } from "../ui/pill";
import { excoProgress, formatLkr, gradeBadgeClass } from "@/lib/society-record-format";

import { AnnualSummaryCards } from "./annual-summary-cards";

const STAFF_ORDER = ["DISTRICT_MANAGER", "DEPUTY_DISTRICT_MANAGER", "PROGRAMME_COORDINATOR", "SOCIETY_OFFICER"] as const;
const OFFICES = ["President", "Secretary", "Treasurer"];

function Eyebrow({ children }: { children: string }) {
  return <p className="text-[9px] font-bold tracking-[0.14em] text-brand-leaf">{children}</p>;
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

function Field({ label, t, value }: { label: string; t: Translator; value?: string | null }) {
  return (
    <div>
      <dt className="text-[10px] text-muted">{label}</dt>
      <dd className={`text-[12px] font-semibold ${value ? "text-ink" : "font-normal text-muted"}`}>
        {value || t("sr.ov.notRecorded")}
      </dd>
    </div>
  );
}

/** A decorative map with the society's pin, shown when Mapbox is not set up. Coordinates are shown as text. */
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

/**
 * Issue #141: "42 · 25 female, 17 male", or the total with a note when the
 * female/male split has not been entered yet. Nothing is guessed.
 */
function membersLine(record: SocietyRecord, t: Translator) {
  if (record.memberCount === null || record.memberCount === undefined) return undefined;
  const total = formatNumber(t.locale, record.memberCount);
  if (record.femaleMembers === null || record.maleMembers === null || record.femaleMembers === undefined || record.maleMembers === undefined)
    return t("sr.ov.splitNotEntered", { total });
  return t("sr.ov.membersSplit", { total, female: formatNumber(t.locale, record.femaleMembers), male: formatNumber(t.locale, record.maleMembers) });
}

/** D05 society record overview below the yearly summary. */
export function RecordOverview({
  canAssign = false,
  record,
  t = ENGLISH,
  workPlan,
}: {
  /** HQ only (D05a). The API refuses everyone else as well. */
  canAssign?: boolean;
  record: SocietyRecord;
  t?: Translator;
  workPlan: WorkPlanOverview | null;
}) {
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
  const exco = excoProgress(record.excoStatus, record.committee);
  const token = mapboxToken();

  return (
    <>
      <AnnualSummaryCards societyId={record.id} societyName={record.nameEn} staff={record.staff} summary={record.annualSummary} />

      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <Card
            action={
              record.permissions.canEdit && (
                <Link className="rounded-md border border-line px-2.5 py-1 text-[11px] font-semibold text-ink-soft hover:bg-brand-mint-soft" href={`${base}?panel=edit`}>
                  {t("sr.ov.edit")}
                </Link>
              )
            }
            eyebrow={t("sr.ov.recordEyebrow")}
            title={t("sr.ov.details")}
          >
            <dl className="grid gap-x-4 gap-y-3 sm:grid-cols-3">
              <Field label={t("sr.ov.name")} t={t} value={record.nameEn} />
              <Field label={t("sr.ov.sNumber")} t={t} value={record.societyCode} />
              <Field
                label={t("sr.ov.members")}
                t={t}
                value={membersLine(record, t)}
              />
              <Field label={t("sr.ov.landline")} t={t} value={record.landline ?? t("sr.ov.noLandline")} />
              <div className="sm:col-span-2">
                <Field label={t("sr.ov.address")} t={t} value={address} />
              </div>
            </dl>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              {record.location && token ? (
                <SocietyLocationMap className="h-32" name={record.nameEn} position={record.location} token={token} />
              ) : (
                <MapPreview hasLocation={Boolean(record.location)} />
              )}
              <div>
                <p className="text-[10px] text-muted">{t("sr.ov.business")}</p>
                <p className="mt-0.5 text-[12px] text-ink">{record.businessDescription || t("sr.ov.noneRecorded")}</p>
                <p className="mt-1.5 text-[10px] text-muted">{t("sr.ov.businessNote")}</p>
              </div>
            </div>
            <p className="mt-3 text-[10px] text-muted">
              {record.location
                ? t("sr.ov.mapSet", { lat: record.location.latitude.toFixed(4), lng: record.location.longitude.toFixed(4) })
                : t("sr.ov.mapNotSet")}
            </p>
          </Card>

          <Card
            action={
              <Link className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2" href={`${base}/exco`}>
                {committee.length === 0
                  ? record.permissions.canEdit
                    ? t("sr.ov.addExco")
                    : t("sr.ov.openExco")
                  : t("sr.ov.allMembers", { count: committee.length })}
              </Link>
            }
            eyebrow="Exco"
            title={t("sr.ov.excoTitle", { filled: exco.filled })}
          >
            {!exco.complete && (
              <p className="mb-2 text-[11.5px] text-warn-text">
                {excoMissing(t, record.excoStatus, exco.toFill).join(" ")} {t("sr.ov.officerEnters")}
              </p>
            )}
            {committee.length === 0 ? null : (
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#f6f7f4] text-[10px] text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colOffice")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colName")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colAge")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colProfession")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {committee.slice(0, 5).map((member) => (
                    <tr key={member.id}>
                      <td className="px-2 py-2 text-ink-soft">{officeName(t, member.position)}</td>
                      <td className="px-2 py-2 font-semibold text-ink">{member.fullName}</td>
                      <td className="px-2 py-2 text-ink-soft">{member.age ?? "—"}</td>
                      <td className="px-2 py-2 text-ink-soft">{member.profession ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card eyebrow={t("sr.ov.staffEyebrow")} title={t("sr.ov.staffTitle")}>
            {staff.length === 0 ? (
              <p className="text-[12px] text-muted">{t("sr.ov.noStaff")}</p>
            ) : (
              <table className="w-full text-left text-[11px]">
                <thead className="bg-[#f6f7f4] text-[10px] text-muted">
                  <tr>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colRole")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colName")}</th>
                    <th className="px-2 py-1.5 font-medium">{t("sr.ov.colAccount")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line-soft">
                  {staff.map((member) => (
                    <tr key={`${member.role}-${member.displayName}`}>
                      <td className="px-2 py-2 text-ink-soft">{roleName(t, member.role)}</td>
                      <td className="px-2 py-2 text-ink">{member.displayName}</td>
                      <td className="px-2 py-2">
                        <Pill tone={member.accountStatus === "ACTIVE" ? "on-time" : member.accountStatus === "PENDING" ? "fast-target" : "overdue"}>
                          {member.accountStatus === "ACTIVE"
                            ? t("sr.ov.accountActive")
                            : member.accountStatus === "PENDING"
                              ? t("sr.ov.accountWaiting")
                              : t("sr.ov.accountDisabled")}
                        </Pill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            {!staff.some((member) => member.role === "SOCIETY_OFFICER") && (
              <p className="mt-2 text-[10px] text-muted">{t("sr.ov.noOfficer")}</p>
            )}
            {canAssign && (
              <Link className={`${secondaryButtonClass} mt-3`} href={`${base}?panel=assign`}>
                <Icon className="size-4" name="user" strokeWidth={2} />
                {t("sr.header.assign")}
              </Link>
            )}
          </Card>

          <Card
            action={
              <Link className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2" href={`${base}/grade`}>
                {t("sr.ov.gradeHistory")}
              </Link>
            }
            eyebrow={t("sr.ov.hqOnly")}
            title={t("sr.tab.grade")}
          >
            <div className="flex items-center gap-3">
              <span className={`grid size-8 place-items-center rounded-md text-sm font-bold ${record.grade ? gradeBadgeClass[record.grade] : "bg-[#eef1ec] text-muted"}`}>
                {record.grade ?? "–"}
              </span>
              <div>
                <p className="text-[12px] font-bold text-ink">{record.grade ? gradeFull(t, record.grade) : t("n.gradeNotSet")}</p>
                {record.gradeChangedAt && record.gradeChangedBy && (
                  <p className="text-[10px] text-muted">
                    {t("sr.ov.setBy", { actor: actorName(t, record.gradeChangedBy), date: recordDate(t, record.gradeChangedAt) })}
                  </p>
                )}
              </div>
            </div>
            {request && (
              <div className="mt-3 rounded-lg border border-[#ecd89c] bg-warn-bg px-3 py-2 text-[11px] text-warn-text">
                <p className="flex items-center gap-1.5 font-bold">
                  <Icon className="size-3.5" name="clock" />
                  {t("sr.ov.request", { from: request.fromGrade ?? "–", to: request.toGrade, waiting: waiting(t, request.requestedAt) })}
                </p>
                <p>{t("sr.ov.sentBy", { actor: actorName(t, request.requestedBy), date: recordDate(t, request.requestedAt) })}</p>
              </div>
            )}
            <p className="mt-3 text-[10px] text-muted">{t("sr.ov.onlyHq")}</p>
          </Card>

          <Card
            action={
              <Link className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2" href={`${base}/work-plan`}>
                {t("sr.ov.openPlan")}
              </Link>
            }
            eyebrow={t("sr.ov.planEyebrow")}
            title={workPlan?.year ? t("sr.ov.planTitleYear", { year: workPlan.year }) : t("sr.ov.planTitle")}
          >
            {workPlan && workPlan.activities.length > 0 ? (
              <p className="text-[12px] text-ink">
                {t.rich(new Intl.PluralRules(localeTag(t.locale)).select(workPlan.activities.length) === "one" ? "sr.ov.planLine.one" : "sr.ov.planLine.other", {
                  count: formatNumber(t.locale, workPlan.activities.length),
                  amount: <span className="font-semibold">{formatLkr(workPlan.totalAllocated)}</span>,
                })}
              </p>
            ) : (
              <p className="text-[12px] text-muted">{t("sr.ov.noActivities")}</p>
            )}
          </Card>
        </div>
      </div>
    </>
  );
}
