import { beforeEach, expect, it, vi } from "vitest";

const { getActivity, getSocietyRecord, notFound } = vi.hoisted(() => ({
  getActivity: vi.fn(),
  getSocietyRecord: vi.fn(),
  notFound: vi.fn(() => { throw new Error("NOT_FOUND"); }),
}));

vi.mock("next/navigation", () => ({ notFound }));
vi.mock("@/lib/activities-api", () => ({ getActivity }));
vi.mock("@/lib/society-record-api", () => ({ getSocietyRecord }));
vi.mock("@/i18n/server", async () => {
  const { ENGLISH } = await import("@/i18n/english");
  return { getT: async () => ENGLISH };
});

import { RecheckOnReturn } from "@/components/dashboard/district-access/recheck-on-return";
import WorkPlanActivityPage from "./page";

const id = "29000000-0000-4000-8000-000000000101";
const activityId = "29000000-0000-4000-8000-000000000102";
const props = { params: Promise.resolve({ id, activityId }), searchParams: Promise.resolve({}) };

beforeEach(() => {
  vi.clearAllMocks();
  getSocietyRecord.mockResolvedValue({ permissions: {} });
  getActivity.mockResolvedValue({ name: "Youth camp", society: { id } });
});

it("loads the activity under the signed-in viewer's identity", async () => {
  await WorkPlanActivityPage(props);
  expect(getActivity).toHaveBeenCalledWith(activityId);
});

it("does not render a record under a different society", async () => {
  getActivity.mockResolvedValue({ society: { id: "another-society" } });
  await expect(WorkPlanActivityPage(props)).rejects.toThrow("NOT_FOUND");
});

it("rechecks restored activity details for temporary district access", async () => {
  getSocietyRecord.mockResolvedValue({ permissions: { viewOnlyReason: "TEMPORARY_DISTRICT_ACCESS" } });
  const page = await WorkPlanActivityPage(props);
  expect(page.type).toBe(RecheckOnReturn);
});
