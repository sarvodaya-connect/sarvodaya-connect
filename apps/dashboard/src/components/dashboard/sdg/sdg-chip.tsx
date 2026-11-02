import { SDG_COLOURS, sdgName } from "@/lib/sdg";

/** SP06 "Approved recently": the goal number in its colour and the full title. */
export function SdgChip({ sdg }: { sdg: number }) {
  const colour = SDG_COLOURS[sdg] ?? "#5b6b62";
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full border bg-surface py-0.5 pl-0.5 pr-2 text-[10px] font-semibold text-ink"
      style={{ borderColor: colour }}
    >
      <span
        aria-hidden
        className="inline-flex size-4 items-center justify-center rounded-full text-[9px] font-bold text-white"
        style={{ backgroundColor: colour }}
      >
        {sdg}
      </span>
      <span>
        <span className="sr-only">SDG {sdg}: </span>
        {sdgName(sdg)}
      </span>
    </span>
  );
}

export function SdgChips({ sdgs }: { sdgs: number[] }) {
  if (sdgs.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {sdgs.map((sdg) => (
        <SdgChip key={sdg} sdg={sdg} />
      ))}
    </span>
  );
}
