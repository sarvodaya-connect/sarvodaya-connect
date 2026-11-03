import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import type { DistrictAccessGrantDetail, DistrictAccessGrantView, HomeSocietyList, HomeSummary } from "@sarvodaya-connect/api-contracts";

import { getViewer } from "@/lib/access";
import { parseSocietyFilters, timeLeft } from "@/lib/home-format";
import { canOpen } from "@/lib/role-routes";

import { MySocieties } from "../role-home/my-societies";
import { RoleHome } from "../role-home/role-home";
import { EndAccessButton, GiveAccessForm } from "./access-controls";
import { CurrentGrant, GrantDetail, GrantHistoryTable } from "./district-access-view";
import { RolePageNoAccess, SocietyNoAccess } from "./no-access-views";
import { TemporaryRecordNotice } from "./record-access-notice";

vi.mock("@/app/(dashboard)/district-access/actions", () => ({ endDistrictAccess: vi.fn(), giveDistrictAccess: vi.fn() }));
vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const now = new Date("2026-10-27T03:30:00Z"); // Tue 27 Oct, 9:00 a.m. in Sri Lanka

function grant(overrides: Partial<DistrictAccessGrantView> = {}): DistrictAccessGrantView {
  return {
    id: "g1",
    district: { id: "d1", name: "Kurunegala", societyCount: 106 },
    deputy: { id: "u1", name: "P. Dissanayake" },
    grantedBy: { id: "u2", name: "R. Fernando" },
    grantedAt: "2026-10-26T03:40:00Z",
    startsAt: "2026-10-27T02:30:00Z",
    expiresAt: "2026-10-31T12:30:00Z",
    endedEarly: null,
    reason: "Annual leave",
    status: "ACTIVE",
    societiesOpened: 9,
    ...overrides,
  };
}

describe("DM04 temporary DDM access", () => {
  it("shows the current grant with what was opened and the time left", () => {
    render(<CurrentGrant grant={grant()} now={now} />);
    expect(screen.getByText("P. Dissanayake · DDM")).toBeInTheDocument();
    expect(screen.getByText(/View only · all 106 Kurunegala societies · 27 Oct, 8:00 a.m. → 31 Oct, 6:00 p.m. · reason: Annual leave/)).toBeInTheDocument();
    expect(screen.getByText(/Opened 9 district societies so far/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "See access history" })).toHaveAttribute("href", "/district-access?grant=g1");
    expect(screen.getByText(/4 days left/)).toBeInTheDocument();
  });

  it("lists every grant with a plain status, never a bar", () => {
    const { container } = render(
      <GrantHistoryTable
        grants={[
          grant(),
          grant({ id: "g2", deputy: { id: "u3", name: "K. Rajapaksha" }, status: "ENDED", startsAt: "2026-08-04T02:30:00Z", expiresAt: "2026-08-08T12:30:00Z" }),
          grant({ id: "g3", status: "ENDED_EARLY", endedEarly: { at: "2026-05-14T02:30:00Z", byName: "R. Fernando" } }),
        ]}
      />,
    );
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText("Active")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Ended on its own")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("04 Aug → 08 Aug 2026")).toBeInTheDocument();
    expect(within(rows[2]!).getByText("Ended early by R. Fernando")).toBeInTheDocument();
    expect(within(rows[2]!).getByRole("link", { name: "Details" })).toHaveAttribute("href", "/district-access?grant=g3");
    expect(container.querySelector('[style*="width"]')).toBeNull();
  });

  it("says when no grant has been given", () => {
    render(<GrantHistoryTable grants={[]} />);
    expect(screen.getByText("You have not given temporary access yet.")).toBeInTheDocument();
  });

  it("M32 / See details: the access history in plain words", () => {
    const detail: DistrictAccessGrantDetail = {
      ...grant(),
      history: [
        { kind: "OPENED", at: "2026-10-27T04:32:00Z", actorName: "P. Dissanayake", societyName: "Thalawa SSS" },
        { kind: "STARTED", at: "2026-10-27T02:30:00Z", actorName: null },
        { kind: "GIVEN", at: "2026-10-26T03:40:00Z", actorName: "R. Fernando" },
      ],
    };
    render(<GrantDetail grant={detail} now={now} />);
    const history = within(screen.getByRole("region", { name: "Access history" }));
    expect(history.getByText("Opened Thalawa SSS")).toBeInTheDocument();
    expect(history.getByText("P. Dissanayake · 27 Oct, 10:02 a.m.")).toBeInTheDocument();
    expect(history.getByText("Access given · view only")).toBeInTheDocument();
    expect(screen.getByText("4 days 10 hours")).toBeInTheDocument();
  });
});

