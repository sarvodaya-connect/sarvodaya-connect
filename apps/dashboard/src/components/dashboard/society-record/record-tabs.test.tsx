import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { LOCALES } from "@/i18n/config";
import { en } from "@/i18n/messages/en";
import { I18nProvider } from "@/i18n/provider";

import { RecordTabs } from "./record-tabs";

let pathname = "/societies/s1/exco";
vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({ push: vi.fn() }),
}));

const tabs = [
  { href: "/societies/s1", label: "Overview" },
  { href: "/societies/s1/exco", label: "Members & Exco", count: 25 },
  { href: "/societies/s1/work-plan", label: "Work Plan 2027", count: 6 },
];

function renderTabs() {
  return render(
    <I18nProvider available={LOCALES} locale="en" messages={en}>
      <RecordTabs tabs={tabs} />
    </I18nProvider>,
  );
}

/** Issue #179: the record tabs use the role homes' tab row and stay plain links. */
describe("RecordTabs", () => {
  it("marks only the open tab as the current page, with its count", () => {
    renderTabs();
    const nav = screen.getByRole("navigation", { name: en["sr.tabsLabel"] });
    expect(nav).toBeInTheDocument();
    const exco = screen.getByRole("link", { name: /Members & Exco/ });
    expect(exco).toHaveAttribute("aria-current", "page");
    expect(exco).toHaveAttribute("href", "/societies/s1/exco");
    expect(exco).toHaveTextContent("25");
    expect(screen.getByRole("link", { name: "Overview" })).not.toHaveAttribute("aria-current");
  });

  it("treats Overview as current only on the record's own address", () => {
    pathname = "/societies/s1";
    renderTabs();
    expect(screen.getByRole("link", { name: "Overview" })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /Work Plan 2027/ })).not.toHaveAttribute("aria-current");
  });
});
