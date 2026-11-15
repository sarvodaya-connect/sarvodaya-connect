"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import type { NationalOverview } from "@sarvodaya-connect/api-contracts";

import { Icon } from "@/components/dashboard/icon";
import { useI18n } from "@/i18n/provider";

import { count } from "../format";
import styles from "./hq.module.css";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Active societies in every district, alphabetical and never ranked (as D03b).
 * A native modal dialog: it keeps focus inside, closes on Escape and gives
 * focus back to the button that opened it.
 */
export function DistrictPanel({ districts, onClose, open }: { districts: NationalOverview["districts"]; onClose: () => void; open: boolean }) {
  const { t } = useI18n();
  const dialog = useRef<HTMLDialogElement>(null);
  const [shown, setShown] = useState(false);

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) {
      element.showModal();
      const frame = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(frame);
    }
    if (!open && element.open) {
      setShown(false);
      const close = () => element.close();
      if (reducedMotion()) close();
      else {
        const timer = window.setTimeout(close, 220);
        return () => window.clearTimeout(timer);
      }
    }
  }, [open]);

  const sorted = [...districts].sort((a, b) => a.name.localeCompare(b.name));
  const total = districts.reduce((sum, district) => sum + district.active, 0);

  return (
    <dialog
      aria-labelledby="hq-district-panel-title"
      className={styles.sheet}
      data-shown={shown}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        // A click on the backdrop (the dialog itself, outside its content) closes it.
        if (event.target === event.currentTarget) onClose();
      }}
      ref={dialog}
    >
      <div className="flex h-full flex-col">
        <div className="flex items-start justify-between gap-3 border-b border-line px-5 py-4">
          <div className="min-w-0">
            <p className="text-[10.5px] font-bold uppercase tracking-[0.08em] text-brand-leaf">{t("nav.districtView")}</p>
            <h2 className="text-[17px] font-bold text-ink" id="hq-district-panel-title">{t("n.activeInEachDistrict")}</h2>
            <p className="mt-0.5 text-[11.5px] text-muted">{t("hq.districtsNote", { count: count(total) })}</p>
          </div>
          <button
            aria-label={t("hq.close")}
            autoFocus
            className={`${styles.focusRing} grid size-9 shrink-0 place-items-center rounded-full text-ink-soft hover:bg-line-soft`}
            onClick={onClose}
            type="button"
          >
            <Icon className="size-4" name="close" />
          </button>
        </div>
        <ul className="flex-1 divide-y divide-line-soft overflow-y-auto px-2 py-2">
          {sorted.map((district) => (
            <li key={district.id}>
              <Link
                className={`${styles.focusRing} flex items-center gap-3 rounded-lg px-3 py-2.5 hover:bg-brand-mint-soft`}
                href={`/societies?districtId=${district.id}`}
              >
                <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-mint text-brand-forest">
                  <Icon className="size-4" name="district" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block break-words text-[13px] font-semibold text-ink">{district.name}</span>
                  {district.latitude === null && <span className="block text-[11px] text-muted">{t("hq.noDistrictPosition")}</span>}
                </span>
                <span className="text-right">
                  <strong className="block text-[15px] text-ink">{count(district.active)}</strong>
                  <span className="block text-[10.5px] text-muted">{t("hq.activeShort")}</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <div className="border-t border-line px-5 py-3">
          <Link className={`${styles.focusRing} inline-flex items-center gap-1 rounded text-[12px] font-semibold text-brand-forest hover:underline`} href="/districts">
            {t("hq.allDistrictFigures")} <Icon className="size-3.5" name="chevron" />
          </Link>
        </div>
      </div>
    </dialog>
  );
}
