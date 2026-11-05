import { render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDesktopViewer, getSocietyRecord, getStaffOptions, getWorkPlan, refresh, assignStaff } = vi.hoisted(() => ({
  getDesktopViewer: vi.fn(),
  getSocietyRecord: vi.fn(),
  getStaffOptions: vi.fn(),
  getWorkPlan: vi.fn(),
  refresh: vi.fn(),
  assignStaff: vi.fn(),
}));

vi.mock("next/navigation", () => ({ useRouter: () => ({ refresh }) }));
vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer }));
vi.mock("@/lib/society-record-api", () => ({ getSocietyRecord, getStaffOptions, getWorkPlan }));
vi.mock("@/lib/platform-api", () => ({
  isTransientPlatformError: (error: { status?: number }) => error.status === 0 || (error.status ?? 0) >= 500,
}));
vi.mock("./record-actions", () => ({ assignStaff, updateSocietyRecord: vi.fn() }));
vi.mock("@/components/dashboard/society-record/record-overview", () => ({
  RecordOverview: ({ canAssign }: { canAssign: boolean }) => <p>Society overview {String(canAssign)}</p>,
}));
vi.mock("@/components/dashboard/society-record/edit-society-panel", () => ({ EditSocietyPanel: () => null }));

import userEvent from "@testing-library/user-event";

import { RecordOverviewPage } from "./record-overview-page";

const record = { id: "fictional-id", nameEn: "Fictional Society", societyCode: "S-90001", district: { nameEn: "Fictional District" }, permissions: { canEdit: true } };
const options = { districtManagers: [], deputies: [{ id: "d1", displayName: "Fictional DDM", assignedHere: true }], coordinators: [], officers: [] };

const open = async (panel = "assign") => render(await RecordOverviewPage({ id: record.id, panel }));

describe("the Assign Responsible Staff panel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getDesktopViewer.mockResolvedValue({ role: "HQ_ADMIN", displayName: "Fictional HQ" });
    getSocietyRecord.mockResolvedValue(record);
    getWorkPlan.mockResolvedValue(null);
    assignStaff.bind = () => assignStaff;
  });

  it("shows the form once the options load", async () => {
    getStaffOptions.mockResolvedValue(options);
    await open();
    expect(screen.getByRole("dialog", { name: "Assign Responsible Staff" })).toBeInTheDocument();
    expect(screen.getByText("Fictional DDM")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  describe.each([503, 0])("when the options stay unavailable (%i)", (status) => {
    beforeEach(() => {
      getStaffOptions.mockRejectedValue(Object.assign(new Error("Service Unavailable"), { status }));
    });

    it("keeps the society overview", async () => {
      await open();
      expect(screen.getByText("Society overview true")).toBeInTheDocument();
    });

    it("explains the problem and offers a retry", async () => {
      await open();
      expect(screen.getByRole("alert")).toHaveTextContent("We Couldn’t Load the Staff Choices");
      await userEvent.click(screen.getByRole("button", { name: "Try again" }));
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("offers nothing to submit, and does not look like an empty list or a save", async () => {
      const { container } = await open();
      expect(container.querySelector("form")).toBeNull();
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.queryByRole("button", { name: /save|assign/i })).not.toBeInTheDocument();
      expect(screen.getByRole("dialog")).not.toHaveTextContent(/saved|no staff|No DM has/i);
      expect(assignStaff).not.toHaveBeenCalled();
    });
  });

  it("does not hide a refusal behind the retry panel", async () => {
    getStaffOptions.mockRejectedValue(Object.assign(new Error("Forbidden"), { status: 403 }));
    await expect(open()).rejects.toThrow("Forbidden");
  });

  it("never asks for the options for someone other than HQ", async () => {
    getDesktopViewer.mockResolvedValue({ role: "PROGRAMME_COORDINATOR", displayName: "Fictional SPC" });
    await open();
    expect(getStaffOptions).not.toHaveBeenCalled();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });

  it("does not ask for the options on other panels", async () => {
    await open("edit");
    expect(getStaffOptions).not.toHaveBeenCalled();
  });
});
