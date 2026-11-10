"use client";

import Link from "next/link";
import { useActionState, useMemo, useRef, useState } from "react";

import type {
  EmergencyAssessmentInput,
  EmergencyHelpingCandidate,
  EmergencyImpact,
  EmergencyIncidentSummary,
  EmergencyNeed,
  EmergencyResponseAction,
  EmergencyRoadAccess,
  EmergencySocietyRef,
} from "@sarvodaya-connect/api-contracts";

import type { IncidentFormState } from "@/app/(dashboard)/emergencies/actions";
import { INCIDENT_TYPE_LABELS, INCIDENT_TYPES, NEED_LABELS, NEEDS, ROAD_ACCESS, ROAD_LABELS, STATE_LABELS } from "@/lib/emergency-format";
import { submitWithoutReset } from "@/lib/use-form-submit";

import { primaryButtonClass, secondaryButtonClass } from "../data-states";
import { Icon } from "../icon";
import { localInputValue } from "../district-access/access-controls";

const field =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2.5 text-[12.5px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";
const labelClass = "block text-[12px] font-semibold text-ink";
const hint = "mt-1 block text-[11px] font-normal text-ink-soft";
const dangerButton =
  "inline-flex h-[38px] items-center justify-center gap-1.5 whitespace-nowrap rounded-button bg-danger-dot px-4 text-[13px] font-semibold text-white hover:bg-danger-text disabled:cursor-not-allowed disabled:bg-[#dfe3dd] disabled:text-[#9aa39d]";
const Required = () => <span className="text-danger-text">*</span>;

function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p className="rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
      {message}
    </p>
  );
}

