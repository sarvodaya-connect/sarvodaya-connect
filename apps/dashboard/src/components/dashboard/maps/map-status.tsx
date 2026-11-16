"use client";

import type { ReactNode } from "react";

import { useI18n } from "@/i18n/provider";

import type { MapPhase } from "./use-map";

/**
 * Loading text (never a bar) and the D02e error with "Try again", laid over a
 * map. `fallback` offers another way on, such as the society list, so nobody
 * is stuck when the map cannot load.
 */
export function MapStatus({ fallback, phase, retry }: { fallback?: ReactNode; phase: MapPhase; retry: () => void }) {
  const { t } = useI18n();
  if (phase === "loading")
    return (
      <p className="absolute inset-0 grid place-items-center text-[12px] text-muted" role="status">
        {t("n.mapLoading")}
      </p>
    );
  if (phase === "error")
    return (
      <div className="absolute inset-0 grid place-items-center bg-[#eef1ee] p-4 text-center" role="alert">
        <div>
          <p className="text-[13px] font-semibold text-ink">{t("n.mapError")}</p>
          <p className="mt-1 text-[11px] text-muted">{t("n.mapRetryHelp")}</p>
          <button
            className="mt-3 rounded-button border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-ink hover:bg-brand-mint-soft"
            onClick={retry}
            type="button"
          >
            {t("n.tryAgain")}
          </button>
          {fallback && <p className="mt-2 text-[12px]">{fallback}</p>}
        </div>
      </div>
    );
  return null;
}
