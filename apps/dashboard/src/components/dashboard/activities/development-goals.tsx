/* eslint-disable @next/next/no-img-element -- static approved dimension artwork from /public/development-goals */

import type { ActivityCategory, ActivityClassification, ActivityDimension } from "@sarvodaya-connect/api-contracts";

import type { MessageKey } from "@/i18n/messages/en";
import { localeTag, type Translator } from "@/i18n/translate";
import { ACTIVITY_CATEGORIES, ACTIVITY_DIMENSIONS } from "@/lib/activity-format";

import { SdgChips } from "../sdg/sdg-chip";

/** The approved V6 dimension pictures, also used by the phone app. */
export const DIMENSION_IMAGES: Record<ActivityDimension, string> = {
  SOCIAL: "/development-goals/social.png",
  ECONOMIC: "/development-goals/economic.png",
  GOVERNANCE: "/development-goals/governance.png",
};

/** Ring and text colours from the artwork. */
const DIMENSION_TONE: Record<ActivityDimension, { ring: string; text: string; soft: string }> = {
  SOCIAL: { ring: "#5fae6a", text: "#2f6b45", soft: "#eef7ee" },
  ECONOMIC: { ring: "#e59a45", text: "#8a4b12", soft: "#fdf3e8" },
  GOVERNANCE: { ring: "#4f93d2", text: "#234f7c", soft: "#eaf2fb" },
};

export const dimensionLabel = (t: Translator, dimension: ActivityDimension) => t(`dimension.${dimension}` as MessageKey);

/** The ten categories share their order and names with the Sarvodaya sectors (sector.1 … sector.10). */
export const categoryLabel = (t: Translator, category: ActivityCategory) =>
  t(`sector.${ACTIVITY_CATEGORIES.indexOf(category) + 1}` as MessageKey);

/** Keeps a choice in catalogue order, whatever order it was clicked in. */
export function inCatalogueOrder<T extends string>(catalogue: readonly T[], chosen: Iterable<T>): T[] {
  const set = new Set(chosen);
  return catalogue.filter((item) => set.has(item));
}

function listLabel(t: Translator, labels: string[]) {
  return new Intl.ListFormat(localeTag(t.locale), { style: "long", type: "conjunction" }).format(labels);
}