describe("DM05 give temporary access", () => {
  it("needs a DDM, keeps access view only and lists what the DDM can and cannot do", async () => {
    const user = userEvent.setup();
    const action = vi.fn(async () => ({ error: "This DDM already has temporary access for some of that time. End it first or choose other dates." }));
    render(
      <GiveAccessForm
        action={action}
        deputies={[
          { id: "u1", displayName: "P. Dissanayake" },
          { id: "u3", displayName: "K. Rajapaksha" },
        ]}
        districtName="Kurunegala"
        maxDays={14}
        now={now}
        societyCount={106}
      />,
    );
    expect(screen.getByRole("button", { name: "Give access" })).toBeDisabled();
    expect(screen.getByText("View only · all 106 Kurunegala societies")).toBeInTheDocument();
    expect(screen.getByText(/At most 14 days/)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Starts/)).toHaveValue("2026-10-27T09:00");
    expect(screen.getByLabelText(/^Ends/)).toHaveValue("2026-10-31T09:00");

    await user.selectOptions(screen.getByLabelText(/^DDM/), "u1");
    expect(screen.getByText("P. Dissanayake will be able to")).toBeInTheDocument();
    expect(screen.getByText("Give access to anyone else")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Give access" }));
    expect(action).toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent("already has temporary access");
    // The choice stays after an error.
    expect(screen.getByLabelText(/^DDM/)).toHaveValue("u1");
  });

  it("asks before ending access early", async () => {
    const user = userEvent.setup();
    const confirm = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<EndAccessButton action={vi.fn(async () => {})} deputyName="P. Dissanayake" grantId="g1" returnTo="/district-access" />);
    await user.click(screen.getByRole("button", { name: "End access now" }));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining("End P. Dissanayake's temporary access now?"));
    expect(screen.getByRole("button", { name: "End access now" })).toBeEnabled();
    confirm.mockRestore();
  });
});

const ddmHome = (overrides: Partial<HomeSummary>): HomeSummary => ({
  role: "DEPUTY_DISTRICT_MANAGER",
  generatedAt: now.toISOString(),
  financialYear: { startYear: 2025, label: "FY 2025/26" },
  planYear: 2027,
  district: { id: "d1", name: "Kurunegala" },
  societies: { total: 18, active: 18, notActive: 0, grades: { A: 3, B: 5, C: 10 }, members: null },
  viewOnly: false,
  gradeRequests: { pending: 2, latest: null },
  notUpdated: { days: 90, count: 3, societyNames: [] },
  yearlySummaryMissing: 0,
  societiesWithPlan: 0,
  activitiesWaiting: 0,
  needsAttention: [],
  recent: [],
  staff: [],
  temporaryAccess: [],
  districtViewCount: null,
  recentlyEnded: null,
  incidents: [],
  ...overrides,
});
const ddm = { ...getViewer("programme-coordinator"), role: "DEPUTY_DISTRICT_MANAGER" as const, displayName: "P. Dissanayake" };
const homeGrant = {
  id: "g1",
  deputyName: "P. Dissanayake",
  districtName: "Kurunegala",
  startsAt: "2026-10-27T02:30:00Z",
  expiresAt: "2026-10-31T12:30:00Z",
  grantedByName: "R. Fernando",
  grantedAt: "2026-10-26T03:40:00Z",
  societiesOpened: 0,
  districtSocietyCount: 106,
};

