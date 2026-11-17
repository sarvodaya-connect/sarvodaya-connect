import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import type { SocietyRegistrarDocuments } from "@sarvodaya-connect/api-contracts";

import { RegistrarDocumentsList } from "../documents/registrar-documents";
import { SdgSelector } from "../sdg/sdg-selector";

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
