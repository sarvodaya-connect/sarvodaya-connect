"use client";

/* eslint-disable @next/next/no-img-element -- the approved V6 dimension artwork is a static file in /public/dimensions */

import type { ActivityCategory, ActivityDimension } from "@sarvodaya-connect/api-contracts";

import { useI18n } from "@/i18n/provider";
import { localeTag, type Translator } from "@/i18n/translate";
import { CATEGORIES, categoryKey, DIMENSIONS, dimensionArtwork, dimensionKey, toggle } from "@/lib/development-goals";

import { Icon } from "../icon";

/** "Social and Governance", "සමාජ සහ පාලන" */
export function listOf(t: Translator, items: string[]) {
  return new Intl.ListFormat(localeTag(t.locale), { style: "long", type: "conjunction" }).format(items);
}

function SelectionSummary({ id, labels }: { id: string; labels: string[] }) {
  const { t } = useI18n();
  return (
    <p
      aria-live="polite"
      className={`mt-2 rounded-lg px-3 py-1.5 text-[11px] font-semibold ${labels.length ? "bg-brand-mint text-brand-forest" : "bg-[#eef0eb] text-ink-soft"}`}
      id={id}
    >
      {labels.length ? t.plural("dg.selected", labels.length, { list: listOf(t, labels) }) : t("dg.noneSelected")}
    </p>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p className="mt-2 flex items-center gap-2 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" id={id}>
      <Icon className="size-4 shrink-0" name="error" />
      {message}
    </p>
  );
}

const focusRing = "has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-brand-leaf";

/**
 * V6 SP07g: the three dimension pictures as cards and the ten categories as
 * chips. Each is a real checkbox, so pointer, keyboard (Tab, Space) and screen
 * readers all get the selected state. The two lists are independent: choosing
 * a dimension never limits or chooses a category.
 */
