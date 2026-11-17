import { act, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { describe, expect, it, vi } from "vitest";

import { DEFAULT_LOCALE } from "@/i18n/config";
import { en } from "@/i18n/messages/en";
import { si } from "@/i18n/messages/si";
import { I18nProvider } from "@/i18n/provider";
import { cleanGoals, type DevelopmentGoals } from "@/lib/development-goals";

import type { ApprovalResult } from "@/app/(spc)/activities-to-approve/actions";

import { ActivityReview } from "./activity-review";

vi.mock("next/link", () => ({
  default: ({ children, href, ...props }: { children: ReactNode; href: string }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

type Approve = (goals: DevelopmentGoals) => Promise<ApprovalResult>;
type SendBack = (comment: string) => Promise<{ error?: string }>;

function renderReview({
  approve = vi.fn<Approve>().mockResolvedValue({}),
  sendBack = vi.fn<SendBack>().mockResolvedValue({}),
}: { approve?: ReturnType<typeof vi.fn<Approve>>; sendBack?: ReturnType<typeof vi.fn<SendBack>> } = {}) {
  render(
    <ActivityReview
      actions={{ approve, sendBack }}
      activityName="Youth leadership camp"
      details={<p>Details</p>}
      heading={<h1>Youth leadership camp</h1>}
      officerName="N. Wijesinghe"
      subtitle="Pahala Kosgama SSS · sent by N. Wijesinghe (Society Officer)"
    />,
  );
  return { approve, sendBack };
}

const user = () => userEvent.setup();

const dimension = (name: string) => within(screen.getByRole("group", { name: /Sarvodaya Dimensions/ })).getByRole("checkbox", { name });
const category = (name: string) => within(screen.getByRole("group", { name: /Sarvodaya Categories/ })).getByRole("checkbox", { name });

async function chooseAll(u: ReturnType<typeof userEvent.setup>) {
  await u.click(dimension("Governance"));
  await u.click(dimension("Social"));
  await u.click(category("Governance"));
  await u.click(category("Community Education"));
  await u.click(screen.getByRole("button", { name: "SDG 16: Peace, Justice and Strong Institutions" }));
  await u.click(screen.getByRole("button", { name: "SDG 4: Quality Education" }));
}

describe("V6 SP07g Development Goals choices", () => {
  it("shows the three dimension pictures as checkboxes, all unselected", () => {
    renderReview();
    const dimensions = within(screen.getByRole("group", { name: /Sarvodaya Dimensions/ })).getAllByRole("checkbox");
    expect(dimensions).toHaveLength(3);
    expect(dimensions.map((box) => (box as HTMLInputElement).value)).toEqual(["SOCIAL", "ECONOMIC", "GOVERNANCE"]);
    for (const box of dimensions) expect(box).not.toBeChecked();
    const pictures = screen.getByRole("group", { name: /Sarvodaya Dimensions/ }).querySelectorAll("img");
    expect([...pictures].map((img) => img.getAttribute("src"))).toEqual([
      "/dimensions/social.png",
      "/dimensions/economic.png",
      "/dimensions/governance.png",
    ]);
    expect(screen.getAllByText("None selected yet")).toHaveLength(2);
  });

  it("lists the ten categories in the confirmed order", () => {
    renderReview();
    const categories = within(screen.getByRole("group", { name: /Sarvodaya Categories/ })).getAllByRole("checkbox");
    expect(categories.map((box) => (box as HTMLInputElement).value)).toEqual([
      "COMMUNITY_EDUCATION",
      "CHILD_WELLBEING",
      "CULTURE",
      "ECONOMY",
      "GOVERNANCE",
      "HEALTH_NUTRITION",
      "HOUSING_INFRASTRUCTURE",
      "SPIRITUAL_DEVELOPMENT",
      "AGRICULTURE",
      "ENVIRONMENT",
    ]);
  });

  it("allows several dimensions and categories, chosen independently, and summarises them in catalogue order", async () => {
    const u = user();
    renderReview();
    await u.click(dimension("Governance"));
    await u.click(dimension("Social"));
    expect(screen.getByText("2 selected: Social and Governance")).toBeInTheDocument();
    expect(dimension("Social")).toBeChecked();
    // Choosing the Governance dimension does not choose the Governance category.
    expect(category("Governance")).not.toBeChecked();
    await u.click(category("Environment"));
    await u.click(category("Culture"));
    expect(screen.getByText("2 selected: Culture and Environment")).toBeInTheDocument();
    await u.click(category("Culture"));
    expect(screen.getByText("1 selected: Environment")).toBeInTheDocument();
  });

  it("works from the keyboard: Space toggles the focused card", async () => {
    const u = user();
    renderReview();
    const economic = dimension("Economic");
    economic.focus();
    await u.keyboard(" ");
    expect(economic).toBeChecked();
    await u.keyboard(" ");
    expect(economic).not.toBeChecked();
  });
});

describe("V6 SP07g blocked approval", () => {
  it("names every missing choice, keeps the others and saves nothing", async () => {
    const u = user();
    const { approve } = renderReview();
    await u.click(category("Culture"));
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Before you approve, choose at least one Sarvodaya dimension, one Sarvodaya category and one UN SDG. Your other choices are kept.",
    );
    expect(screen.getByRole("alert")).toHaveFocus();
    expect(screen.getByText("Select at least one Sarvodaya dimension.")).toBeInTheDocument();
    expect(screen.queryByText("Select at least one Sarvodaya category.")).not.toBeInTheDocument();
    expect(screen.getByText("Choose at least one UN SDG to approve.")).toBeInTheDocument();
    expect(screen.getByRole("group", { name: /Sarvodaya Dimensions/ })).toHaveAttribute("aria-invalid", "true");
    expect(category("Culture")).toBeChecked();
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();
  });

  it("clears each message as soon as that choice is made", async () => {
    const u = user();
    renderReview();
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    await u.click(dimension("Social"));
    expect(screen.queryByText("Select at least one Sarvodaya dimension.")).not.toBeInTheDocument();
    expect(screen.getByText("Select at least one Sarvodaya category.")).toBeInTheDocument();
  });
});

describe("V6 SP07r → SP07s → SP08g approval", () => {
  it("shows the chosen goals before approving and sends the codes in catalogue order", async () => {
    const u = user();
    const { approve } = renderReview();
    await chooseAll(u);
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    const dialog = screen.getByRole("dialog", { name: "Approve Youth leadership camp?" });
    expect(within(dialog).getByText("Development Goals You Chose")).toBeInTheDocument();
    expect(within(dialog).getByText("Social")).toBeInTheDocument();
    expect(within(dialog).getByText("Community Education")).toBeInTheDocument();
    expect(within(dialog).getByText("Peace, Justice and Strong Institutions")).toBeInTheDocument();
    expect(within(dialog).getByText(/N. Wijesinghe is notified/)).toBeInTheDocument();
    expect(approve).not.toHaveBeenCalled();
    expect(within(dialog).getByRole("button", { name: "Approve Activity" })).toHaveFocus();
    await u.click(within(dialog).getByRole("button", { name: "Approve Activity" }));
    expect(approve).toHaveBeenCalledTimes(1);
    expect(approve).toHaveBeenCalledWith({
      dimensions: ["SOCIAL", "GOVERNANCE"],
      categories: ["COMMUNITY_EDUCATION", "GOVERNANCE"],
      sdgs: [4, 16],
    });
  });

  it("Back to edit and Escape close the dialog without approving and keep every choice", async () => {
    const u = user();
    const { approve } = renderReview();
    await chooseAll(u);
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    await u.click(screen.getByRole("button", { name: "Back to Edit" }));
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Review and Approve" })).toHaveFocus();
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    await u.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    expect(dimension("Social")).toBeChecked();
    expect(approve).not.toHaveBeenCalled();
  });

  it("turns everything off while approving and sends the approval only once", async () => {
    const u = user();
    let finish: (value: ApprovalResult) => void = () => undefined;
    const approve = vi.fn<Approve>(() => new Promise((resolve) => (finish = resolve)));
    renderReview({ approve });
    await chooseAll(u);
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    const dialog = screen.getByRole("dialog");
    await u.click(within(dialog).getByRole("button", { name: "Approve Activity" }));
    const approving = within(dialog).getByRole("button", { name: /Approving…/ });
    expect(approving).toBeDisabled();
    expect(within(dialog).getByRole("button", { name: "Back to Edit" })).toBeDisabled();
    expect(dialog).toHaveAttribute("aria-busy", "true");
    await u.keyboard("{Escape}");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    await u.click(approving);
    expect(approve).toHaveBeenCalledTimes(1);
    expect(dimension("Social")).toBeDisabled();
    await act(async () => finish({}));
  });

  it("SP07x: a failed approval keeps the choices, never shows success and can be tried again", async () => {
    const u = user();
    const approve = vi
      .fn<Approve>()
      .mockResolvedValueOnce({ error: "Could not approve. Check your connection and try again. Your selections are kept.", kind: "failed" })
      .mockResolvedValueOnce({});
    renderReview({ approve });
    await chooseAll(u);
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    await u.click(screen.getByRole("button", { name: "Approve Activity" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent("Could not approve. Check your connection and try again.");
    expect(screen.queryByText(/Approved:/)).not.toBeInTheDocument();
    expect(within(dialog).getByText("Social")).toBeInTheDocument();
    await u.click(within(dialog).getByRole("button", { name: "Try Again" }));
    expect(approve).toHaveBeenCalledTimes(2);
    expect(approve.mock.calls[1]![0]).toEqual(approve.mock.calls[0]![0]);
  });

  it("shows the API's refusal message for a refused choice", async () => {
    const u = user();
    renderReview({ approve: vi.fn<Approve>().mockResolvedValue({ error: "Request validation failed: categories: must be unique", kind: "invalid" }) });
    await chooseAll(u);
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    await u.click(screen.getByRole("button", { name: "Approve Activity" }));
    expect(within(screen.getByRole("dialog")).getByRole("alert")).toHaveTextContent("categories: must be unique");
  });

  it("an activity already decided elsewhere offers no second decision", async () => {
    const u = user();
    const stale = "This activity is no longer waiting for you. It may already have been approved or sent back, so nothing was changed.";
    const approve = vi.fn<Approve>().mockResolvedValue({ error: stale, kind: "stale" });
    renderReview({ approve });
    await chooseAll(u);
    await u.click(screen.getByRole("button", { name: "Review and Approve" }));
    await u.click(screen.getByRole("button", { name: "Approve Activity" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("alert")).toHaveTextContent(stale);
    expect(within(dialog).queryByRole("button", { name: /Approve|Try Again/ })).not.toBeInTheDocument();
    expect(within(dialog).getByRole("link", { name: "Back to Activities to Approve" })).toHaveAttribute("href", "/activities-to-approve");
    await u.keyboard("{Escape}");
    expect(screen.getByRole("button", { name: "Review and Approve" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Send Back" })).toBeDisabled();
    expect(approve).toHaveBeenCalledTimes(1);
  });

  it("keeps the send-back workflow with an optional note", async () => {
    const u = user();
    const { sendBack, approve } = renderReview();
    await u.click(screen.getByRole("button", { name: "Send Back" }));
    const dialog = screen.getByRole("dialog", { name: "Send Back to N. Wijesinghe?" });
    await u.type(within(dialog).getByLabelText("What should change? (optional)"), "Split by ward");
    await u.click(within(dialog).getByRole("button", { name: "Send Back" }));
    expect(sendBack).toHaveBeenCalledWith("Split by ward");
    expect(approve).not.toHaveBeenCalled();
  });
});

describe("Development Goals in Sinhala", () => {
  it("uses the reader's language for the headings, pictures' names and summaries", async () => {
    const u = user();
    render(
      <I18nProvider available={["en", "si"]} locale="si" messages={si}>
        <ActivityReview
          actions={{ approve: vi.fn<Approve>().mockResolvedValue({}), sendBack: vi.fn<SendBack>() }}
          activityName="Youth leadership camp"
          details={null}
          heading={null}
          officerName="N. Wijesinghe"
        />
      </I18nProvider>,
    );
    expect(screen.getByRole("heading", { name: si["dg.title"] })).toBeInTheDocument();
    await u.click(within(screen.getByRole("group", { name: new RegExp(si["dg.dimensions"]) })).getByRole("checkbox", { name: si["dimension.SOCIAL"] }));
    expect(screen.getByText(`1ක් තෝරා ඇත: ${si["dimension.SOCIAL"]}`)).toBeInTheDocument();
    expect(DEFAULT_LOCALE).toBe("en");
    expect(en["dg.title"]).toBe("Development Goals");
  });
});

describe("cleanGoals", () => {
  it("keeps only known codes and goals, once each, in catalogue order", () => {
    expect(
      cleanGoals({
        dimensions: ["GOVERNANCE", "SOCIAL", "SOCIAL", "Culture", 3],
        categories: ["ENVIRONMENT", "CULTURE", "sector"],
        sdgs: [16, 4, 4, 0, 18, "5", 2.5],
      }),
    ).toEqual({ dimensions: ["SOCIAL", "GOVERNANCE"], categories: ["CULTURE", "ENVIRONMENT"], sdgs: [4, 16] });
    expect(cleanGoals({ dimensions: "SOCIAL", categories: null, sdgs: undefined })).toEqual({ dimensions: [], categories: [], sdgs: [] });
  });
});