/** Districts affected: several can be chosen (D30 "Districts affected", IR02 "Area affected"). */
function DistrictPicker({ districts, selected, onChange }: { districts: { id: string; name: string }[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const names = districts.filter((d) => selected.includes(d.id)).map((d) => d.name);
  return (
    <details className="group relative">
      <summary className={`${field} flex cursor-pointer list-none items-center justify-between`}>
        <span className={names.length ? "" : "text-ink-soft"}>{names.length ? names.join(", ") : "Choose districts"}</span>
        <Icon className="size-4 text-ink-soft" name="chevron" strokeWidth={2} />
      </summary>
      <fieldset className="absolute z-10 mt-1 max-h-60 w-full overflow-y-auto rounded-input border border-line bg-surface p-2 shadow-lg">
        <legend className="sr-only">Districts Affected</legend>
        {districts.map((district) => (
          <label className="flex items-center gap-2 rounded px-2 py-1.5 text-[12.5px] text-ink hover:bg-brand-mint-soft" key={district.id}>
            <input
              checked={selected.includes(district.id)}
              name="districtIds"
              onChange={(event) => onChange(event.target.checked ? [...selected, district.id] : selected.filter((id) => id !== district.id))}
              type="checkbox"
              value={district.id}
            />
            {district.name}
          </label>
        ))}
      </fieldset>
    </details>
  );
}

/**
 * V5 D30 (HQ side panel) and IR02 / M48 (role dialog): open an incident.
 * The reporting society is one the user looks after; the API checks it again.
 */
export function OpenIncidentForm({
  action,
  societies,
  districts,
  variant,
  closeHref,
  openerLine,
  now,
}: {
  action: (state: IncidentFormState, form: FormData) => Promise<IncidentFormState>;
  societies: (EmergencySocietyRef & { districtId: string })[];
  districts: { id: string; name: string }[];
  variant: "hq" | "role";
  closeHref: string;
  /** "S. Karunaratne, SPC" */
  openerLine: string;
  now: Date;
}) {
  const [state, submit, pending] = useActionState(action, {});
  // One id per form: a double click or a resubmit returns the same incident.
  const [clientMutationId] = useState(() => crypto.randomUUID());
  const [societyId, setSocietyId] = useState(societies.length === 1 ? societies[0]!.id : "");
  const society = societies.find((s) => s.id === societyId);
  const [areaIds, setAreaIds] = useState<string[]>(society ? [society.districtId] : []);
  const start = new Date(Math.floor(now.getTime() / 60_000) * 60_000);
  const chooseSociety = (id: string) => {
    setSocietyId(id);
    const districtId = societies.find((s) => s.id === id)?.districtId;
    // The reporting society's district is always part of the area.
    if (districtId && !areaIds.includes(districtId)) setAreaIds([...areaIds, districtId]);
  };

  const societyField = (
    <label className={labelClass}>
      {variant === "hq" ? "Reporting society" : "Society reporting"} <Required />
      <select className={field} name="reportingSocietyId" onChange={(event) => chooseSociety(event.target.value)} required value={societyId}>
        <option value="">Choose a society</option>
        {societies.map((s) => (
          <option key={s.id} value={s.id}>
            {s.name} · {s.code}
          </option>
        ))}
      </select>
    </label>
  );
  const typeField = (
    <label className={labelClass}>
      {variant === "hq" ? "Type" : "What happened"} <Required />
      <select className={field} defaultValue="FLOOD" name="type" required>
        {INCIDENT_TYPES.map((type) => (
          <option key={type} value={type}>{INCIDENT_TYPE_LABELS[type]}</option>
        ))}
      </select>
    </label>
  );
  const areaField = (
    <div className={labelClass}>
      {variant === "hq" ? "Districts Affected" : "Area affected"} <Required />
      <DistrictPicker districts={districts} onChange={setAreaIds} selected={areaIds} />
      {variant === "role" && <span className={hint}>Choose all districts you know are affected.</span>}
    </div>
  );

  return (
    <form className="flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      <input name="clientMutationId" type="hidden" value={clientMutationId} />
      {variant === "role" && (
        <p className="flex gap-2.5 rounded-xl border border-[var(--banner-view-line)] bg-info-bg px-3.5 py-2.5 text-[12px] text-info-text">
          <Icon className="mt-0.5 size-4 shrink-0" name="help" />
          Any signed-in user can open an incident for a society they look after. Everyone whose societies are in the area is notified straight away.
        </p>
      )}
      {variant === "hq" ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Incident name <Required />
              <input className={field} maxLength={160} name="title" placeholder="Floods — North Western" required type="text" />
            </label>
            {typeField}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {societyField}
            {areaField}
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={labelClass}>
              Starts <Required />
              <input className={field} defaultValue={localInputValue(start)} name="startedAt" required type="datetime-local" />
            </label>
            <label className={labelClass}>
              Assessments due <Required />
              <input className={field} defaultValue={localInputValue(new Date(start.getTime() + 48 * 3_600_000))} name="assessmentsDueAt" required type="datetime-local" />
            </label>
          </div>
          <div className={labelClass}>
            Rapid assessment questions
            <p className={`${field} flex items-center justify-between bg-surface-muted`}>
              Standard rapid assessment · 10 questions <Icon className="size-3.5 text-ink-soft" name="lock" strokeWidth={2.2} />
            </p>
            <span className={hint}>Question sets to be confirmed with Sarvodaya.</span>
          </div>
          <label className={labelClass}>
            Message to societies (optional)
            <input className={field} maxLength={1000} name="message" placeholder="Please send your assessment as soon as it is safe to do so." type="text" />
          </label>
          <p className="flex gap-2.5 rounded-xl border border-[var(--banner-view-line)] bg-info-bg px-3.5 py-2.5 text-[12px] text-info-text">
            <Icon className="mt-0.5 size-4 shrink-0" name="bell" />
            <span>
              <strong className="block">Notifies the people covering the area.</strong>
              Society Officers, SPCs and DDMs of the societies in these districts, their DMs and HQ get the alert. Your name and the time are recorded as the opener.
            </span>
          </p>
        </>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            {typeField}
            {societyField}
          </div>
          {areaField}
          <label className={labelClass}>
            Short description <Required />
            <input className={field} maxLength={1000} name="description" placeholder="What has happened and where" required type="text" />
          </label>
          <label className={labelClass}>
            Started <Required />
            <input className={field} defaultValue={localInputValue(start)} name="startedAt" required type="datetime-local" />
            <span className={hint}>Your name ({openerLine}) and the time are recorded as the person who opened it.</span>
          </label>
        </>
      )}
      <p className="flex gap-2.5 rounded-xl border border-[var(--warn-ring)] bg-warn-bg px-3.5 py-2.5 text-[12px] text-warn-text">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        <span>
          <strong className="block">Disaster records only.</strong>
          Assessments and actions are stored for this incident. They do not change any society record and hold no financial data.
        </span>
      </p>
      <FormError message={state.error} />
      <div className="flex gap-2.5">
        <Link className={secondaryButtonClass} href={closeHref}>Cancel</Link>
        <button className={dangerButton} disabled={pending || !societyId || !areaIds.length} type="submit">
          <Icon className="size-4" name="alert" strokeWidth={2} />
          {pending ? "Opening…" : "Open incident"}
        </button>
      </div>
    </form>
  );
}

/** − 6 + : whole numbers only, never below zero. */
function Stepper({ label, detail, value, onChange }: { label: string; detail?: string; value: number; onChange: (value: number) => void }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-lg border border-line px-3 py-2.5">
      <span>
        <strong className="block text-[12.5px] text-ink">{label}</strong>
        {detail && <span className="text-[11px] text-ink-soft">{detail}</span>}
      </span>
      <span className="flex items-center rounded-input border border-line">
        <button aria-label={`Fewer: ${label}`} className="grid size-9 place-items-center text-[16px] text-ink" onClick={() => onChange(Math.max(0, value - 1))} type="button">−</button>
        <input
          aria-label={label}
          className="w-16 border-x border-line py-1.5 text-center text-[13px] font-semibold text-ink outline-none"
          inputMode="numeric"
          min={0}
          onChange={(event) => onChange(Math.max(0, Math.min(1_000_000, Number(event.target.value.replace(/\D/g, "")) || 0)))}
          value={value}
        />
        <button aria-label={`More: ${label}`} className="grid size-9 place-items-center text-[16px] text-ink" onClick={() => onChange(Math.min(1_000_000, value + 1))} type="button">+</button>
      </span>
    </div>
  );
}