/** "2 selected: Social and Governance", or "None selected yet", read out as the choice changes. */
export function SelectionStatus({ labels, t }: { labels: string[]; t: Translator }) {
  return (
    <p
      aria-live="polite"
      className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${
        labels.length ? "bg-[#e8f2e6] text-brand-forest" : "bg-[#f4f5f1] text-muted"
      }`}
    >
      {labels.length ? t("goals.selectedList", { count: labels.length, list: listLabel(t, labels) }) : t("goals.noneSelected")}
    </p>
  );
}

export function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-1.5 text-[11px] font-semibold text-danger-text" id={id}>
      {message}
    </p>
  );
}

const tick = (
  <svg aria-hidden className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
    <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

/**
 * V6 SP07g: the three dimension pictures as checkboxes. Any number can be
 * chosen; a chosen card has a dark border and a tick.
 */
export function DimensionPicker({
  disabled,
  errorId,
  onToggle,
  selected,
  t,
}: {
  disabled?: boolean;
  errorId?: string;
  onToggle: (dimension: ActivityDimension) => void;
  selected: ActivityDimension[];
  t: Translator;
}) {
  return (
    <ul className="mt-3 grid gap-3 sm:grid-cols-[repeat(3,minmax(0,220px))]">
      {ACTIVITY_DIMENSIONS.map((dimension) => {
        const checked = selected.includes(dimension);
        const tone = DIMENSION_TONE[dimension];
        return (
          <li key={dimension}>
            <label
              className={`relative flex h-full cursor-pointer flex-col items-center rounded-xl border-2 bg-surface px-3 pb-3 pt-4 text-center has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-leaf has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 motion-safe:transition-colors ${
                checked ? "border-[#1b2a22]" : "border-line hover:border-brand-leaf"
              }`}
            >
              <input
                aria-describedby={errorId}
                aria-invalid={errorId ? true : undefined}
                aria-label={dimensionLabel(t, dimension)}
                checked={checked}
                className="peer sr-only"
                disabled={disabled}
                onChange={() => onToggle(dimension)}
                type="checkbox"
                value={dimension}
              />
              <span
                aria-hidden
                className={`absolute right-2.5 top-2.5 inline-flex size-5 items-center justify-center rounded-full border ${
                  checked ? "border-[#2f6b45] bg-[#2f6b45] text-white" : "border-line bg-surface"
                }`}
              >
                {checked && tick}
              </span>
              <img alt="" className="size-28 rounded-full object-contain" height={112} src={DIMENSION_IMAGES[dimension]} width={112} />
              <span className="mt-2 text-[14px] font-bold" style={{ color: tone.text }}>
                {dimensionLabel(t, dimension)}
              </span>
              {/* The checkbox already says whether it is checked. */}
              <span aria-hidden className={`text-[11px] ${checked ? "font-semibold text-brand-forest" : "text-muted"}`}>
                {checked ? t("goals.selected") : t("goals.clickToSelect")}
              </span>
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** V6 SP07g: the ten categories in their defined order, each chosen on its own. */
export function CategoryPicker({
  disabled,
  errorId,
  onToggle,
  selected,
  t,
}: {
  disabled?: boolean;
  errorId?: string;
  onToggle: (category: ActivityCategory) => void;
  selected: ActivityCategory[];
  t: Translator;
}) {
  return (
    <ul className="mt-3 flex flex-wrap gap-2">
      {ACTIVITY_CATEGORIES.map((category) => {
        const checked = selected.includes(category);
        return (
          <li key={category}>
            <label
              className={`inline-flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-[12px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-leaf has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-60 motion-safe:transition-colors ${
                checked ? "border-[#1b2a22] bg-[#e8f2e6] font-semibold text-ink" : "border-line bg-surface text-ink hover:border-brand-leaf"
              }`}
            >
              <input
                aria-describedby={errorId}
                aria-invalid={errorId ? true : undefined}
                checked={checked}
                className="size-4 accent-[#2f6b45]"
                disabled={disabled}
                onChange={() => onToggle(category)}
                type="checkbox"
                value={category}
              />
              {categoryLabel(t, category)}
            </label>
          </li>
        );
      })}
    </ul>
  );
}

/** A small dimension pill with its picture, as in SP07r and SP09. */
export function DimensionPill({ dimension, t }: { dimension: ActivityDimension; t: Translator }) {
  const tone = DIMENSION_TONE[dimension];
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-[12px] font-bold"
      style={{ borderColor: tone.ring, backgroundColor: tone.soft, color: tone.text }}
    >
      <img alt="" className="size-7 rounded-full object-contain" height={28} src={DIMENSION_IMAGES[dimension]} width={28} />
      {dimensionLabel(t, dimension)}
    </span>
  );
}

/** The chosen dimensions, categories and UN SDGs side by side (SP07r, SP08g, SP09). */
export function GoalsSummary({
  classification,
  sdgs,
  t,
}: {
  classification: ActivityClassification | null | undefined;
  sdgs: number[];
  t: Translator;
}) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div>
        <h3 className="text-[12px] font-bold text-ink">{t("goals.dimensions")}</h3>
        {classification?.dimensions.length ? (
          <ul className="mt-2 flex flex-wrap gap-2">
            {classification.dimensions.map((dimension) => (
              <li key={dimension}>
                <DimensionPill dimension={dimension} t={t} />
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-muted">{t("goals.notRecorded")}</p>
        )}
      </div>
      <div>
        <h3 className="text-[12px] font-bold text-ink">{t("goals.categories")}</h3>
        {classification?.categories.length ? (
          <ul className="mt-2 flex flex-wrap gap-1.5">
            {classification.categories.map((category) => (
              <li className="rounded-md border border-line bg-[#f2f4f0] px-2 py-1 text-[11px] font-semibold text-ink" key={category}>
                {categoryLabel(t, category)}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 text-[11px] text-muted">—</p>
        )}
      </div>
      <div>
        <h3 className="text-[12px] font-bold text-ink">{t("goals.sdgs")}</h3>
        <div className="mt-2">
          <SdgChips sdgs={sdgs} t={t} />
        </div>
      </div>
    </div>
  );
}
