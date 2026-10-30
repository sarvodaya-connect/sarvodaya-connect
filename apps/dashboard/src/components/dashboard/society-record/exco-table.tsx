"use client";

import { useEffect, useState } from "react";

import type { CommitteeMember } from "@sarvodaya-connect/api-contracts";

import { Icon } from "../icon";

const OFFICES = ["President", "Secretary", "Treasurer"];
const HIDE_AFTER_SECONDS = 30;

/** D05x NIC cell: masked by default; "Show" reveals it for 30 seconds. */
function NicCell({
  masked,
  reveal,
}: {
  masked?: string;
  reveal: () => Promise<{ nic?: string; error?: string }>;
}) {
  const [nic, setNic] = useState<string>();
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!nic) return;
    const timer = setInterval(() => {
      setSeconds((left) => {
        if (left <= 1) {
          setNic(undefined);
          return 0;
        }
        return left - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [nic]);

  if (!masked) return <span className="text-muted">Not recorded</span>;
  if (nic) {
    return (
      <span className="inline-flex items-center gap-2">
        <span className="rounded bg-[#fff6d9] px-1.5 py-0.5 font-mono text-[11px] font-semibold text-ink">{nic}</span>
        <span className="text-[10px] text-warn-text">hides in 0:{String(seconds).padStart(2, "0")}</span>
        <button className="text-[11px] text-brand-leaf underline" onClick={() => setNic(undefined)} type="button">
          Hide
        </button>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-2">
      <span className="font-mono text-[11px] tracking-wider text-ink-soft">{masked.replace("••••", "•••• •••• ")}</span>
      <button
        className="text-[11px] font-semibold text-brand-leaf underline underline-offset-2 disabled:opacity-60"
        disabled={busy}
        onClick={async () => {
          setBusy(true);
          setError(undefined);
          const result = await reveal();
          setBusy(false);
          if (result.nic) {
            setNic(result.nic);
            setSeconds(HIDE_AFTER_SECONDS);
          } else setError(result.error ?? "The NIC could not be shown.");
        }}
        type="button"
      >
        {busy ? "Showing…" : "Show"}
      </button>
      {error && <span className="text-[10px] text-danger-text" role="alert">{error}</span>}
    </span>
  );
}

/** D05x: the society's Exco, office bearers first, with NICs masked. */
export function ExcoTable({
  members,
  revealNic,
}: {
  members: CommitteeMember[];
  revealNic: (memberId: string) => Promise<{ nic?: string; error?: string }>;
}) {
  const active = members
    .filter((member) => member.isActive)
    .sort((a, b) => (a.seatNumber ?? 99) - (b.seatNumber ?? 99));
  const complete = active.length === 25;
  return (
    <>
      <p className="mt-4 flex items-start gap-2 rounded-lg border border-[#c6e2cd] bg-[#eef6ef] px-3 py-2 text-[11px] text-ink-soft">
        <Icon className="mt-0.5 size-3.5 shrink-0 text-brand-leaf" name="shield" />
        <span>
          <strong>Personal details.</strong> You can see them because HQ has national access. NIC numbers stay hidden until you
          choose “Show”, and hide again after {HIDE_AFTER_SECONDS} seconds.
        </span>
      </p>
      <div className="mt-4 flex items-center gap-2">
        <h3 className="text-[13px] font-bold text-ink">{active.length} of 25 Exco members</h3>
        <span
          className={`rounded-pill px-2 py-0.5 text-[10px] font-semibold ${
            complete ? "bg-success-bg text-success-text" : "bg-danger-bg text-danger-text"
          }`}
        >
          {complete ? "✓ Complete" : `${25 - active.length} missing`}
        </span>
      </div>
      {active.length === 0 ? (
        <p className="mt-3 rounded-card border border-line bg-surface px-5 py-8 text-center text-[12px] text-muted">
          No Exco members have been recorded for this society yet.
        </p>
      ) : (
        <div className="mt-3 overflow-x-auto rounded-card border border-line bg-surface">
          <table className="w-full min-w-[720px] text-left text-[11px]">
            <thead className="bg-[#f6f7f4] text-[10px] text-muted">
              <tr>
                {["No.", "Name and office", "NIC", "Age", "Phone"].map((heading) => (
                  <th className="px-4 py-2 font-medium" key={heading}>{heading}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {active.map((member, index) => (
                <tr key={member.id}>
                  <td className="px-4 py-2.5 text-ink-soft">{member.seatNumber ?? index + 1}</td>
                  <td className="px-4 py-2.5 text-ink">
                    {member.fullName}
                    {OFFICES.includes(member.position) && (
                      <span className="ml-2 rounded-pill bg-info-bg px-2 py-0.5 text-[9px] font-semibold text-info-text">
                        ● {member.position}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-2.5">
                    <NicCell masked={member.nicMasked} reveal={() => revealNic(member.id)} />
                  </td>
                  <td className="px-4 py-2.5 text-ink-soft">{member.age ?? "—"}</td>
                  <td className="px-4 py-2.5 text-ink-soft">{member.phone ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line-soft px-4 py-2 text-[10px] text-muted">
            Office bearers are chosen from these members. Every NIC shown is recorded in the change &amp; access log.
          </p>
        </div>
      )}
    </>
  );
}