type Answers = Omit<EmergencyAssessmentInput, "clientMutationId" | "societyId" | "confirmedWithPresident">;

const EMPTY: Answers = {
  impact: "AFFECTED",
  families: 0,
  people: 0,
  housesFully: 0,
  housesPartly: 0,
  injured: 0,
  displaced: 0,
  roadAccess: "UNKNOWN",
  needs: [],
  note: "",
};

/** SHA-256 of the file in base64, which storage checks on upload. */
async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const PHOTO_TYPES = ["application/pdf", "image/jpeg", "image/png"];
const MAX_PHOTO_BYTES = 10_000_000;

/**
 * V5 IR03 (and the phone's M41–M43): a rapid assessment, one question at a
 * time, then "Check and send". The answers stay on this screen until they are
 * sent; nothing is saved for later or sent offline. Counts only.
 */
export function AssessmentWizard({
  incident,
  societies,
  initialSocietyId,
  closeHref,
  send,
  startUpload,
  completeUpload,
}: {
  incident: EmergencyIncidentSummary;
  societies: EmergencySocietyRef[];
  initialSocietyId?: string;
  closeHref: string;
  send: (incidentId: string, input: EmergencyAssessmentInput) => Promise<{ id?: string; error?: string }>;
  startUpload: (
    assessmentId: string,
    file: { contentType: string; sizeBytes: number; checksumSha256: string },
  ) => Promise<{ error?: string; evidenceId?: string; upload?: { url: string; headers: Record<string, string> } }>;
  completeUpload: (evidenceId: string) => Promise<{ error?: string }>;
}) {
  const [societyId, setSocietyId] = useState(
    societies.some((s) => s.id === initialSocietyId) ? initialSocietyId! : societies.length === 1 ? societies[0]!.id : "",
  );
  const [answers, setAnswers] = useState<Answers>(EMPTY);
  const [photos, setPhotos] = useState<File[]>([]);
  const [step, setStep] = useState(0);
  const [confirmed, setConfirmed] = useState(false);
  const [error, setError] = useState<string>();
  const [status, setStatus] = useState<string>();
  const [sent, setSent] = useState<{ photos: number; failed: number }>();
  // One id per assessment, so sending again after a dropped connection is safe.
  const [clientMutationId] = useState(() => crypto.randomUUID());
  const fileInput = useRef<HTMLInputElement>(null);
  const set = <K extends keyof Answers>(key: K, value: Answers[K]) => setAnswers((current) => ({ ...current, [key]: value }));
  const society = societies.find((s) => s.id === societyId);

  const questions = useMemo(
    () => [
      {
        title: "Is the Society Affected?",
        help: "Choose how the society's village is now.",
        body: (
          <div className="grid gap-2 sm:grid-cols-3">
            {(["SAFE", "AFFECTED", "CRITICAL"] as EmergencyImpact[]).map((impact) => (
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] ${answers.impact === impact ? "border-brand-leaf bg-brand-mint-soft font-semibold" : "border-line"}`} key={impact}>
                <input checked={answers.impact === impact} name="impact" onChange={() => set("impact", impact)} type="radio" />
                {STATE_LABELS[impact]}
              </label>
            ))}
          </div>
        ),
      },
      { title: "How Many Families Are Affected?", help: "Count families in the society's village only. Give your best estimate.", body: <Stepper label="Families affected" onChange={(v) => set("families", v)} value={answers.families} /> },
      { title: "How Many People Are Affected?", help: "Everyone in the affected families.", body: <Stepper label="People affected" onChange={(v) => set("people", v)} value={answers.people} /> },
      { title: "How Many People Are Injured?", help: "Numbers only. Never names.", body: <Stepper label="Injured" onChange={(v) => set("injured", v)} value={answers.injured} /> },
      {
        title: "How Many Houses Were Damaged?",
        help: "Count houses in the society's village only. Give your best estimate.",
        body: (
          <div className="grid gap-2">
            <Stepper detail="Cannot be lived in" label="Fully damaged" onChange={(v) => set("housesFully", v)} value={answers.housesFully} />
            <Stepper detail="Can be lived in after repair" label="Partly damaged" onChange={(v) => set("housesPartly", v)} value={answers.housesPartly} />
          </div>
        ),
      },
      { title: "How Many People Are in Safety Centres?", help: "People who had to leave their homes.", body: <Stepper label="In safety centres" onChange={(v) => set("displaced", v)} value={answers.displaced} /> },
      {
        title: "Can Vehicles Reach the Village?",
        help: "Road access now.",
        body: (
          <div className="grid gap-2 sm:grid-cols-2">
            {ROAD_ACCESS.map((road: EmergencyRoadAccess) => (
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] ${answers.roadAccess === road ? "border-brand-leaf bg-brand-mint-soft font-semibold" : "border-line"}`} key={road}>
                <input checked={answers.roadAccess === road} name="roadAccess" onChange={() => set("roadAccess", road)} type="radio" />
                {ROAD_LABELS[road]}
              </label>
            ))}
          </div>
        ),
      },
      {
        title: "What Is Most Urgently Needed?",
        help: "Choose all that apply. Items, people or tasks only — no money.",
        body: (
          <div className="grid gap-2 sm:grid-cols-2">
            {NEEDS.map((need: EmergencyNeed) => (
              <label className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2.5 text-[12.5px] ${answers.needs.includes(need) ? "border-brand-leaf bg-brand-mint-soft font-semibold" : "border-line"}`} key={need}>
                <input
                  checked={answers.needs.includes(need)}
                  onChange={(event) => set("needs", event.target.checked ? [...answers.needs, need] : answers.needs.filter((n) => n !== need))}
                  type="checkbox"
                />
                {NEED_LABELS[need]}
              </label>
            ))}
          </div>
        ),
      },
      {
        title: "Add Photos (Optional)",
        help: "PDF, JPG or PNG, up to 10 MB each. Do not photograph people's faces or documents.",
        body: (
          <div className="flex flex-col gap-2">
            <input
              accept={PHOTO_TYPES.join(",")}
              className="text-[12.5px]"
              multiple
              onChange={(event) => {
                const chosen = [...(event.target.files ?? [])];
                const bad = chosen.find((file) => !PHOTO_TYPES.includes(file.type) || file.size > MAX_PHOTO_BYTES);
                if (bad) {
                  setError("Choose PDF, JPG or PNG files of 10 MB or less.");
                  event.target.value = "";
                  return;
                }
                setError(undefined);
                setPhotos(chosen.slice(0, 10));
              }}
              ref={fileInput}
              type="file"
            />
            <span className="text-[11.5px] text-ink-soft">{photos.length ? `${photos.length} chosen` : "None chosen"}</span>
          </div>
        ),
      },
      { title: "Anything Else HQ Should Know?", help: "Optional. Do not include names or NIC numbers.", body: null },
    ],
    [answers, photos.length],
  );

  if (sent) {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center" role="status">
        <span className="grid size-12 place-items-center rounded-full bg-success-bg text-success-text">
          <Icon className="size-6" name="success" strokeWidth={2} />
        </span>
        <h3 className="text-[16px] font-bold text-ink">Assessment Sent</h3>
        <p className="text-[12.5px] text-ink-soft">
          Received for {society?.name}. HQ and everyone following {incident.reference} can see it in the live incident.
          {sent.photos ? ` ${sent.photos} ${sent.photos === 1 ? "photo" : "photos"} added.` : ""}
          {sent.failed ? ` ${sent.failed} ${sent.failed === 1 ? "photo" : "photos"} could not be added; send them with the next update.` : ""}
        </p>
        <Link className={primaryButtonClass} href={closeHref}>Done</Link>
      </div>
    );
  }

  async function sendNow() {
    if (!society) return setError("Choose the society.");
    setError(undefined);
    setStatus("Sending…");
    const result = await send(incident.id, { ...answers, clientMutationId, societyId: society.id, confirmedWithPresident: confirmed });
    if (result.error || !result.id) {
      setStatus(undefined);
      return setError(result.error ?? "The assessment could not be sent. Check your connection and try again.");
    }
    let uploaded = 0;
    let failed = 0;
    for (const [index, file] of photos.entries()) {
      setStatus(`Adding photo ${index + 1} of ${photos.length}…`);
      try {
        const started = await startUpload(result.id, { contentType: file.type, sizeBytes: file.size, checksumSha256: await sha256(file) });
        if (started.error || !started.upload || !started.evidenceId) throw new Error(started.error);
        const put = await fetch(started.upload.url, { method: "PUT", headers: started.upload.headers, body: file });
        if (!put.ok) throw new Error("upload");
        const done = await completeUpload(started.evidenceId);
        if (done.error) throw new Error(done.error);
        uploaded++;
      } catch {
        failed++;
      }
    }
    setStatus(undefined);
    setSent({ photos: uploaded, failed });
  }

  const reviewing = step === questions.length;
  const question = questions[step];
  return (
    <div className="flex flex-col gap-4">
      <label className={labelClass}>
        Society <Required />
        <select className={field} disabled={step > 0} onChange={(event) => setSocietyId(event.target.value)} value={societyId}>
          <option value="">Choose a society</option>
          {societies.map((s) => (
            <option key={s.id} value={s.id}>{s.name} · {s.code}</option>
          ))}
        </select>
        <span className={hint}>Societies you look after in the incident area.</span>
      </label>

      {reviewing ? (
        <>
          <h3 className="text-[15px] font-bold text-ink">Check Before Sending</h3>
          <dl className="divide-y divide-line-soft rounded-lg border border-line text-[12.5px]">
            {[
              ["What happened", INCIDENT_TYPE_LABELS[incident.type]],
              ["Society", STATE_LABELS[answers.impact]],
              ["Families affected", answers.families],
              ["People affected", answers.people],
              ["Houses fully / partly damaged", `${answers.housesFully} / ${answers.housesPartly}`],
              ["Injured", answers.injured],
              ["In safety centres", answers.displaced],
              ["Road access", ROAD_LABELS[answers.roadAccess]],
              ["Most urgent needs", answers.needs.map((n) => NEED_LABELS[n]).join(", ") || "None"],
              ["Photos", photos.length],
            ].map(([label, value]) => (
              <div className="flex justify-between gap-3 px-3 py-2.5" key={String(label)}>
                <dt className="text-ink-soft">{label}</dt>
                <dd className="text-right font-semibold text-ink">{value}</dd>
              </div>
            ))}
          </dl>
          <p className="flex gap-2.5 rounded-xl border border-[var(--warn-ring)] bg-warn-bg px-3.5 py-2.5 text-[12px] text-warn-text">
            <Icon className="mt-0.5 size-4 shrink-0" name="help" />
            Only counts are sent — no names or NIC numbers of affected families.
          </p>
          <label className="flex items-center gap-2 text-[12.5px] text-ink">
            <input checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} type="checkbox" />
            I checked these answers with the society President.
          </label>
        </>
      ) : (
        <>
          <p className="text-[10.5px] font-bold tracking-[0.08em] text-brand-forest">Question {step + 1} of {questions.length}</p>
          <h3 className="text-[16px] font-bold text-ink">{question!.title}</h3>
          <p className="-mt-2 text-[12px] text-ink-soft">{question!.help}</p>
          {question!.body}
          <label className={labelClass}>
            Note (optional)
            <input className={field} maxLength={1000} onChange={(event) => set("note", event.target.value)} placeholder="For example, water is going down on the main road." type="text" value={answers.note} />
          </label>
        </>
      )}

      <p className="flex gap-2.5 rounded-xl border border-line bg-surface-muted px-3.5 py-2.5 text-[12px] text-ink-soft">
        <Icon className="mt-0.5 size-4 shrink-0" name="help" />
        This is a disaster record. It does not change the society record (members, Exco or plan). Answers stay on this screen until you send them.
      </p>
      <FormError message={error} />
      {status && <p className="text-[12px] font-semibold text-ink-soft" role="status">{status}</p>}
      <div className="flex gap-2.5">
        {step === 0 ? (
          <Link className={secondaryButtonClass} href={closeHref}>Cancel</Link>
        ) : (
          <button className={secondaryButtonClass} disabled={!!status} onClick={() => setStep(step - 1)} type="button">Back</button>
        )}
        {reviewing ? (
          <button className={primaryButtonClass} disabled={!!status} onClick={sendNow} type="button">Send assessment</button>
        ) : (
          <button className={primaryButtonClass} disabled={!societyId} onClick={() => setStep(step + 1)} type="button">
            {step === questions.length - 1 ? "Check answers" : "Next question"}
          </button>
        )}
      </div>
    </div>
  );
}

/** V5 D32: choose the societies that will help with a need and what each provides. */
export function AssignHelpersForm({
  action,
  need,
  candidates,
  incidentId,
  now,
}: {
  action: (state: IncidentFormState, form: FormData) => Promise<IncidentFormState>;
  need: EmergencyResponseAction;
  candidates: EmergencyHelpingCandidate[];
  incidentId: string;
  now: Date;
}) {
  const [state, submit, pending] = useActionState(action, {});
  const [chosen, setChosen] = useState<string[]>([]);
  const already = new Set(need.helpers.map((h) => h.society.id));
  const options = candidates.filter((c) => !already.has(c.society.id));
  const due = need.dueAt ? new Date(need.dueAt) : new Date(now.getTime() + 24 * 3_600_000);
  return (
    <form className="flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      <input name="incidentId" type="hidden" value={incidentId} />
      <input name="actionId" type="hidden" value={need.id} />
      <fieldset className="flex flex-col gap-1">
        <legend className={labelClass}>Societies That Will Help <Required /></legend>
        {options.length ? (
          <ul className="mt-1 divide-y divide-line-soft rounded-lg border border-line">
            {options.map((candidate) => {
              const id = candidate.society.id;
              const on = chosen.includes(id);
              const affected = candidate.state === "AFFECTED" || candidate.state === "CRITICAL";
              return (
                <li className="flex items-center gap-3 px-3 py-2.5" key={id}>
                  <input
                    aria-label={candidate.society.name}
                    checked={on}
                    name="helper"
                    onChange={(event) => setChosen(event.target.checked ? [...chosen, id] : chosen.filter((c) => c !== id))}
                    type="checkbox"
                    value={id}
                  />
                  <span className="min-w-0 flex-1">
                    <strong className="block text-[12.5px] text-ink">{candidate.society.name}</strong>
                    <span className={`text-[11px] ${affected ? "text-danger-text" : "text-ink-soft"}`}>
                      {candidate.society.districtName} · {affected ? "affected by this incident" : candidate.state === "SAFE" ? "not affected" : "not assessed yet"}
                      {candidate.distanceKm !== null ? ` · ${candidate.distanceKm} km away` : ""}
                    </span>
                  </span>
                  {on && (
                    <label className="text-right text-[11px] text-ink-soft">
                      Provides
                      <input
                        className="mt-0.5 block w-24 rounded-input border border-line px-2 py-1.5 text-right text-[12.5px] text-ink"
                        defaultValue={Math.max(1, need.quantity - need.helpers.reduce((sum, h) => sum + h.quantity, 0))}
                        min={1}
                        name={`quantity-${id}`}
                        required
                        type="number"
                      />
                      <span>{need.unit}</span>
                    </label>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="rounded-lg bg-surface-muted px-3 py-3 text-[12.5px] text-ink-soft">No other active societies in the area or the district.</p>
        )}
      </fieldset>
      <label className={labelClass}>
        Deliver by <Required />
        <input className={field} defaultValue={localInputValue(due)} name="dueAt" required type="datetime-local" />
      </label>
      <label className={labelClass}>
        Note to the helping societies (optional)
        <input className={field} maxLength={1000} name="note" placeholder="For example, which road is open" type="text" />
      </label>
      <p className="flex gap-2.5 rounded-xl border border-[#c6e2cd] bg-success-bg px-3.5 py-2.5 text-[12px] text-success-text">
        <Icon className="mt-0.5 size-4 shrink-0" name="clock" />
        The helping societies and {need.forSociety?.name ?? "the society in need"} are notified. Assigned by you (HQ) with the time, in the incident history.
      </p>
      <FormError message={state.error} />
      <div className="flex gap-2.5">
        <Link className={secondaryButtonClass} href={`/emergencies/${incidentId}?tab=actions`}>Cancel</Link>
        <button className={primaryButtonClass} disabled={pending || !chosen.length} type="submit">
          {pending ? "Assigning…" : `Assign ${chosen.length || ""} ${chosen.length === 1 ? "society" : "societies"}`.replace("  ", " ")}
        </button>
      </div>
    </form>
  );
}

/** V5 D32 "Needed": HQ records what a society needs. Items, people or tasks only. */
export function AddNeedForm({
  action,
  incidentId,
  societies,
}: {
  action: (state: IncidentFormState, form: FormData) => Promise<IncidentFormState>;
  incidentId: string;
  societies: EmergencySocietyRef[];
}) {
  const [state, submit, pending] = useActionState(action, {});
  const [need, setNeed] = useState<EmergencyNeed>("DRINKING_WATER");
  const [title, setTitle] = useState(NEED_LABELS.DRINKING_WATER);
  return (
    <form className="flex flex-col gap-4" onSubmit={submitWithoutReset(submit)}>
      <input name="incidentId" type="hidden" value={incidentId} />
      <label className={labelClass}>
        For society <Required />
        <select className={field} defaultValue="" name="societyId" required>
          <option value="">Choose a society</option>
          {societies.map((s) => (
            <option key={s.id} value={s.id}>{s.name} · {s.districtName}</option>
          ))}
        </select>
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Need <Required />
          <select
            className={field}
            name="need"
            onChange={(event) => {
              const value = event.target.value as EmergencyNeed;
              if (title === NEED_LABELS[need]) setTitle(NEED_LABELS[value]);
              setNeed(value);
            }}
            value={need}
          >
            {NEEDS.map((value) => (
              <option key={value} value={value}>{NEED_LABELS[value]}</option>
            ))}
          </select>
        </label>
        <label className={labelClass}>
          What <Required />
          <input className={field} maxLength={160} name="title" onChange={(event) => setTitle(event.target.value)} required type="text" value={title} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={labelClass}>
          Quantity <Required />
          <input className={field} min={1} name="quantity" required type="number" />
        </label>
        <label className={labelClass}>
          Unit
          <input className={field} maxLength={30} name="unit" placeholder="L, packs, people, tarpaulins" type="text" />
        </label>
      </div>
      <label className={labelClass}>
        Needed by (optional)
        <input className={field} name="dueAt" type="datetime-local" />
      </label>
      <FormError message={state.error} />
      <div className="flex gap-2.5">
        <Link className={secondaryButtonClass} href={`/emergencies/${incidentId}?tab=actions`}>Cancel</Link>
        <button className={primaryButtonClass} disabled={pending} type="submit">{pending ? "Adding…" : "Add need"}</button>
      </div>
    </form>
  );
}

/** V5 D33 "Download PDF": the browser's print dialog, which saves the report as a PDF. */
export function PrintReportButton() {
  return (
    <button className={primaryButtonClass} onClick={() => window.print()} type="button">
      <Icon className="size-4" name="document" strokeWidth={2} />
      Download PDF
    </button>
  );
}

/** V5 D33 report picker: choosing a number opens that report. */
export function ReportPicker({ incidentId, reports, current }: { incidentId: string; reports: { id: string; number: number; asOf: string; label: string }[]; current?: string }) {
  return (
    <label className="text-[12px] font-semibold text-ink">
      Report
      <select
        className={`${field} min-w-[240px]`}
        onChange={(event) => window.location.assign(`/emergencies/${incidentId}?tab=reports&report=${event.target.value}`)}
        value={current}
      >
        {reports.map((report) => (
          <option key={report.id} value={report.id}>No. {report.number} · {report.label}</option>
        ))}
      </select>
    </label>
  );
}

