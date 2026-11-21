import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it, vi } from "vitest";

import type { ActivityApprovalInput, SocietyRegistrarDocuments } from "@sarvodaya-connect/api-contracts";

import { si } from "@/i18n/messages/si";
import { I18nProvider } from "@/i18n/provider";
import { ACTIVITY_CATEGORIES } from "@/lib/activity-format";

import { RegistrarDocumentsList } from "../documents/registrar-documents";
import { SdgSelector } from "../sdg/sdg-selector";
import { ActivityReview, type ApproveResult } from "./activity-review";

function Selector({ initial = [] as number[] }) {
  const [selected, setSelected] = useState(initial);
  return <SdgSelector onChange={setSelected} selected={selected} />;
}

describe("V5 SP07 / M51 UN SDG selector", () => {
  it("shows all 17 official goals in order with their number and full title", () => {
    render(<Selector />);
    const tiles = within(screen.getByRole("list", { name: "UN SDGs" })).getAllByRole("button");
    expect(tiles).toHaveLength(17);
    expect(tiles[0]).toHaveAccessibleName("SDG 1: No Poverty");
    expect(tiles[16]).toHaveAccessibleName("SDG 17: Partnerships for the Goals");
    expect(screen.getByText("12 · Responsible Consumption and Production")).toBeInTheDocument();
    const icon = tiles[3]!.querySelector("img");
    expect(icon).toHaveAttribute("src", "/sdg/sdg-04.jpg");
  });

  it("marks a chosen goal as pressed and says it is selected", async () => {
    render(<Selector initial={[16]} />);
    const education = screen.getByRole("button", { name: "SDG 4: Quality Education" });
    expect(education).toHaveAttribute("aria-pressed", "false");
    await userEvent.click(education);
    expect(screen.getByRole("button", { name: "SDG 4: Quality Education, selected" })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByText("Chosen (2)")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "SDG 16: Peace, Justice and Strong Institutions, selected" }));
    expect(screen.getByText("Chosen (1)")).toBeInTheDocument();
  });
});

const refresh = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));

