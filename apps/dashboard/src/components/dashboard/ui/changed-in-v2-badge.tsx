/**
 * Orange annotation badge from the Screen Catalogue v3 marking sections that
 * changed between v1 and v2 of the design. Used as a passive marker, not an
 * interactive control.
 */
export function ChangedInV2Badge({ label = "Changed in v2" }: { label?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-pill bg-orange-changed-soft px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-orange-changed">
      <span aria-hidden="true" className="size-1.5 rounded-full bg-current" />
      {label}
    </span>
  );
}