export function DevelopmentGoalsPicker({
  categories,
  dimensions,
  disabled = false,
  errors = {},
  onCategories,
  onDimensions,
}: {
  categories: ActivityCategory[];
  dimensions: ActivityDimension[];
  disabled?: boolean;
  errors?: { dimensions?: string; categories?: string };
  onCategories: (next: ActivityCategory[]) => void;
  onDimensions: (next: ActivityDimension[]) => void;
}) {
  const { t } = useI18n();
  const dimensionLabels = dimensions.map((code) => t(dimensionKey(code)));
  const categoryLabels = categories.map((code) => t(categoryKey(code)));

  return (
    <>
      <fieldset
        aria-describedby={`dg-dimensions-hint dg-dimensions-summary${errors.dimensions ? " dg-dimensions-error" : ""}`}
        aria-invalid={errors.dimensions ? true : undefined}
        className="mt-4"
      >
        <legend className="text-[13px] font-bold text-ink">
          {t("dg.dimensions")} <span aria-hidden className="text-danger-text">*</span>
          <span className="sr-only"> ({t("dg.required")})</span>
        </legend>
        <p className="mt-0.5 text-[11px] text-ink-soft" id="dg-dimensions-hint">{t("dg.dimensionsHint")}</p>
        <SelectionSummary id="dg-dimensions-summary" labels={dimensionLabels} />
        <FieldError id="dg-dimensions-error" message={errors.dimensions} />
        <ul className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3 lg:max-w-[660px]">
          {DIMENSIONS.map((code) => {
            const selected = dimensions.includes(code);
            const name = t(dimensionKey(code));
            return (
              <li key={code}>
                <label
                  className={`relative flex h-full cursor-pointer flex-col items-center rounded-card border bg-surface px-3 pb-3 pt-4 text-center motion-safe:transition-colors ${
                    selected ? "border-2 border-[#1b2a22] shadow-[0_1px_2px_rgba(27,42,34,0.12)]" : "border-line hover:border-brand-leaf"
                  } ${disabled ? "cursor-not-allowed opacity-60" : ""} ${focusRing}`}
                >
                  <input
                    checked={selected}
                    className="peer sr-only"
                    disabled={disabled}
                    name="dimensions"
                    onChange={() => onDimensions(toggle(DIMENSIONS, dimensions, code))}
                    type="checkbox"
                    value={code}
                  />
                  <span
                    aria-hidden
                    className={`absolute right-2.5 top-2.5 inline-flex size-6 items-center justify-center rounded-full border-2 ${
                      selected ? "border-[#2f6b45] bg-[#2f6b45] text-white" : "border-line bg-surface"
                    }`}
                  >
                    {selected && (
                      <svg className="size-3.5" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24">
                        <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    )}
                  </span>
                  <img alt="" className="size-[132px] max-w-full" height={132} src={dimensionArtwork(code)} width={132} />
                  <span className="mt-2 text-[14px] font-bold text-ink">{name}</span>
                  {/* The checkbox already says whether it is selected. */}
                  <span aria-hidden className={`text-[11px] ${selected ? "font-semibold text-brand-forest" : "text-muted"}`}>
                    {selected ? t("dg.cardSelected") : t("dg.cardSelect")}
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </fieldset>

      <fieldset
        aria-describedby={`dg-categories-hint dg-categories-summary${errors.categories ? " dg-categories-error" : ""}`}
        aria-invalid={errors.categories ? true : undefined}
        className="mt-5 border-t border-line-soft pt-4"
      >
        <legend className="float-left w-full text-[13px] font-bold text-ink">
          {t("dg.categories")} <span aria-hidden className="text-danger-text">*</span>
          <span className="sr-only"> ({t("dg.required")})</span>
        </legend>
        <div className="clear-both">
          <p className="mt-0.5 text-[11px] text-ink-soft" id="dg-categories-hint">{t("dg.categoriesHint")}</p>
          <SelectionSummary id="dg-categories-summary" labels={categoryLabels} />
          <FieldError id="dg-categories-error" message={errors.categories} />
          <ul className="mt-3 flex flex-wrap gap-2">
            {CATEGORIES.map((code) => {
              const selected = categories.includes(code);
              return (
                <li key={code}>
                  <label
                    className={`inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-[12px] motion-safe:transition-colors ${
                      selected ? "border-[#2f6b45] bg-brand-mint font-semibold text-ink" : "border-line bg-surface text-ink hover:border-brand-leaf"
                    } ${disabled ? "cursor-not-allowed opacity-60" : ""} ${focusRing}`}
                  >
                    <input
                      checked={selected}
                      className="peer sr-only"
                      disabled={disabled}
                      name="categories"
                      onChange={() => onCategories(toggle(CATEGORIES, categories, code))}
                      type="checkbox"
                      value={code}
                    />
                    <span
                      aria-hidden
                      className={`inline-flex size-4 shrink-0 items-center justify-center rounded-[4px] border ${
                        selected ? "border-[#2f6b45] bg-[#2f6b45] text-white" : "border-[#9aa59c] bg-surface"
                      }`}
                    >
                      {selected && (
                        <svg className="size-3" fill="none" stroke="currentColor" strokeWidth={3.5} viewBox="0 0 24 24">
                          <path d="m5 12 5 5L20 7" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                      )}
                    </span>
                    {t(categoryKey(code))}
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </fieldset>
    </>
  );
}

/** Dimensions (with their artwork), categories and UN SDGs as small chips: SP07r and SP08g. */
export function DevelopmentGoalChips({
  categories,
  dimensions,
  sdgs,
  layout = "inline",
}: {
  categories: ActivityCategory[];
  dimensions: ActivityDimension[];
  sdgs: React.ReactNode;
  layout?: "inline" | "columns";
}) {
  const { t } = useI18n();
  if (layout === "columns") {
    return (
      <dl className="grid gap-4 sm:grid-cols-3">
        <div>
          <dt className="text-[12px] font-bold text-ink">{t("dg.dimensions")}</dt>
          <dd className="mt-2 flex flex-col items-start gap-2">
            {dimensions.map((code) => (
              <span
                className={`inline-flex items-center gap-2 rounded-full border-2 bg-surface py-1 pl-1 pr-4 text-[13px] font-semibold ${DIMENSION_CHIP[code]}`}
                key={code}
              >
                <img alt="" className="size-9 rounded-full" height={36} src={dimensionArtwork(code)} width={36} />
                {t(dimensionKey(code))}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-bold text-ink">{t("dg.categories")}</dt>
          <dd className="mt-2 flex flex-wrap items-start gap-1.5">
            {categories.map((code) => (
              <span className="rounded-md border border-line bg-[#eef0eb] px-2 py-0.5 text-[12px] text-ink" key={code}>
                {t(categoryKey(code))}
              </span>
            ))}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-bold text-ink">{t("dg.sdgs")}</dt>
          <dd className="mt-2">{sdgs}</dd>
        </div>
      </dl>
    );
  }
  return (
    <ul aria-label={t("dg.title")} className="flex flex-wrap items-center gap-1.5">
      {dimensions.map((code) => (
        <li className={`inline-flex items-center gap-1 rounded-full border bg-surface px-2 py-0.5 text-[11px] font-semibold ${DIMENSION_CHIP[code]}`} key={code}>
          <span aria-hidden className={`size-1.5 rounded-full ${DIMENSION_DOT[code]}`} />
          {t(dimensionKey(code))}
        </li>
      ))}
      {categories.map((code) => (
        <li className="rounded-md border border-line bg-surface px-2 py-0.5 text-[11px] text-ink" key={code}>
          {t(categoryKey(code))}
        </li>
      ))}
      <li className="contents">{sdgs}</li>
    </ul>
  );
}

/** The artwork's own colours: green, orange and blue. */
const DIMENSION_CHIP: Record<ActivityDimension, string> = {
  SOCIAL: "border-[#5fae5b] text-[#2f6b2c]",
  ECONOMIC: "border-[#e5913a] text-[#9a4d0c]",
  GOVERNANCE: "border-[#4a8fd1] text-[#1d4f86]",
};
const DIMENSION_DOT: Record<ActivityDimension, string> = {
  SOCIAL: "bg-[#3f9a3b]",
  ECONOMIC: "bg-[#e07b1f]",
  GOVERNANCE: "bg-[#2f78c4]",
};
