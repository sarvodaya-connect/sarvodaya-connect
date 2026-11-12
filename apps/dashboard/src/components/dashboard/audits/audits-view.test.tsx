import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { ENGLISH } from "@/i18n/english";
import { en } from "@/i18n/messages/en";
import { si } from "@/i18n/messages/si";
import { ta } from "@/i18n/messages/ta";
import { createTranslator } from "@/i18n/translate";
import { type DemoViewer, getViewer } from "@/lib/access";
import { navigationFor } from "@/lib/navigation";
import { canOpen } from "@/lib/role-routes";

import { type AuditFigures, AuditsView } from "./audits-view";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const viewer = (role: "PROGRAMME_COORDINATOR" | "DEPUTY_DISTRICT_MANAGER" | "DISTRICT_MANAGER"): DemoViewer => ({
  ...getViewer(role === "DISTRICT_MANAGER" ? "district-manager" : "programme-coordinator"),
  role,
});

function figures(overrides: Partial<AuditFigures> = {}): AuditFigures {
  return {
    financialYear: { startYear: 2025, label: "FY 2025/26" },
    activeSocieties: 4,
    byType: [
      { documentType: "AUDIT_REPORT", submitted: 3, missing: 1 },
      { documentType: "AGM_MINUTES", submitted: 2, missing: 2 },
      { documentType: "OFFICE_BEARER_LIST", submitted: 4, missing: 0 },
      { documentType: "MEMBERS_LIST", submitted: 1, missing: 3 },
    ],
    allFour: 1,
    auditReportDueOn: "2026-09-30",
    followUp: {
      pastDue: true,
      data: [{ id: "s4", name: "Fictional North Four", societyCode: "S-91004", district: "Fictional North" }],
      meta: { page: 1, totalItems: 21, totalPages: 2 },
    },
    ...overrides,
  };
}

const href = ({ year, page }: { year: number; page?: number }) => `/compliance?year=${year}&scope=DISTRICT${page ? `&page=${page}` : ""}`;

describe("Audits & AGM (issue #119)", () => {
  it("shows HQ's cards and follow-up list from the figures it is given", () => {
    render(<AuditsView breadcrumb={{ href: "/dashboard", label: "District Overview" }} demo={false} figures={figures()} href={href} scopeLine="All societies in Fictional North" t={ENGLISH} years={[2025, 2024]} />);
    expect(screen.getByText("75%")).toBeInTheDocument();
    expect(screen.getByText("3 of 4")).toBeInTheDocument();
    expect(screen.getByText("Due 30 Sept 2026")).toBeInTheDocument();
    expect(screen.getByText("1 of 4 active societies have all four · 25%")).toBeInTheDocument();
    expect(screen.getByText("Signed file · only DM and HQ can open")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audit report past the due date" })).toBeInTheDocument();
    const row = within(screen.getByRole("table")).getByRole("link", { name: "Fictional North Four" });
    expect(row).toHaveAttribute("href", "/societies/s4/documents?year=2025");
    expect(screen.getByRole("link", { name: "Next" })).toHaveAttribute("href", "/compliance?year=2025&scope=DISTRICT&page=2");
    expect(screen.getByRole("link", { name: "FY 2024/25" })).toHaveAttribute("href", "/compliance?year=2024&scope=DISTRICT");
    expect(screen.getByRole("link", { name: "District Overview" })).toHaveAttribute("href", "/dashboard");
  });

  it("says the due date has not passed yet", () => {
    render(<AuditsView breadcrumb={{ href: "/dashboard", label: "Home" }} demo={false} figures={figures({ followUp: { ...figures().followUp, pastDue: false } })} href={href} t={ENGLISH} years={[2025]} />);
    expect(screen.getByText("Due date 30 Sept 2026 not passed")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "Audit report not uploaded yet" })).toBeInTheDocument();
  });

  it("says when every society has uploaded, and when there are no active societies", () => {
    const { unmount } = render(
      <AuditsView breadcrumb={{ href: "/dashboard", label: "Home" }} demo={false} figures={figures({ followUp: { pastDue: true, data: [], meta: { page: 1, totalItems: 0, totalPages: 0 } } })} href={href} t={ENGLISH} years={[2025]} />,
    );
    expect(screen.getByRole("heading", { name: "Nothing to Follow Up" })).toBeInTheDocument();
    unmount();
    render(<AuditsView breadcrumb={{ href: "/dashboard", label: "Home" }} demo={false} figures={figures({ activeSocieties: 0 })} href={href} t={ENGLISH} years={[2025]} />);
    expect(screen.getByRole("heading", { name: "No Active Societies" })).toBeInTheDocument();
    expect(screen.queryByRole("table")).not.toBeInTheDocument();
  });

  it.each([
    ["si", si],
    ["ta", ta],
  ] as const)("is translated in %s", (locale, messages) => {
    render(<AuditsView breadcrumb={{ href: "/dashboard", label: "Home" }} demo={false} figures={figures()} href={href} t={createTranslator(messages, locale)} years={[2025]} />);
    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(messages["au.title"]);
    for (const key of ["au.followPast", "au.allFourTitle", "au.note.MEMBERS_LIST"] as const) expect(document.body).not.toHaveTextContent(en[key]);
    expect(document.body).toHaveTextContent("Fictional North Four");
  });

  it.each(["PROGRAMME_COORDINATOR", "DEPUTY_DISTRICT_MANAGER", "DISTRICT_MANAGER"] as const)("lets %s open Audits & AGM from the sidebar", (role) => {
    expect(canOpen(role, "/compliance")).toBe(true);
    expect(canOpen(role, "/documents")).toBe(false);
    expect(navigationFor(viewer(role)).main.map((item) => item.href)).toContain("/compliance");
  });
});
