import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { canSeeSociety, canViewDocument, getViewer } from "@/lib/access";
import { complianceRecords } from "@/lib/demo-compliance";
import { EMPTY_DOCUMENT_FILTERS, libraryDocuments } from "@/lib/demo-documents";
import { districts } from "@/lib/demo-registry";

import { DocumentLibrary } from "./document-library";

const allSocieties = complianceRecords.map((record) => ({ id: record.societyId, name: record.societyName }));

function renderLibrary(props: Partial<React.ComponentProps<typeof DocumentLibrary>> = {}) {
  const user = userEvent.setup();
  render(
    <DocumentLibrary
      districts={districts}
      documents={libraryDocuments}
      registrarRecords={complianceRecords}
      societies={allSocieties}
      {...props}
    />,
  );
  return { user };
}

const previewButtons = () => screen.queryAllByRole("button", { name: /^Preview / });

describe("DocumentLibrary", () => {
  it("lists every fictional document with the Registrar strip first", () => {
    renderLibrary();

    expect(previewButtons()).toHaveLength(libraryDocuments.length);
    expect(screen.getByText(`Showing ${libraryDocuments.length} of ${libraryDocuments.length} documents`)).toBeInTheDocument();
    const strip = screen.getByRole("region", { name: "Annual documents to the Registrar · FY 2025/26" });
    expect(within(strip).getByText("1 · Audit report")).toBeInTheDocument();
    expect(within(strip).getByText("4 · Members list")).toBeInTheDocument();
  });

  it("finds documents by name and by text inside the scanned file", async () => {
    const { user } = renderLibrary();
    const search = screen.getByRole("searchbox", { name: "Search documents" });

    await user.type(search, "Wellawa");
    expect(previewButtons()).toHaveLength(4);

    await user.clear(search);
    await user.type(search, "volunteers");
    expect(previewButtons()).toHaveLength(1);
    expect(screen.getByRole("button", { name: /^Preview Tank cleaning photos/ })).toBeInTheDocument();
    expect(screen.getByText("Found in scanned text")).toBeInTheDocument();
  });

  it("filters by district, society, document type and status", async () => {
    const { user } = renderLibrary();

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by district" }), "district-kandy");
    expect(previewButtons()).toHaveLength(4);

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by district" }), "all");
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by society" }), "society-galewela");
    expect(previewButtons().every((button) => button.getAttribute("aria-label")!.includes("Galewela"))).toBe(true);

    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by society" }), "all");
    const categories = screen.getByRole("navigation", { name: "Document categories" });
    await user.click(within(categories).getByRole("button", { name: /AGM minutes/ }));
    expect(within(categories).getByRole("button", { name: /AGM minutes/ })).toHaveAttribute("aria-pressed", "true");
    expect(previewButtons()).toHaveLength(6);

    await user.click(within(categories).getByRole("button", { name: /All documents/ }));
    await user.selectOptions(screen.getByRole("combobox", { name: "Filter by status" }), "REJECTED");
    expect(previewButtons().map((button) => button.getAttribute("aria-label"))).toEqual([
      "Preview AGM minutes 2026 from Kundasale Sarvodaya Shramadana Society",
      "Preview Audit report FY 2025/26 from Wellawa Sarvodaya Shramadana Society",
    ]);
  });

  it("shows the active filters when nothing matches and clears them", async () => {
    const { user } = renderLibrary();

    await user.type(screen.getByRole("searchbox", { name: "Search documents" }), "cyclone");

    expect(screen.getByRole("heading", { name: "No documents match your filters" })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Clear all filters" }));
    expect(previewButtons()).toHaveLength(libraryDocuments.length);
  });

  it("previews a document without allowing a download of demonstration files", async () => {
    const { user } = renderLibrary();

    await user.click(screen.getByRole("button", { name: /^Preview Tank cleaning photos/ }));

    const preview = screen.getByRole("complementary", { name: "Document preview" });
    expect(within(preview).getByRole("heading", { name: "Tank cleaning photos" })).toBeInTheDocument();
    expect(within(preview).getByRole("button", { name: "Download" })).toBeDisabled();
    expect(within(preview).getByRole("link", { name: "Open society" })).toHaveAttribute(
      "href",
      "/societies/society-pahala-kosgama",
    );
  });

  it("never shows restricted documents to a programme coordinator", async () => {
    const viewer = getViewer("programme-coordinator");
    const { user } = renderLibrary({
      documents: libraryDocuments.filter((document) => canViewDocument(viewer, document)),
      registrarRecords: undefined,
      roleNotice: "Audit, Registrar, finance and signed members-list files are not shown for your role.",
      societies: allSocieties.filter((society) =>
        complianceRecords.some((record) => record.societyId === society.id && canSeeSociety(viewer, record)),
      ),
    });

    expect(previewButtons()).toHaveLength(3);
    expect(screen.getByText(/not shown for your role/)).toBeInTheDocument();
    expect(screen.queryByRole("region", { name: /Annual documents to the Registrar/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/District Manager and HQ only/)).not.toBeInTheDocument();

    await user.type(screen.getByRole("searchbox", { name: "Search documents" }), "members");
    expect(screen.getByRole("heading", { name: "No documents match your filters" })).toBeInTheDocument();
  });

  it("marks the signed members list as District Manager and HQ only for reviewers", () => {
    const viewer = getViewer("district-manager");
    renderLibrary({ documents: libraryDocuments.filter((document) => canViewDocument(viewer, document)) });

    expect(screen.getAllByText(/District Manager and HQ only/).length).toBeGreaterThan(0);
    expect(previewButtons().every((button) => !button.getAttribute("aria-label")!.includes("Galewela"))).toBe(true);
  });

  it("opens filtered to a society from a notification link", () => {
    renderLibrary({ initialFilters: { ...EMPTY_DOCUMENT_FILTERS, societyId: "society-wellawa" } });

    expect(previewButtons()).toHaveLength(4);
    expect(screen.getByText(`Showing 4 of ${libraryDocuments.length} documents`)).toBeInTheDocument();
  });

  it("shows an empty state when there are no documents", () => {
    renderLibrary({ documents: [] });

    expect(screen.getByRole("heading", { name: "No documents yet" })).toBeInTheDocument();
  });
});
