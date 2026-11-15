import { isValidElement, type ReactElement, type ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { getDesktopViewer, getGradeRequests, getSocietyDocuments, getSocietyRecord, getWorkPlan } = vi.hoisted(() => ({
  getDesktopViewer: vi.fn(),
  getGradeRequests: vi.fn(),
  getSocietyDocuments: vi.fn(),
  getSocietyRecord: vi.fn(),
  getWorkPlan: vi.fn(),
}));

vi.mock("@/lib/current-viewer", () => ({ getDesktopViewer }));
vi.mock("@/lib/society-record-api", () => ({ getGradeRequests, getSocietyDocuments, getSocietyRecord, getWorkPlan }));
vi.mock("@/i18n/server", async () => {
  const { en } = await import("@/i18n/messages/en");
  const { createTranslator } = await import("@/i18n/translate");
  return { getT: async () => createTranslator(en, "en") };
});

import SocietyRecordLayout from "./layout";
import { RecordHeader } from "@/components/dashboard/society-record/record-header";

const ID = "29000000-0000-4000-8000-000000000101";

function findHeader(node: ReactNode): ReactElement<{ tabs: { href: string; label: string }[] }> | undefined {
  if (!isValidElement(node)) return undefined;
  if (node.type === RecordHeader) return node as ReactElement<{ tabs: { href: string; label: string }[] }>;
  const children = (node.props as { children?: ReactNode }).children;
  for (const child of Array.isArray(children) ? children : [children]) {
    const found = findHeader(child);
    if (found) return found;
  }
  return undefined;
}

/** The society record tabs come in the same order as on the phone and in the prototype. */
describe("Society record tabs", () => {
  beforeEach(() => {
    getDesktopViewer.mockResolvedValue({ role: "HQ_ADMIN", displayName: "Fictional HQ" });
    getSocietyRecord.mockResolvedValue({ committee: [{ isActive: true }], permissions: {} });
    getWorkPlan.mockResolvedValue({ year: 2027, activities: [] });
    getSocietyDocuments.mockResolvedValue({ total: 0 });
    getGradeRequests.mockResolvedValue([]);
  });

  it("puts Members & Exco, then the Village Economic Profile, before the Work Plan", async () => {
    const page = await SocietyRecordLayout({ children: null, params: Promise.resolve({ id: ID }) } as never);
    const tabs = findHeader(page)!.props.tabs;
    expect(tabs.map((tab) => tab.label)).toEqual([
      "Overview",
      "Members & Exco",
      "Village Economic Profile",
      "Work Plan 2027",
      "Documents",
      "Grade",
      "History",
    ]);
    expect(tabs[2]!.href).toBe(`/societies/${ID}/economy`);
  });
});
