"use client";

import { useMemo, useState } from "react";

import type { CommitteeMember, MembershipCategory } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";

export const OFFICE_BEARERS = ["President", "Secretary", "Treasurer"] as const;

/** Names for the seat groups the API requires (3 children, 3 youth, 3 mothers, 9 ordinary, 7 elders). */
export const SEAT_GROUP_LABELS: Record<MembershipCategory, string> = {
  CHILDREN: "Children (7–14)",
  YOUTH: "Youth (15–25)",
  MOTHERS: "Mothers",
  ORDINARY: "Ordinary",
  ELDERS_COUNCIL: "Elders' council",
};

/** Seat groups for a new society, in seat order: office bearers sit in ordinary seats. */
const NEW_SOCIETY_SEATS: MembershipCategory[] = [
  ...Array<MembershipCategory>(9).fill("ORDINARY"),
  ...Array<MembershipCategory>(7).fill("ELDERS_COUNCIL"),
  ...Array<MembershipCategory>(3).fill("MOTHERS"),
  ...Array<MembershipCategory>(3).fill("YOUTH"),
  ...Array<MembershipCategory>(3).fill("CHILDREN"),
];

export type ExcoRow = {
  seatNumber: number;
  seatType: MembershipCategory;
  fullName: string;
  position: string;
  dateOfBirth: string;
  profession: string;
  phone: string;
  addressLine: string;
  /** A new NIC to store through the NIC vault; never pre-filled. */
  nic: string;
  /** The stored NIC, masked, in edit mode. */
  nicMasked?: string;
  email?: string;
  appointedOn?: string;
};

export function emptyExco(): ExcoRow[] {
  return NEW_SOCIETY_SEATS.map((seatType, index) => ({
    seatNumber: index + 1,
    seatType,
    fullName: "",
    position: OFFICE_BEARERS[index] ?? "Member",
    dateOfBirth: "",
    profession: "",
    phone: "",
    addressLine: "",
    nic: "",
  }));
}

export function excoFromCommittee(members: CommitteeMember[]): ExcoRow[] {
  const active = members.filter((member) => member.isActive && member.seatNumber);
  return Array.from({ length: 25 }, (_, index) => {
    const member = active.find((item) => item.seatNumber === index + 1);
    return {
      seatNumber: index + 1,
      seatType: member?.seatType ?? NEW_SOCIETY_SEATS[index]!,
      fullName: member?.fullName ?? "",
      position: member?.position ?? "Member",
      dateOfBirth: member?.dateOfBirth ?? "",
      profession: member?.profession ?? "",
      phone: member?.phone ?? "",
      addressLine: member?.addressLine ?? "",
      nic: "",
      nicMasked: member?.nicMasked,
      email: member?.email,
      appointedOn: member?.appointedOn,
    };
  });
}

const NIC = /^(?:[0-9]{9}[vVxX]|[0-9]{12})$/;

/**
 * "create": a new society's seats must be complete records (V5 D05c, M07e).
 * "edit": older societies may lack some details, so a name and date of birth
 * are enough to save.
 */
export type ExcoMode = "create" | "edit";

export function rowComplete(row: ExcoRow, mode: ExcoMode = "edit") {
  const basic = row.fullName.trim().length >= 2 && Boolean(row.dateOfBirth);
  if (mode === "edit") return basic;
  return (
    basic &&
    Boolean(row.nic.trim() || row.nicMasked) &&
    Boolean(row.profession.trim()) &&
    Boolean(row.addressLine.trim()) &&
    Boolean(row.phone.trim())
  );
}

/** Problems that stop saving, in plain words (V5 D05c error banner). */
export function excoProblems(rows: ExcoRow[], mode: ExcoMode = "edit", today = new Date().toISOString().slice(0, 10)) {
  const problems: string[] = [];
  const filled = rows.filter((row) => rowComplete(row, mode)).length;
  if (filled < 25)
    problems.push(`Every society must have exactly 25 Exco members. ${filled} are entered — enter the rest to continue.`);
  for (const office of OFFICE_BEARERS) {
    const count = rows.filter((row) => row.position === office).length;
    if (count !== 1) problems.push(count ? `Choose only one ${office}.` : `Choose the ${office} from the 25 members.`);
  }
  for (const row of rows) {
    if (row.dateOfBirth && row.dateOfBirth > today) problems.push(`Seat ${row.seatNumber}: the date of birth is in the future.`);
    if (row.nic && !NIC.test(row.nic.trim())) problems.push(`Seat ${row.seatNumber}: enter a valid NIC (9 digits and V or X, or 12 digits).`);
  }
  return problems;
}

