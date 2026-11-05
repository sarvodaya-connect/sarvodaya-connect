import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { AssistantAnswer } from "@sarvodaya-connect/api-contracts";

import { demoAnswer } from "@/lib/sarvoai-demo";

const { askSarvoAi } = vi.hoisted(() => ({ askSarvoAi: vi.fn() }));
vi.mock("@/app/(dashboard)/sarvoai/actions", () => ({ askSarvoAi }));

import { SarvoAiChat } from "./sarvoai-chat";
import { RolePageNoAccess } from "../district-access/no-access-views";

const answer = (overrides: Partial<AssistantAnswer>): AssistantAnswer => ({
  kind: "ANSWER",
  summary: "Done.",
  options: [],
  details: { recordsUsed: [] },
  dataAsOf: "2026-11-03T04:35:00.000Z",
  ...overrides,
});

function renderChat(initialQuestion?: string) {
  return render(<SarvoAiChat demo={false} initialQuestion={initialQuestion} viewerId="hq-1" viewerInitials="DG" />);
}

async function ask(user: ReturnType<typeof userEvent.setup>, question: string) {
  await user.type(screen.getByLabelText("Ask SarvoAI"), question);
  await user.click(screen.getByRole("button", { name: "Ask" }));
}

describe("V5 D40–D49f SarvoAI", () => {
  beforeEach(() => {
    askSarvoAi.mockReset();
    window.localStorage.clear();
  });

  it("starts with the welcome, example questions and what SarvoAI uses (D40)", () => {
    renderChat();
    expect(screen.getByText("Collective Wisdom. Intelligent Impact.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Who is the president of a society\?/ })).toBeInTheDocument();
    expect(screen.getByText("Total profit for each year")).toBeInTheDocument();
    expect(screen.getByText(/member NICs, passwords/)).toBeInTheDocument();
    expect(screen.getByText("Questions you ask on this computer appear here.")).toBeInTheDocument();
  });

  it("shows that it is working with a small spinner, then the answer with its sources (D41–D44)", async () => {
    let resolve!: (value: unknown) => void;
    askSarvoAi.mockReturnValue(new Promise((done) => (resolve = done)));
    const user = userEvent.setup();
    renderChat();
    await ask(user, "What was the average profit for societies in Kurunegala in FY 2025/26?");

    expect(screen.getByRole("status")).toHaveTextContent("Working on it…");
    expect(screen.queryByRole("progressbar")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Stop" })).toBeInTheDocument();

    resolve({ ok: true, sample: false, answer: demoAnswer("average profit Kurunegala") });
    expect(await screen.findByText(/LKR 298,400 per society/)).toBeInTheDocument();
    expect(screen.getByText("88 societies included")).toBeInTheDocument();
    expect(screen.getByText("10 excluded · figures not added")).toBeInTheDocument();
    expect(screen.getByRole("table", { name: "Records behind this answer" })).toBeInTheDocument();
    expect(screen.getByText("-38,600")).toBeInTheDocument();
    expect(screen.queryByText("Sample data")).not.toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "How was this answered?" }));
    const dialog = screen.getByRole("dialog", { name: "How was this answered?" });
    expect(within(dialog).getByText(/Annual summary · total profit for the year/)).toBeInTheDocument();
    expect(within(dialog).getByText(/LKR 26,259,200 combined profit/)).toBeInTheDocument();
    expect(within(dialog).getByText(/left out, not counted as zero/)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    const recent = screen.getByText("Your recent questions").closest("section")!;
    expect(within(recent).getByRole("button", { name: /What was the average profit/ })).toBeInTheDocument();
  });

  it("shows backend source links and timestamps and filters unsafe destinations", async () => {
    askSarvoAi.mockResolvedValue({ ok: true, sample: false, answer: answer({
      details: { recordsUsed: ["Fictional profile"], sources: [
        { label: "Fictional profile", href: "/societies/00000000-0000-4000-8000-000000000001", updatedAt: "2026-11-03T04:35:00.000Z" },
        { label: "Requests", href: "/requests" },
        { label: "Unsafe external", href: "https://example.invalid" },
        { label: "Unsafe script", href: "javascript:alert(1)" },
        { label: "Unsafe relative", href: "//example.invalid" },
      ] },
    }) });
    const user = userEvent.setup();
    renderChat();
    await ask(user, "Fictional overview?");
    await user.click(await screen.findByRole("button", { name: "How was this answered?" }));
    const dialog = within(screen.getByRole("dialog", { name: "How was this answered?" }));
    expect(dialog.getByRole("link", { name: "Fictional profile" })).toHaveAttribute("href", "/societies/00000000-0000-4000-8000-000000000001");
    expect(dialog.getByRole("link", { name: "Requests" })).toHaveAttribute("href", "/requests");
    expect(dialog.getByText(/Record updated:/)).toBeInTheDocument();
    expect(dialog.queryByRole("link", { name: /Unsafe/ })).not.toBeInTheDocument();
  });

  it("sends earlier turns with a follow-up (D45)", async () => {
    askSarvoAi.mockResolvedValueOnce({ ok: true, sample: false, answer: answer({ summary: "Average was LKR 298,400." }) });
    askSarvoAi.mockResolvedValueOnce({ ok: true, sample: false, answer: answer({ summary: "Pahala Kosgama SSS had the highest." }) });
    const user = userEvent.setup();
    renderChat("What was the average profit in Kurunegala?");
    expect(await screen.findByText("Average was LKR 298,400.")).toBeInTheDocument();
    await ask(user, "Which of these had the highest profit?");
    expect(await screen.findByText("Pahala Kosgama SSS had the highest.")).toBeInTheDocument();
    expect(askSarvoAi).toHaveBeenLastCalledWith("Which of these had the highest profit?", [
      { role: "user", text: "What was the average profit in Kurunegala?" },
      { role: "assistant", text: "Average was LKR 298,400." },
    ]);
  });

  it("asks which meaning, then answers with the chosen one (D46–D47)", async () => {
    askSarvoAi.mockResolvedValueOnce({ ok: true, sample: false, answer: demoAnswer("more than LKR 100,000 profit in the last five years") });
    askSarvoAi.mockResolvedValueOnce({ ok: true, sample: false, answer: answer({ summary: "187 societies." }) });
    const user = userEvent.setup();
    renderChat("Which societies had more than LKR 100,000 profit in the last five years?");
    const choices = await screen.findAllByRole("radio");
    expect(choices).toHaveLength(3);
    await user.click(screen.getByRole("radio", { name: "More than LKR 100,000 combined over the five years" }));
    await user.click(screen.getByRole("button", { name: "Answer with this" }));
    expect(await screen.findByText("187 societies.")).toBeInTheDocument();
    expect(askSarvoAi.mock.calls[1]![0]).toBe("More than LKR 100,000 combined over the five years");
  });

  it.each([
    ["Mannar", "No societies match", "Try instead"],
    ["Mullaitivu average", "Only 6 of 17 societies have added their figures", "See the 11 not added"],
    ["Which are the best societies?", "What do you mean by “best”?", "Class A societies"],
    ["What is the total share capital?", "SarvoAI can’t answer this", "You could ask"],
  ])("shows the %s state", async (question, title, extra) => {
    askSarvoAi.mockResolvedValue({ ok: true, sample: true, answer: demoAnswer(question) });
    renderChat(question);
    expect(await screen.findByText(new RegExp(title.replace(/[?“”]/g, ".")))).toBeInTheDocument();
    expect(screen.getByText(extra)).toBeInTheDocument();
  });

  it("labels demonstration answers as sample data", async () => {
    askSarvoAi.mockResolvedValue({ ok: true, sample: true, answer: demoAnswer("Who is the president of Pahala Kosgama SSS?") });
    renderChat("Who is the president of Pahala Kosgama SSS?");
    expect(await screen.findByText("Sample data")).toBeInTheDocument();
  });

  it("keeps the question and offers to try again when SarvoAI is unavailable (D49)", async () => {
    askSarvoAi.mockResolvedValueOnce({ ok: false, status: 503, message: "SarvoAI is not available right now." });
    askSarvoAi.mockResolvedValueOnce({ ok: true, sample: false, answer: answer({ summary: "Back again." }) });
    const user = userEvent.setup();
    renderChat("Average profit in Kurunegala?");
    expect(await screen.findByText("SarvoAI isn’t available right now")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Reports" })).toHaveAttribute("href", "/reports");
    await user.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByText("Back again.")).toBeInTheDocument();
    expect(askSarvoAi).toHaveBeenCalledTimes(2);
  });

  it("says SarvoAI is paused for a spending review and offers no retry", async () => {
    const message = "SarvoAI is paused until its spending settings have been reviewed. Society records are not affected, and you can still find the figures in Reports.";
    askSarvoAi.mockResolvedValue({ ok: false, status: 503, message });
    renderChat("Average profit?");
    expect(await screen.findByText("SarvoAI is paused")).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /try again/i })).not.toBeInTheDocument();
  });

  it("says when the environment has SarvoAI switched off", async () => {
    askSarvoAi.mockResolvedValue({ ok: false, status: 503, message: "SarvoAI is not switched on for this environment" });
    renderChat("Average profit?");
    expect(await screen.findByText(/not switched on for this environment/)).toBeInTheDocument();
  });

  it("explains the monthly spending limit and offers no retry", async () => {
    const message = "SarvoAI has reached its spending limit for this month. It will be available again on 1 December 2026 (5:30 a.m. Sri Lanka time).";
    askSarvoAi.mockResolvedValue({ ok: false, status: 429, message });
    renderChat("Average profit?");
    expect(await screen.findByText("SarvoAI has reached this month’s limit")).toBeInTheDocument();
    expect(screen.getByText(message)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open Reports" })).toHaveAttribute("href", "/reports");
    expect(screen.queryByRole("button", { name: "Try again" })).not.toBeInTheDocument();
    expect(screen.queryByText("SarvoAI isn’t available right now")).not.toBeInTheDocument();
  });

  it("shows nothing when the API refuses the account", async () => {
    askSarvoAi.mockResolvedValue({ ok: false, status: 403, message: "SarvoAI is for HQ only" });
    renderChat("Average profit?");
    expect(await screen.findByText("SarvoAI is for HQ only")).toBeInTheDocument();
  });

  it("stops waiting and lets the user ask again", async () => {
    askSarvoAi.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    renderChat("Average profit?");
    await user.click(await screen.findByRole("button", { name: "Stop" }));
    expect(screen.getByText("Stopped. Nothing from this question is shown.")).toBeInTheDocument();
    expect(screen.getByLabelText("Ask SarvoAI")).toBeEnabled();
  });

  it("starts a new question", async () => {
    askSarvoAi.mockResolvedValue({ ok: true, sample: false, answer: answer({ summary: "Done." }) });
    const user = userEvent.setup();
    renderChat("Average profit?");
    await screen.findByText("Done.");
    await user.click(screen.getByRole("button", { name: /New question/ }));
    await waitFor(() => expect(screen.getByText("Collective Wisdom. Intelligent Impact.")).toBeInTheDocument());
  });
});

describe("V5 D49f SarvoAI no access", () => {
  it("names nothing from the HQ tool", () => {
    render(<RolePageNoAccess name="K. Perera" page="sarvoai" roleLabel="DDM" scope="Kurunegala" />);
    expect(screen.getByRole("heading", { name: "SarvoAI is for HQ only" })).toBeInTheDocument();
    expect(screen.getByText(/This link opens an HQ tool, so nothing from it is shown here/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Go to my home" })).toHaveAttribute("href", "/dashboard");
  });
});

describe("demonstration answers", () => {
  it("never answers about savings, loans or share capital", () => {
    for (const question of ["total share capital", "savings in Kandy", "loans outstanding"]) {
      expect(demoAnswer(question).kind).toBe("UNSUPPORTED");
    }
  });
});
