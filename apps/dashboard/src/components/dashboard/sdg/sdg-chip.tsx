import type { MessageKey } from "@/i18n/messages/en";
import type { Translator } from "@/i18n/translate";
import { SDG_COLOURS, sdgName } from "@/lib/sdg";

/**
 * SP06 "Approved recently": the goal number in its colour and the full title.
 * With `t` the title is in the reader's language; screens still in English
 * (phase 5 of issue #108) leave it out.
 */
export function SdgChip({ sdg, t }: { sdg: number; t?: Translator }) {
  const colour = SDG_COLOURS[sdg] ?? "#5b6b62";
  const known = sdg >= 1 && sdg <= 17;
  return (
    <span
      // `relative` keeps the screen-reader text inside a table's scroll area,
      // so it cannot widen the page on a phone.
      className="relative inline-flex items-center gap-1.5 rounded-full border bg-surface py-0.5 pl-0.5 pr-2 text-[10px] font-semibold text-ink"
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
        <span className="sr-only">{t ? t("prog.sdgNumber", { number: sdg }) : `SDG ${sdg}`}: </span>
        {t && known ? t(`sdg.${sdg}` as MessageKey) : sdgName(sdg)}
      </span>
    </span>
  );
}

export function SdgChips({ sdgs, t }: { sdgs: number[]; t?: Translator }) {
  if (sdgs.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1.5">
      {sdgs.map((sdg) => (
        <SdgChip key={sdg} sdg={sdg} t={t} />
      ))}
    </span>
  );
}