/** Ready for the API: seat rows without display-only fields. */
export function excoPayload(rows: ExcoRow[]) {
  return rows.map((row) => ({
    seatNumber: row.seatNumber,
    seatType: row.seatType,
    fullName: row.fullName.trim(),
    position: row.position,
    dateOfBirth: row.dateOfBirth || undefined,
    profession: row.profession.trim() || undefined,
    phone: row.phone.trim() || undefined,
    addressLine: row.addressLine.trim() || undefined,
    email: row.email || undefined,
    appointedOn: row.appointedOn || undefined,
    nic: row.nic.trim() ? row.nic.trim().toUpperCase() : undefined,
    isActive: true,
    isPrimaryContact: row.position === "President",
  }));
}

function ageFrom(dateOfBirth: string) {
  if (!dateOfBirth) return "—";
  const born = new Date(`${dateOfBirth}T00:00:00Z`);
  const now = new Date();
  let age = now.getUTCFullYear() - born.getUTCFullYear();
  if (now.getUTCMonth() < born.getUTCMonth() || (now.getUTCMonth() === born.getUTCMonth() && now.getUTCDate() < born.getUTCDate())) age -= 1;
  return age >= 0 ? String(age) : "—";
}

const cell = "w-full rounded-md border border-line bg-surface px-2 py-1.5 text-[12px] outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

/**
 * V5 D05c / Edit Exco: all 25 seats in one table. Office bearers are chosen
 * from the 25 members. Saving is blocked until every seat is filled; the API
 * checks the same rules.
 */