describe("DD02 / DD07 DDM home", () => {
  it("DD02: shows the district-wide view with the time left and a way into it", () => {
    render(<RoleHome home={ddmHome({ temporaryAccess: [homeGrant], districtViewCount: 106 })} now={now} viewer={ddm} />);
    const banner = screen.getAllByRole("note").find((note) => note.textContent?.includes("Temporary district-wide view"))!;
    expect(banner).toHaveTextContent("all 106 Kurunegala societies, view only. Given by R. Fernando (DM) on 26 Oct, 9:10 a.m.");
    expect(banner).toHaveTextContent("Ends Sat 31 Oct, 6:00 p.m. · 4 days left");
    expect(screen.getByRole("link", { name: "Browse district societies" })).toHaveAttribute("href", "/my-societies?scope=DISTRICT");
    expect(screen.getByText("Active · view only")).toBeInTheDocument();
  });

  it("DD07: says the view ended and the DDM is back to their own societies", () => {
    render(
      <RoleHome
        home={ddmHome({
          recentlyEnded: {
            districtName: "Kurunegala",
            grantedByName: "R. Fernando",
            startsAt: "2026-10-27T02:30:00Z",
            expiresAt: "2026-10-31T12:30:00Z",
            endedAt: "2026-10-31T12:30:00Z",
            endedEarly: false,
          },
        })}
        now={now}
        viewer={ddm}
      />,
    );
    expect(screen.getByText(/Your temporary district-wide view ended on Sat 31 Oct, 6:00 p.m./)).toBeInTheDocument();
    expect(screen.getByText(/You are back to your 18 assigned societies. Links to other district societies now show No access./)).toBeInTheDocument();
  });
});

describe("DD04 district societies, view only", () => {
  const row = (id: string, name: string, editable: boolean, yours: boolean) => ({
    id,
    societyCode: `S-${id}`,
    nameEn: name,
    nameLocal: null,
    grade: "C" as const,
    pendingGrade: null,
    members: 188,
    officerName: null,
    spcName: "M. Herath",
    ddmName: null,
    dsDivision: null,
    updatedAt: "2026-10-27T02:00:00Z",
    stale: false,
    editable,
    yours,
  });
  const list: HomeSocietyList = {
    data: [row("1", "Thalawa SSS", false, false), row("2", "Giriulla SSS", true, true)],
    meta: { page: 1, pageSize: 20, totalItems: 2, totalPages: 1 },
    scopeTotal: 106,
    viewOnly: false,
    scope: "DISTRICT",
    tabs: { mine: 18, district: 106 },
    access: homeGrant,
    recentlyEnded: null,
    district: { id: "d1", name: "Kurunegala" },
    options: { dsDivisions: [], spcs: [], ddms: [] },
  };

  it("has both tabs, marks the DDM's own societies and keeps the rest view only", () => {
    render(<MySocieties filters={{ scope: "DISTRICT" }} list={list} now={now} role="DEPUTY_DISTRICT_MANAGER" />);
    expect(screen.getByText("All 106 Kurunegala societies · view only until Sat 31 Oct, 6:00 p.m.")).toBeInTheDocument();
    const tabs = within(screen.getByRole("navigation", { name: "Which societies" }));
    expect(tabs.getByRole("link", { name: /My societies · edit/ })).toHaveAttribute("href", "/my-societies");
    expect(tabs.getByRole("link", { name: /Kurunegala district · view only/ })).toHaveAttribute("aria-current", "page");
    const rows = screen.getAllByRole("row").slice(1);
    expect(within(rows[0]!).getByText("View only")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Editable")).toBeInTheDocument();
    expect(within(rows[1]!).getByText("Yours")).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: "Assigned to me" })).toBeInTheDocument();
    expect(document.querySelector('input[name="scope"]')).toHaveValue("DISTRICT");
    expect(screen.getByText(/each one you open is recorded in the access history/)).toBeInTheDocument();
  });

  it("DD07: only the DDM's own tab once access has ended", () => {
    render(
      <MySocieties
        filters={{}}
        list={{
          ...list,
          scope: "MINE",
          tabs: { mine: 18, district: null },
          access: null,
          recentlyEnded: { districtName: "Kurunegala", grantedByName: "R. Fernando", startsAt: list.access!.startsAt, expiresAt: list.access!.expiresAt, endedAt: list.access!.expiresAt, endedEarly: true },
        }}
        now={now}
        role="DEPUTY_DISTRICT_MANAGER"
      />,
    );
    expect(screen.getByText(/was ended early on Sat 31 Oct/)).toBeInTheDocument();
    expect(within(screen.getByRole("navigation", { name: "Which societies" })).getAllByRole("link")).toHaveLength(1);
  });
});