describe("V6 SP07 Development Goals approval", () => {
  const renderReview = (
    approve = vi.fn<(input: ActivityApprovalInput) => Promise<ApproveResult>>().mockResolvedValue({}),
    sendBack = vi.fn().mockResolvedValue({}),
  ) => {
    render(
      <ActivityReview
        actions={{ approve, sendBack }}
        activityName="Youth leadership camp"
        details={<p>Details</p>}
        heading={<h1>Youth leadership camp</h1>}
        officerName="N. Wijesinghe"
        subtitle="Pahala Kosgama SSS · sent by N. Wijesinghe"
      />,
    );
    return { approve, sendBack };
  };

  const dimension = (name: string) =>
    within(screen.getByRole("group", { name: /Sarvodaya Dimensions/ })).getByRole("checkbox", { name });
  const category = (name: string) =>
    within(screen.getByRole("group", { name: /Sarvodaya Categories/ })).getByRole("checkbox", { name });

  async function chooseAll() {
    await userEvent.click(dimension("Governance"));
    await userEvent.click(dimension("Social"));
    await userEvent.click(category("Governance"));
    await userEvent.click(category("Community Education"));
    await userEvent.click(screen.getByRole("button", { name: "SDG 16: Peace, Justice and Strong Institutions" }));
    await userEvent.click(screen.getByRole("button", { name: "SDG 4: Quality Education" }));
  }

  it("shows the three dimension pictures and ten categories in order, each a checkbox", () => {
    renderReview();
    const dimensions = within(screen.getByRole("group", { name: /Sarvodaya Dimensions/ })).getAllByRole("checkbox");
    expect(dimensions.map((box) => box.getAttribute("value"))).toEqual(["SOCIAL", "ECONOMIC", "GOVERNANCE"]);
    const pictures = screen.getByRole("group", { name: /Sarvodaya Dimensions/ }).querySelectorAll("img");
    expect([...pictures].map((img) => img.getAttribute("src"))).toEqual([
      "/development-goals/social.png",
      "/development-goals/economic.png",
      "/development-goals/governance.png",
    ]);
    const categories = within(screen.getByRole("group", { name: /Sarvodaya Categories/ })).getAllByRole("checkbox");
    expect(categories.map((box) => box.getAttribute("value"))).toEqual([...ACTIVITY_CATEGORIES]);
    expect(screen.getAllByText("None selected yet")).toHaveLength(2);
  });

  it("lets several dimensions and categories be chosen independently, and says which", async () => {
    renderReview();
    const social = dimension("Social");
    await userEvent.click(social);
    expect(social).toBeChecked();
    expect(dimension("Social")).toBeChecked();
    // Keyboard: Tab past Economic to Governance, Space to choose it.
    await userEvent.keyboard("{Tab}{Tab} ");
    expect(dimension("Governance")).toBeChecked();
    expect(dimension("Economic")).not.toBeChecked();
    expect(screen.getByText("2 selected: Social and Governance")).toBeInTheDocument();
    // A dimension does not choose or limit any category.
    expect(within(screen.getByRole("group", { name: /Sarvodaya Categories/ })).queryAllByRole("checkbox", { checked: true })).toHaveLength(0);
    await userEvent.click(category("Agriculture"));
    await userEvent.click(category("Culture"));
    expect(screen.getByText("2 selected: Culture and Agriculture")).toBeInTheDocument();
  });

  it("blocks approval until a dimension, a category and a UN SDG are chosen, keeping other choices", async () => {
    const { approve } = renderReview();
    await userEvent.click(dimension("Economic"));
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const summary = await screen.findByRole("alert");
    expect(summary).toHaveTextContent("Before you approve, choose at least one Sarvodaya dimension");
    await waitFor(() => expect(summary).toHaveFocus());
    expect(screen.queryByText("Choose at least one Sarvodaya dimension.")).not.toBeInTheDocument();
    expect(screen.getByText("Choose at least one Sarvodaya category.")).toBeInTheDocument();
    expect(screen.getByText("Choose at least one UN SDG to approve.")).toBeInTheDocument();
    expect(category("Community Education")).toHaveAccessibleDescription(/Choose at least one Sarvodaya category/);
    expect(dimension("Economic")).toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();
  });

  it("shows the choices before approving, and Back to Edit changes nothing", async () => {
    const { approve } = renderReview();
    await chooseAll();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve Youth leadership camp?" });
    expect(within(dialog).getByText("Pahala Kosgama SSS · sent by N. Wijesinghe")).toBeInTheDocument();
    expect(within(dialog).getByText("Development Goals You Chose")).toBeInTheDocument();
    // Shown in catalogue order, not click order.
    expect(within(dialog).getAllByRole("listitem").slice(0, 4).map((item) => item.textContent)).toEqual([
      "Social",
      "Governance",
      "Community Education",
      "Governance",
    ]);
    expect(within(dialog).getByText(/N. Wijesinghe is notified/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: "Approve Activity" })).toHaveFocus();

    await userEvent.click(within(dialog).getByRole("button", { name: "Back to Edit" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and Approve" })).toHaveFocus();
    expect(dimension("Governance")).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();
  });

  it("sends the dimensions, categories and UN SDGs once, in catalogue order", async () => {
    let finish: (value: ApproveResult) => void = () => undefined;
    const approve = vi.fn(() => new Promise<ApproveResult>((resolve) => (finish = resolve)));
    renderReview(approve);
    await chooseAll();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    const confirm = screen.getByRole("button", { name: "Approve Activity" });
    await userEvent.click(confirm);
    await userEvent.click(confirm);
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith({ dimensions: ["SOCIAL", "GOVERNANCE"], categories: ["COMMUNITY_EDUCATION", "GOVERNANCE"], sdgs: [4, 16] });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Approving…/ })).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Back to Edit" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send Back" })).toBeDisabled();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await act(async () => finish({}));
  });

  it("keeps the choices after a failed save and offers Try Again, never a false success", async () => {
    const approve = vi.fn<(input: ActivityApprovalInput) => Promise<ApproveResult>>().mockResolvedValueOnce({ kind: "failed" }).mockResolvedValue({});
    renderReview(approve);
    await chooseAll();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve Activity" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Could not approve. Check your connection and try again — your selections are kept.");
    expect(within(dialog).queryByText(/approved/i)).not.toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole("button", { name: "Back to Edit" }));
    expect(dimension("Social")).toBeChecked();
    expect(category("Community Education")).toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve Activity" }));
    expect(approve).toHaveBeenCalledTimes(2);
  });

  it("does not offer a second decision on a changed or already-decided activity", async () => {
    refresh.mockClear();
    const approve = vi.fn<(input: ActivityApprovalInput) => Promise<ApproveResult>>().mockResolvedValue({ kind: "stale", error: "This activity is no longer waiting for approval" });
    renderReview(approve);
    await chooseAll();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    await userEvent.click(screen.getByRole("button", { name: "Approve Activity" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("nothing was approved");
    expect(within(dialog).queryByRole("button", { name: /Approve|Try Again/ })).not.toBeInTheDocument();
    // Reload Activity is the only way on: no Back to Edit, and Escape does not dismiss it.
    expect(within(dialog).queryByRole("button", { name: "Back to Edit" })).not.toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(within(dialog).queryByRole("button", { name: "Back to Edit" })).not.toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Reload Activity" }));
    expect(refresh).toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // A new review session: the earlier choices are not carried over to the reloaded version.
    expect(dimension("Social")).not.toBeChecked();
    expect(category("Community Education")).not.toBeChecked();
    await userEvent.click(screen.getByRole("button", { name: "Review and Approve" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("sends back with an optional note to the Society Officer", async () => {
    const { sendBack, approve } = renderReview();
    await userEvent.click(screen.getByRole("button", { name: "Send Back" }));
    const dialog = screen.getByRole("dialog", { name: "Send Back to N. Wijesinghe?" });
    expect(within(dialog).getByLabelText("What should change? (optional)")).toHaveFocus();
    await userEvent.type(within(dialog).getByLabelText("What should change? (optional)"), "Split by ward");
    await userEvent.click(within(dialog).getByRole("button", { name: "Send Back" }));
    expect(sendBack).toHaveBeenCalledWith("Split by ward");
    expect(approve).not.toHaveBeenCalled();
  });

  it("shows the journey in Sinhala", async () => {
    render(
      <I18nProvider available={["en", "si", "ta"]} locale="si" messages={si}>
        <ActivityReview
          actions={{ approve: vi.fn(), sendBack: vi.fn() }}
          activityName="Youth leadership camp"
          details={null}
          heading={null}
          officerName="N. Wijesinghe"
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("button", { name: si["goals.reviewApprove"] })).toBeInTheDocument();
    expect(screen.getByRole("group", { name: new RegExp(si["goals.dimensions"]) })).toBeInTheDocument();
    expect(screen.getByRole("checkbox", { name: si["sector.1"] })).toBeInTheDocument();
  });
});

describe("V5 M13 / D05 Registrar documents", () => {
  const registrar: SocietyRegistrarDocuments = {
    societyId: "s1",
    financialYear: { startYear: 2025, label: "FY 2025/26" },
    submitted: 2,
    missing: 2,
    documents: [
      {
        documentType: "AUDIT_REPORT",
        document: {
          id: "d1",
          fileName: "Audit_Report_FY2025-26.pdf",
          contentType: "application/pdf",
          sizeBytes: 1_800_000,
          version: 1,
          uploadedAt: "2026-10-22T05:00:00.000Z",
          uploadedBy: { displayName: "N. Wijesinghe", role: "SOCIETY_OFFICER" },
          canOpen: true,
        },
      },
      { documentType: "AGM_MINUTES", document: null },
      { documentType: "OFFICE_BEARER_LIST", document: null },
      {
        documentType: "MEMBERS_LIST",
        document: {
          id: "d4",
          fileName: "members.pdf",
          contentType: "application/pdf",
          sizeBytes: 400_000,
          version: 1,
          uploadedAt: "2026-03-20T05:00:00.000Z",
          uploadedBy: { displayName: "S. Karunaratne", role: "PROGRAMME_COORDINATOR" },
          canOpen: false,
        },
      },
    ],
  };

  it("counts uploaded documents and says Not submitted for the missing ones", () => {
    render(<RegistrarDocumentsList registrar={registrar} societyId="s1" />);
    expect(screen.getByText("2 of 4")).toBeInTheDocument();
    expect(screen.getAllByText("Not submitted")).toHaveLength(2);
    expect(screen.getAllByText("Uploaded")).toHaveLength(2);
    expect(screen.getByText(/Audit_Report_FY2025-26.pdf · 1.8 MB · uploaded 22 Oct 2026 by N. Wijesinghe \(Society Officer\)/)).toBeInTheDocument();
  });

  it("does not offer the signed members list to roles that cannot open it", () => {
    render(<RegistrarDocumentsList registrar={registrar} societyId="s1" />);
    expect(screen.getByText("DM and HQ only")).toBeInTheDocument();
    expect(screen.getAllByRole("link", { name: "Open" })).toHaveLength(1);
  });
});
