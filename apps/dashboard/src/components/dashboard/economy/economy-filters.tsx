"use client";

import Link from "next/link";
import { type ReactNode, useState } from "react";

import type { EconomyFilterScope } from "@sarvodaya-connect/api-contracts";

import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { useI18n } from "@/i18n/provider";
import {
  basisLabel,
  ECONOMY_INDUSTRIES,
  ECONOMY_PRODUCTS,
  industryLabel,
  measurementLabel,
  type OverviewFilters,
  productLabel,
} from "@/lib/economy-format";

const field =
  "h-9 w-full rounded-input border border-line bg-surface px-2.5 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

function Field({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-[11px] font-semibold text-ink-soft">
      {label}
      {children}
    </label>
  );
}

/**
 * Issue #147: the overview filters, sent as an ordinary GET form so the
 * address holds them: Back, refresh and shared links show the same figures.
 * Product, industry and period choices come from the shared catalogue; the
 * district and society choices come from the API's view of the caller's scope.
 */
export function EconomyFilters({ filters, scope }: { filters: OverviewFilters; scope: EconomyFilterScope }) {
  const { t } = useI18n();
  const [basis, setBasis] = useState(filters.basis);
  const [districtId, setDistrictId] = useState(filters.districtId ?? "");
  // A society list loaded for one district does not apply to another.
  const societies = districtId === (filters.districtId ?? "") ? scope.societies : [];

  return (
    <form
      action="/economic-profile"
      aria-label={t("eco.filters")}
      className="mt-4 grid grid-cols-1 gap-3 rounded-card border border-line bg-surface p-3 sm:grid-cols-2 lg:grid-cols-4"
      role="search"
    >
      {scope.canChooseDistrict && (
        <Field label={t("eco.filter.district")}>
          <select className={field} name="districtId" onChange={(event) => setDistrictId(event.target.value)} value={districtId}>
            <option value="">{t("eco.filter.allDistricts")}</option>
            {scope.districts.map((district) => (
              <option key={district.id} value={district.id}>
                {district.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      <Field label={t("eco.filter.society")}>
        <select className={field} defaultValue={filters.societyId ?? ""} key={districtId} name="societyId">
          <option value="">{t("eco.filter.allSocieties")}</option>
          {societies.map((society) => (
            <option key={society.id} value={society.id}>
              {society.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("eco.filter.industry")}>
        <select className={field} defaultValue={filters.industry ?? ""} name="industry">
          <option value="">{t("eco.filter.allIndustries")}</option>
          {ECONOMY_INDUSTRIES.map((code) => (
            <option key={code} value={code}>
              {industryLabel(code, t)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("eco.filter.product")}>
        <select className={field} defaultValue={filters.product ?? ""} name="product">
          <option value="">{t("eco.filter.allProducts")}</option>
          {ECONOMY_PRODUCTS.map((product) => (
            <option key={product.code} value={product.code}>
              {productLabel(product.code, t)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t("eco.filter.basis")}>
        <select className={field} name="basis" onChange={(event) => setBasis(event.target.value as OverviewFilters["basis"])} value={basis}>
          {(["MONTHLY", "WEEKLY", "SEASONAL"] as const).map((value) => (
            <option key={value} value={value}>
              {basisLabel(value, t)}
            </option>
          ))}
        </select>
      </Field>
      {basis === "MONTHLY" && (
        <Field label={t("eco.filter.month")}>
          <input className={field} defaultValue={filters.month} name="month" required type="month" />
        </Field>
      )}
      {basis === "WEEKLY" && (
        <Field label={t("eco.filter.week")}>
          <input className={field} defaultValue={filters.week} name="week" required type="date" />
        </Field>
      )}
      {basis === "SEASONAL" && (
        <>
          <Field label={t("eco.filter.seasonStart")}>
            <input className={field} defaultValue={filters.startsOn} name="startsOn" required type="date" />
          </Field>
          <Field label={t("eco.filter.seasonEnd")}>
            <input className={field} defaultValue={filters.endsOn} name="endsOn" required type="date" />
          </Field>
        </>
      )}
      <Field label={t("eco.filter.measurement")}>
        <select className={field} defaultValue={filters.measurement} name="measurement">
          {(["ACTUAL", "ESTIMATED"] as const).map((value) => (
            <option key={value} value={value}>
              {measurementLabel(value, t)}
            </option>
          ))}
        </select>
      </Field>
      <div className="flex flex-wrap items-end gap-2 sm:col-span-2 lg:col-span-4">
        <button className={primaryButtonClass} type="submit">
          {t("eco.filter.apply")}
        </button>
        <Link className={secondaryButtonClass} href="/economic-profile">
          {t("eco.filter.reset")}
        </Link>
        {scope.societiesTruncated && <p className="text-[11px] text-muted">{t("eco.filter.societiesTruncated")}</p>}
      </div>
    </form>
  );
}
