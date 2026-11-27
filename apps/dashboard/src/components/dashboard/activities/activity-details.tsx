import { Icon } from "@/components/dashboard/icon";
import { DIMENSION_LABELS, whenLabel } from "@/lib/activity-format";
import type { ActivityDetail } from "@/lib/activities-api";
import { formatLkr } from "@/lib/society-record-format";

function Field({ label, value }: { label: string; value?: string | number | null }) {
  return (
    <div>
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-[13px] font-semibold text-ink">{value ?? "—"}</dd>
    </div>
  );
}

const PEOPLE: { key: keyof ActivityDetail; label: string; note: string }[] = [
  { key: "femaleParticipants", label: "Female Participants", note: "Members and volunteers" },
  { key: "maleParticipants", label: "Male Participants", note: "Members and volunteers" },
  { key: "youthParticipants", label: "Youth (15–25)", note: "Included above" },
  { key: "householdsBenefited", label: "Households Benefited", note: "Families using the result" },
  { key: "womenHeadedHouseholds", label: "Women-Headed Households", note: "Of the households above" },
];

export function ActivityDetails({ activity }: { activity: ActivityDetail }) {
  return (
    <section aria-labelledby="details-heading" className="mt-4 rounded-card border border-line bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[10px] font-bold tracking-[0.08em] text-brand-forest">1 · From the Society Officer</p>
          <h2 className="text-[15px] font-bold text-ink" id="details-heading">Activity Details</h2>
        </div>
        <span className="inline-flex items-center gap-1 rounded-full bg-[#eef1ec] px-2.5 py-0.5 text-[10px] font-semibold text-ink-soft">
          <Icon className="size-3" name="lock" /> View Only
        </span>
      </div>
      <p className="mt-3 text-[13px] text-ink">{activity.description}</p>
      <dl className="mt-4 grid gap-4 sm:grid-cols-3">
        <Field label="When" value={whenLabel(activity)} />
        <Field label="Sector" value={activity.sector} />
        <Field label="Dimension" value={activity.dimension ? DIMENSION_LABELS[activity.dimension] : undefined} />
        <Field label="Allocated Cost" value={`${formatLkr(activity.allocatedCost)} · planning`} />
        <Field label="Partners" value={activity.partners} />
        <Field label="Volunteer Hours" value={activity.volunteerHours} />
      </dl>
      {activity.resourcesNeeded && (
        <dl className="mt-4">
          <Field label="Resources Needed" value={activity.resourcesNeeded} />
        </dl>
      )}
      <h3 className="mt-5 border-t border-line-soft pt-4 text-[13px] font-bold text-ink">Participants and Beneficiaries</h3>
      <ul className="mt-3 grid auto-rows-fr gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {PEOPLE.map(({ key, label, note }) => (
          <li className="flex h-full flex-col rounded-lg border border-line px-3 py-2.5" key={key}>
            <span className="text-[11px] text-ink-soft">{label}</span>
            <span className="text-[22px] font-bold text-ink">{(activity[key] as number | undefined) ?? "—"}</span>
            <span className="mt-auto text-[10px] text-muted">{note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
