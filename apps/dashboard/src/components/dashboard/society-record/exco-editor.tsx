"use client";

import { useMemo, useState } from "react";

import type { CommitteeMember, MembershipCategory } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";

export const OFFICE_BEARERS = ["President", "Secretary", "Treasurer"] as const;

export const EXCO_SEATS = 25;

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

/**
 * The 25 seats for Edit Exco: members already entered keep their seat and
 * group; each empty seat gets a group that still has room, so filling it can
 * never go over 3 children, 3 youth, 3 mothers, 9 ordinary or 7 elders.
 */
export function excoFromCommittee(members: CommitteeMember[]): ExcoRow[] {
  const active = members.filter((member) => member.isActive && member.seatNumber);
  const room = new Map<MembershipCategory, number>();
  for (const seatType of NEW_SOCIETY_SEATS) room.set(seatType, (room.get(seatType) ?? 0) + 1);
  for (const member of active) if (member.seatType) room.set(member.seatType, (room.get(member.seatType) ?? 0) - 1);
  const groupForEmptySeat = (index: number) => {
    const preferred = NEW_SOCIETY_SEATS[index]!;
    const seatType = (room.get(preferred) ?? 0) > 0 ? preferred : (NEW_SOCIETY_SEATS.find((type) => (room.get(type) ?? 0) > 0) ?? preferred);
    room.set(seatType, (room.get(seatType) ?? 0) - 1);
    return seatType;
  };
  return Array.from({ length: EXCO_SEATS }, (_, index) => {
    const member = active.find((item) => item.seatNumber === index + 1);
    return {
      seatNumber: index + 1,
      seatType: member?.seatType ?? groupForEmptySeat(index),
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

/** A seat with nothing typed in it: it is left out when the Exco is saved. */
export function rowEmpty(row: ExcoRow) {
  return ![row.fullName, row.dateOfBirth, row.profession, row.phone, row.addressLine, row.nic].some((value) => value.trim());
}

/** A seat that will be saved: it has the member's full name. */
export function rowFilled(row: ExcoRow) {
  return row.fullName.trim().length >= 2;
}

/** A filled seat with every detail the Exco keeps (V5 M07e): name, NIC, date of birth, profession, phone and address. */
export function rowComplete(row: ExcoRow) {
  return (
    rowFilled(row) &&
    Boolean(row.dateOfBirth) &&
    Boolean(row.nic.trim() || row.nicMasked) &&
    Boolean(row.profession.trim()) &&
    Boolean(row.addressLine.trim()) &&
    Boolean(row.phone.trim())
  );
}

/**
 * Problems that stop saving, in plain words (V5 D05c error banner). The Exco
 * can be saved while it is still being entered: empty seats are left out, and
 * a missing office bearer leaves it incomplete rather than blocking the save
 * (see excoStillMissing). The API checks the same rules, plus each seat
 * group's number and age range.
 */
export function excoProblems(rows: ExcoRow[], today = new Date().toISOString().slice(0, 10)) {
  const problems: string[] = [];
  for (const row of rows) {
    if (!rowFilled(row) && !rowEmpty(row)) problems.push(`Seat ${row.seatNumber}: enter the full name, or clear the seat.`);
  }
  for (const office of OFFICE_BEARERS) {
    const holders = rows.filter((row) => row.position === office);
    if (holders.length > 1) problems.push(`Choose only one ${office}.`);
    const empty = holders.find((row) => !rowFilled(row));
    if (empty) problems.push(`Seat ${empty.seatNumber} is the ${office}: enter their name, or choose another member.`);
  }
  for (const row of rows) {
    if (row.dateOfBirth && row.dateOfBirth > today) problems.push(`Seat ${row.seatNumber}: the date of birth is in the future.`);
    if (row.nic && !NIC.test(row.nic.trim())) problems.push(`Seat ${row.seatNumber}: enter a valid NIC (9 digits and V or X, or 12 digits).`);
  }
  return problems;
}

/**
 * What would still keep the Exco incomplete after saving these seats, in the
 * API's words: seats to fill and office bearers not chosen. It does not stop
 * saving; the record shows the API's own status once saved.
 */
export function excoStillMissing(rows: ExcoRow[]) {
  const filled = rows.filter(rowFilled);
  const missing: string[] = [];
  const toFill = EXCO_SEATS - filled.length;
  if (filled.length === 0) return ["No Exco members have been entered yet."];
  if (toFill > 0) missing.push(`${toFill} of ${EXCO_SEATS} ${toFill === 1 ? "seat is" : "seats are"} still to fill.`);
  const offices = OFFICE_BEARERS.filter((office) => !filled.some((row) => row.position === office));
  if (offices.length) missing.push(`No ${offices.join(", ").replace(/, ([^,]*)$/, " or $1")} chosen yet.`);
  return missing;
}

/** Ready for the API: the filled seats, without display-only fields. Empty seats are left out. */
export function excoPayload(rows: ExcoRow[]) {
  return rows.filter(rowFilled).map((row) => ({
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
 * Edit Exco: all 25 seats in one table. Office bearers are chosen from the
 * members. The Society Officer can save at any time and come back to fill the
 * rest; the record shows the Exco as incomplete until all 25 seats and the
 * three office bearers are in.
 */
export function ExcoEditor({
  focusOffices = false,
  name = "council",
  rows,
  setRows,
}: {
  focusOffices?: boolean;
  /** The hidden form field that carries the seats as JSON. */
  name?: string;
  rows: ExcoRow[];
  setRows: (rows: ExcoRow[]) => void;
}) {
  const [showAll, setShowAll] = useState(true);
  const filled = rows.filter(rowFilled).length;
  const stillMissing = excoStillMissing(rows);
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
  const visible = showAll ? rows : rows.filter((row) => !rowComplete(row) || OFFICE_BEARERS.includes(row.position as never));

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_280px]">
      <input name={name} type="hidden" value={payload} />
      <section className="overflow-hidden rounded-card border border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-3">
          <h3 className="text-[15px] font-bold text-ink">Exco · 25 Members</h3>
          <button className="text-[12px] text-ink-soft underline underline-offset-2" onClick={() => setShowAll((all) => !all)} type="button">
            {showAll ? "Show only office bearers and seats still to complete" : "Show all 25"}
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
                const complete = rowComplete(row);
                const filledSeat = rowFilled(row);
                // Typed details without a name stop saving; an empty seat is simply left for later.
                const needsName = !filledSeat && !rowEmpty(row);
                const label = (field: string) => `Seat ${row.seatNumber} ${field}`;
                return (
                  <tr className={needsName ? "bg-[var(--banner-incident-bg)]" : ""} key={row.seatNumber}>
                    <td className={`py-1.5 pl-4 pr-2 font-semibold ${needsName ? "text-danger-text" : "text-ink-soft"}`}>{row.seatNumber}</td>
                    <td className="px-2 py-1.5 text-[11px] text-ink-soft">{SEAT_GROUP_LABELS[row.seatType]}</td>
                    <td className="px-2 py-1.5">
                      <input aria-label={label("full name")} className={`${cell} min-w-[160px]`} maxLength={150} onChange={(event) => update(row.seatNumber, "fullName", event.target.value)} placeholder={filledSeat ? undefined : "Not entered yet"} value={row.fullName} />
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
                      ) : needsName ? (
                        <span className="text-[11px] font-semibold text-danger-text">Name needed</span>
                      ) : filledSeat ? (
                        <span className="whitespace-nowrap text-[11px] font-semibold text-warn-text">Details to add</span>
                      ) : (
                        <span className="text-[11px] text-muted">Empty</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="border-t border-line-soft px-4 py-2 text-[11px] text-ink-soft">
          Save at any time: empty seats are left for later. Each seat needs a full name to be saved, and should also have the NIC, date of birth,
          profession, phone and address. The age is worked out from the date of birth. NICs are stored encrypted and shown only on request.
        </p>
      </section>
      <aside className="flex flex-col gap-4">
        <section className="rounded-card border border-line bg-surface p-4">
          <h3 className="text-[15px] font-bold text-ink">Progress</h3>
          <p className={`mt-2 text-[26px] font-bold ${stillMissing.length === 0 ? "text-brand-action" : "text-[#b8860b]"}`}>{filled} / 25</p>
          {/* V5 PR 10: the count as words, never a progress bar. */}
          {stillMissing.length === 0 ? (
            <p className="mt-1 text-[12px] text-ink-soft">All 25 seats and the three office bearers are in. Saving completes the Exco.</p>
          ) : (
            <>
              <ul className="mt-1 list-disc pl-4 text-[12px] text-ink-soft">
                {stillMissing.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <p className="mt-1 text-[12px] text-ink-soft">You can save now and finish later. The Exco shows as incomplete until all of this is done.</p>
            </>
          )}
        </section>
        <section className="rounded-card border border-line bg-surface p-4">
          <h3 className="text-[15px] font-bold text-ink">Office Bearers</h3>
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
          <p className="mt-3 text-[12px] text-ink-soft">Chosen from the Exco members. The Exco is not complete until all three are chosen.</p>
        </section>
      </aside>
    </div>
  );
}
