import { render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { EmergencyIncidentSummary, EmergencyResponseAction, EmergencySocietyRow, EmergencyTotals } from "@sarvodaya-connect/api-contracts";

import { dueLine, needsLine, openedByLine, safeLinkPath } from "@/lib/emergency-format";

import { ActionsBoard, ActionsSummary, AssessmentsTable, IncidentHeader, IncidentTiles } from "./incident-view";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

const now = new Date("2026-10-26T03:30:00Z"); // 9:00 a.m. in Sri Lanka
const society = (id: string, name: string) => ({ id, name, code: `S-${id}`, districtName: "Kurunegala" });

const incident: EmergencyIncidentSummary = {
  id: "inc-1",
  reference: "INC-2026-09",
  title: "Floods — North Western",
  type: "FLOOD",
  status: "ACTIVE",
  description: "",
  message: "",
  areaDistricts: [
    { id: "d1", name: "Kurunegala" },
    { id: "d2", name: "Puttalam" },
  ],
  reportingSociety: society("s1", "Pahala Kosgama SSS"),
  openedBy: { name: "N. Wijesinghe", role: "SOCIETY_OFFICER" },
  startedAt: "2026-10-25T00:40:00Z",
  openedAt: "2026-10-25T00:40:00Z",
  assessmentsDueAt: "2026-10-27T12:30:00Z",
  closedAt: null,
  closedBy: null,
  societiesInArea: 151,
  assessed: 96,
};

const totals: EmergencyTotals = {
  societiesInArea: 151,
  assessed: 96,
  notAssessed: 55,
  affected: 38,
  critical: 4,
  families: 1240,
  people: 4610,
  housesFully: 36,
  housesPartly: 412,
  actions: 23,
  actionsDelivered: 9,
  byDistrict: [],
  needs: [],
};

const helper = (status: "ASSIGNED" | "IN_PROGRESS" | "DELIVERED", delivered: number) => ({
  id: `h-${status}`,
  society: society("s9", "Giriulla SSS"),
  quantity: 40,
  deliveredQuantity: delivered,
  status,
  note: "",
  deliveryNote: "",
  deliveredOn: null,
  assignedBy: "K. Mendis",
  assignedAt: "2026-10-25T03:35:00Z",
  photos: 0,
  canUpdate: false,
});

const action = (id: string, state: EmergencyResponseAction["state"], helpers: EmergencyResponseAction["helpers"]): EmergencyResponseAction => ({
  id,
  need: "DRY_RATIONS",
  title: "Dry-ration packs",
  description: "",
  quantity: 40,
  unit: "packs",
  dueAt: null,
  forSociety: society("s1", "Pahala Kosgama SSS"),
  state,
  delivered: helpers.reduce((sum, h) => sum + h.deliveredQuantity, 0),
  helpers,
  createdBy: "K. Mendis",
  createdAt: "2026-10-25T03:30:00Z",
});

describe("V5 PR 8 incident views", () => {
  it("D31 / IR01 header: reference, area, opener and the deadline as words", () => {
    render(<IncidentHeader incident={incident} now={now} />);
    const heading = screen.getByRole("heading", { level: 1 });
    expect(heading).toHaveTextContent("Floods — North Western · INC-2026-09");
    expect(heading).toHaveTextContent("LIVE");
    expect(screen.getByText(/Kurunegala and Puttalam districts · 151 societies in the area/)).toHaveTextContent(
      "opened by N. Wijesinghe (Society Officer, Pahala Kosgama SSS) 25 Oct, 6:10 a.m. · assessments due 27 Oct, 6:00 p.m. · 1 day 9 hours left",
    );
  });

  it("shows figures as numbers in tiles, never as bars", () => {
    const { container } = render(<IncidentTiles totals={totals} />);
    expect(screen.getByText("38")).toBeInTheDocument();
    expect(screen.getByText("36 / 412")).toBeInTheDocument();
    expect(screen.getByText("of 151 societies")).toBeInTheDocument();
    expect(container.querySelector('[role="progressbar"], progress, [style*="width"]')).toBeNull();
  });

  it("D31 table: badges for each state and a link to assess a society not yet assessed", () => {
    const row = (id: string, state: EmergencySocietyRow["state"], extra: Partial<EmergencySocietyRow> = {}): EmergencySocietyRow => ({
      society: society(id, `Society ${id}`),
      state,
      families: null,
      people: null,
      housesFully: null,
      housesPartly: null,
      injured: null,
      displaced: null,
      roadAccess: null,
      needs: [],
      lastReceivedAt: null,
      updates: 0,
      photos: 0,
      canAssess: false,
      ...extra,
    });
    render(
      <AssessmentsTable
        emptyText="None"
        incidentId="inc-1"
        rows={[
          row("a", "CRITICAL", { families: 146, people: 520, needs: ["TEMPORARY_SHELTER", "DRINKING_WATER"], lastReceivedAt: "2026-10-26T01:00:00Z", updates: 2 }),
          row("b", "NOT_ASSESSED", { canAssess: true }),
        ]}
        wide={false}
      />,
    );
    const [, critical, missing] = screen.getAllByRole("row");
    expect(within(critical!).getByText("Critical")).toBeInTheDocument();
    expect(within(critical!).getByText("146 / 520")).toBeInTheDocument();
    expect(within(critical!).getByText("Temporary shelter, drinking water")).toBeInTheDocument();
    expect(within(critical!).getByText("Update 2")).toBeInTheDocument();
    expect(within(missing!).getByRole("link", { name: "Submit assessment" })).toHaveAttribute("href", "/emergencies/inc-1?panel=assess&society=b");
  });

  it("D32 board: needs sit in their status column with badges, and only HQ gets the assign button", () => {
    const actions = [action("n1", "NEEDED", []), action("p1", "IN_PROGRESS", [helper("IN_PROGRESS", 12)])];
    const { rerender } = render(<ActionsBoard actions={actions} canAssign incidentId="inc-1" />);
    const needed = screen.getByRole("region", { name: "Needed" });
    expect(within(needed).getByRole("link", { name: "Assign helpers" })).toHaveAttribute("href", "/emergencies/inc-1?tab=actions&panel=assign&action=n1");
    const progress = screen.getByRole("region", { name: "In progress" });
    expect(within(progress).getByText("Giriulla SSS · 12 of 40")).toBeInTheDocument();
    rerender(<ActionsBoard actions={actions} canAssign={false} incidentId="inc-1" />);
    expect(screen.queryByRole("link", { name: /helpers/ })).toBeNull();
  });

  it("IR01 'Assigned by HQ': what each society gets, and who helps", () => {
    render(<ActionsSummary actions={[action("p1", "IN_PROGRESS", [helper("IN_PROGRESS", 12)]), action("n1", "NEEDED", [])]} />);
    expect(screen.getByText("Pahala Kosgama SSS ← Giriulla SSS · 12 of 40")).toBeInTheDocument();
    expect(screen.getByText("Pahala Kosgama SSS · no helper yet")).toBeInTheDocument();
    expect(screen.getByText("In progress")).toBeInTheDocument();
    expect(screen.getByText("Needed")).toBeInTheDocument();
  });
});

describe("incident wording", () => {
  it("reads naturally", () => {
    expect(needsLine(["DRINKING_WATER", "DRY_RATIONS", "MEDICAL_HELP"])).toBe("Drinking water, dry rations");
    expect(needsLine([])).toBe("—");
    expect(openedByLine({ openedBy: { name: "K. Mendis", role: "HQ_ADMIN" }, reportingSociety: null })).toBe("K. Mendis (HQ)");
    expect(dueLine({ ...incident, assessmentsDueAt: "2026-10-31T12:30:00Z" }, now)).toBe("assessments due 31 Oct, 6:00 p.m. · 5 days left");
    expect(dueLine({ ...incident, assessmentsDueAt: "2026-10-25T12:30:00Z" }, now)).toBe("assessments due 25 Oct, 6:00 p.m. · deadline passed");
  });

  it("keeps notification links inside the dashboard", () => {
    expect(safeLinkPath("/emergencies/inc-1")).toBe("/emergencies/inc-1");
    expect(safeLinkPath("//evil.example")).toBeNull();
    expect(safeLinkPath("https://evil.example")).toBeNull();
    expect(safeLinkPath(undefined)).toBeNull();
  });
});