describe("DD06, ST04 and pages for another role", () => {
  it("DD06: a district society opens view only and says it was recorded", () => {
    render(<TemporaryRecordNotice now={now} until="2026-10-31T12:30:00Z" viewerName="P. Dissanayake" />);
    expect(screen.getByRole("note")).toHaveTextContent("View only · temporary district-wide view ends Sat 31 Oct, 6:00 p.m.");
    expect(screen.getByText("Opening this record was added to the access history (P. Dissanayake · 27 Oct, 9:00 a.m.).")).toBeInTheDocument();
  });

  it("ST04: names no society, and explains an ended temporary view", () => {
    render(
      <SocietyNoAccess
        assigned={18}
        isHq={false}
        recentlyEnded={{ districtName: "Kurunegala", grantedByName: "R. Fernando", startsAt: "", expiresAt: "", endedAt: "2026-10-31T12:30:00Z", endedEarly: false }}
      />,
    );
    expect(screen.getByRole("heading", { name: "You don't have access to this society" })).toBeInTheDocument();
    expect(screen.getByText(/not one of your 18 assigned societies, and your temporary district-wide view ended on Sat 31 Oct/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Back to my societies" })).toHaveAttribute("href", "/my-societies");
  });

  it("M69d: an HQ page tells the user who they are signed in as", () => {
    render(<RolePageNoAccess name="R. Fernando" roleLabel="District Manager" scope="Kurunegala" />);
    expect(screen.getByRole("heading", { name: "This page is for HQ only" })).toBeInTheDocument();
    expect(screen.getByText(/signed in as R. Fernando \(District Manager, Kurunegala\)/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to my home" })).toHaveAttribute("href", "/dashboard");
  });

  it("keeps the time left as words and the new pages within each role", () => {
    expect(timeLeft("2026-10-31T12:30:00Z", now)).toBe("4 days left");
    expect(timeLeft("2026-10-30T11:30:00Z", now)).toBe("3 days 8 hours left");
    expect(timeLeft("2026-11-05T03:30:00Z", now)).toBe("9 days left");
    expect(timeLeft("2026-10-27T08:30:00Z", now)).toBe("5 hours left");
    expect(timeLeft("2026-10-27T03:00:00Z", now)).toBe("Ended");
    expect(parseSocietyFilters({ scope: "DISTRICT", assignedToMe: "true" })).toEqual({ scope: "DISTRICT", assignedToMe: "true" });
    expect(parseSocietyFilters({ scope: "ALL", assignedToMe: "maybe" })).toEqual({});
    expect(canOpen("DISTRICT_MANAGER", "/district-access")).toBe(true);
    expect(canOpen("DEPUTY_DISTRICT_MANAGER", "/no-access")).toBe(true);
    expect(canOpen("DEPUTY_DISTRICT_MANAGER", "/district-access/other")).toBe(false);
  });
});