export function ExcoEditor({
  focusOffices = false,
  mode = "edit",
  name = "council",
  rows,
  setRows,
}: {
  focusOffices?: boolean;
  mode?: ExcoMode;
  /** The hidden form field that carries the seats as JSON. */
  name?: string;
  rows: ExcoRow[];
  setRows: (rows: ExcoRow[]) => void;
}) {
  const [showAll, setShowAll] = useState(true);
  const filled = rows.filter((row) => rowComplete(row, mode)).length;
  const payload = useMemo(() => JSON.stringify(excoPayload(rows)), [rows]);
  const update = (seat: number, key: keyof ExcoRow, value: string) =>
    setRows(rows.map((row) => (row.seatNumber === seat ? { ...row, [key]: value } : row)));
  const chooseOffice = (seat: number, office: string) =>
    setRows(
      rows.map((row) =>
        row.seatNumber === seat
          ? { ...row, position: office }
          : // An office is held by one member, so the previous holder becomes a member.
            row.position === office && office !== "Member"
            ? { ...row, position: "Member" }
            : row,
      ),
    );
  const visible = showAll ? rows : rows.filter((row) => !rowComplete(row, mode) || OFFICE_BEARERS.includes(row.position as never));

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <input name={name} type="hidden" value={payload} />
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[15px] font-bold text-ink">Exco · 25 members</h3>
          <button className="text-[12px] text-ink-soft underline underline-offset-2" onClick={() => setShowAll((all) => !all)} type="button">
            {showAll ? "Show only office bearers and empty seats" : "Show all 25"}
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1400px] text-left text-[12px]">
            <thead className="bg-surface-muted text-[11px] text-ink-soft">
              <tr>
                {["No.", "Group", "Full name", "Office", "NIC", "Date of birth", "Age", "Profession", "Phone", "Address", ""].map((heading, index) => (
                  <th className="px-2 py-2 font-semibold first:pl-4" key={`${heading}-${index}`} scope="col">{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {visible.map((row) => {
                const complete = rowComplete(row, mode);
                const label = (field: string) => `Seat ${row.seatNumber} ${field}`;
                return (
                  <tr className={complete ? "" : "bg-[var(--banner-incident-bg)]"} key={row.seatNumber}>
                    <td className={`py-1.5 pl-4 pr-2 font-semibold ${complete ? "text-ink-soft" : "text-danger-text"}`}>{row.seatNumber}</td>
                    <td className="px-2 py-1.5 text-[11px] text-ink-soft">{SEAT_GROUP_LABELS[row.seatType]}</td>
                    <td className="px-2 py-1.5">
                      <input aria-label={label("full name")} className={`${cell} min-w-[160px]`} maxLength={150} onChange={(event) => update(row.seatNumber, "fullName", event.target.value)} placeholder="Required" value={row.fullName} />
                    </td>
                    <td className="px-2 py-1.5">
                      <select
                        aria-label={label("office")}
                        autoFocus={focusOffices && row.seatNumber === 1}
                        className={`${cell} min-w-[115px]`}
                        onChange={(event) => chooseOffice(row.seatNumber, event.target.value)}
                        value={OFFICE_BEARERS.includes(row.position as never) ? row.position : "Member"}
                      >
                        {[...OFFICE_BEARERS, "Member"].map((office) => (
                          <option key={office}>{office}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-2 py-1.5">
                      <input
                        aria-label={label("NIC")}
                        autoComplete="off"
                        className={`${cell} min-w-[130px] font-mono`}
                        maxLength={12}
                        onChange={(event) => update(row.seatNumber, "nic", event.target.value)}
                        placeholder={row.nicMasked ? `${row.nicMasked} · new` : "Optional"}
                        value={row.nic}
                      />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label={label("date of birth")} className={`${cell} min-w-[140px]`} max={new Date().toISOString().slice(0, 10)} onChange={(event) => update(row.seatNumber, "dateOfBirth", event.target.value)} type="date" value={row.dateOfBirth} />
                    </td>
                    <td className="px-2 py-1.5 text-ink-soft">{ageFrom(row.dateOfBirth)}</td>
                    <td className="px-2 py-1.5">
                      <input aria-label={label("profession")} className={`${cell} min-w-[120px]`} maxLength={100} onChange={(event) => update(row.seatNumber, "profession", event.target.value)} value={row.profession} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label={label("phone")} className={`${cell} min-w-[120px]`} inputMode="tel" maxLength={30} onChange={(event) => update(row.seatNumber, "phone", event.target.value)} value={row.phone} />
                    </td>
                    <td className="px-2 py-1.5">
                      <input aria-label={label("address")} className={`${cell} min-w-[150px]`} maxLength={255} onChange={(event) => update(row.seatNumber, "addressLine", event.target.value)} value={row.addressLine} />
                    </td>
                    <td className="px-2 py-1.5">
                      {complete ? (
                        <span className="text-brand-action">
                          <Icon className="size-4" name="success" strokeWidth={2} />
                          <span className="sr-only">Complete</span>
                        </span>
                      ) : (
                        <span className="text-[11px] font-semibold text-danger-text">Required</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line-soft px-4 py-2 text-[11px] text-ink-soft">
          {mode === "create"
            ? "Every seat needs a full name, NIC, date of birth, profession, phone and address."
            : "A full name and date of birth are needed for each seat."}{" "}
          The age is worked out from the date of birth. NICs are stored encrypted and shown only on request.
        </p>
      </section>
      <aside className="flex flex-col gap-4">
        <section className="rounded-card border border-line bg-surface p-4">
          <h3 className="text-[15px] font-bold text-ink">Progress</h3>
          <p className={`mt-2 text-[26px] font-bold ${filled === 25 ? "text-brand-action" : "text-[#b8860b]"}`}>{filled} / 25</p>
          {/* V5 PR 10: the count as words, never a progress bar. */}
          <p className="mt-1 text-[12px] text-ink-soft">
            {filled === 25 ? "All 25 seats are filled." : `${25 - filled} ${25 - filled === 1 ? "seat" : "seats"} still to fill. All 25 are required.`}
          </p>
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h3 className="text-[15px] font-bold text-ink">Office bearers</h3>
          <ul className="mt-2 space-y-1 text-[12.5px]">
            {OFFICE_BEARERS.map((office) => {
              const holder = rows.find((row) => row.position === office);
              return (
                <li className={holder ? "text-brand-action" : "text-danger-text"} key={office}>
                  {holder ? "✓" : "✕"} {office} {holder ? `· ${holder.fullName || `seat ${holder.seatNumber}`}` : "not chosen"}
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-[12px] text-ink-soft">Chosen from the 25 members.</p>
        </section>
      </aside>
    </div>
  );
}
