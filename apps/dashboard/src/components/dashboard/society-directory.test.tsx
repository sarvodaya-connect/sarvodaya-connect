import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { DistrictSummary, SocietySummary } from "@sarvodaya-connect/api-contracts";
import { SocietyDirectory } from "./society-directory";

const district: DistrictSummary = { id: "district-1", code: "N", nameEn: "North", societyCount: 1 };
const society: SocietySummary = { id: "society-1", societyCode: "DEMO-001", nameEn: "Example Sunrise Society", district: { id: district.id, code: district.code, nameEn: district.nameEn }, status: "ACTIVE", verificationStatus: "UNVERIFIED", profileCompleteness: 75, updatedAt: "2026-10-20T08:00:00.000Z", grade: "B", dsDivision: "North Division", memberCount: 22, spcName: "P. Coordinator", spcUserId: "spc-1", societyOfficerName: "Officer", hasOpenGradeRequest: false };
const result = { data: [society], meta: { page: 1, pageSize: 10, totalItems: 1, totalPages: 1 } };
const response = (body: unknown, ok = true) => Promise.resolve({ ok, json: async () => body });
afterEach(() => vi.unstubAllGlobals());

describe("SocietyDirectory", () => {
  it("renders API records and applies filters through the scoped API", async () => {
    const fetch = vi.fn().mockResolvedValue(response(result));
    vi.stubGlobal("fetch", fetch);
    render(<SocietyDirectory districts={[district]} societies={[society]} initialTotal={1} />);
    expect(await screen.findByRole("link", { name: "Example Sunrise Society" })).toHaveAttribute("href", "/societies/society-1");
    await userEvent.setup().selectOptions(screen.getByRole("combobox", { name: "Filter by grade" }), "B");
    await waitFor(() => expect(fetch).toHaveBeenLastCalledWith(expect.stringContaining("grade=B"), { cache: "no-store" }));
  });

  it("shows a retryable error when results fail to load", async () => {
    const fetch = vi.fn().mockResolvedValue(response({ error: { message: "failed" } }, false));
    vi.stubGlobal("fetch", fetch);
    render(<SocietyDirectory districts={[district]} societies={[society]} initialTotal={1} />);
    expect(await screen.findByText(/Society results couldn't be loaded/)).toBeInTheDocument();
  });

  it("shows a no-societies state for an empty authorized registry scope", () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(response({ data: [], meta: { page: 1, pageSize: 10, totalItems: 0, totalPages: 0 } })));
    render(<SocietyDirectory districts={[]} societies={[]} initialTotal={0} />);
    expect(screen.getByRole("heading", { name: "No societies in your permitted scope" })).toBeInTheDocument();
  });
});
