"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import type { AssistantAnswer, AssistantTurn } from "@sarvodaya-connect/api-contracts";

import { askSarvoAi, type SarvoAiResult } from "@/app/(dashboard)/sarvoai/actions";
import { primaryButtonClass, secondaryButtonClass } from "@/components/dashboard/data-states";
import { Icon } from "@/components/dashboard/icon";
import { Pill } from "@/components/dashboard/ui/pill";

import { SARVOAI_EXAMPLES, SARVOAI_NEVER, SARVOAI_USES } from "./examples";

type Turn = { id: number; question: string; result?: SarvoAiResult; stopped?: boolean };
type Recent = { question: string; at: string };

const RECENT_LIMIT = 5;
const recentKey = (viewerId: string) => `sarvoai.recent.${viewerId}`;

function readRecent(viewerId: string): Recent[] {
  try {
    const stored = JSON.parse(window.localStorage.getItem(recentKey(viewerId)) ?? "[]");
    return Array.isArray(stored) ? stored.slice(0, RECENT_LIMIT) : [];
  } catch {
    return [];
  }
}

function saveRecent(viewerId: string, question: string): Recent[] {
  const next = [{ question, at: new Date().toISOString() }, ...readRecent(viewerId).filter((item) => item.question !== question)].slice(0, RECENT_LIMIT);
  try {
    window.localStorage.setItem(recentKey(viewerId), JSON.stringify(next));
  } catch {
    // Private windows may refuse storage; the list is only a convenience.
  }
  return next;
}

function when(value: string) {
  const date = new Date(value);
  const today = new Date();
  const days = Math.floor((today.setHours(0, 0, 0, 0) - new Date(value).setHours(0, 0, 0, 0)) / 86_400_000);
  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

const format = (value: string | number | null) =>
  value === null ? "—" : typeof value === "number" ? value.toLocaleString("en-GB") : value;

/** The badges under an answer: year, district, currency, included and left out. */
function ScopeChips({ answer }: { answer: AssistantAnswer }) {
  const scope = answer.scope;
  if (!scope) return null;
  const chip = "rounded-full px-2.5 py-0.5 text-[11px] font-semibold";
  return (
    <ul aria-label="What this answer covers" className="mt-2 flex flex-wrap gap-1.5">
      {scope.financialYears.length > 0 && (
        <li className={`${chip} bg-[#e5eef8] text-[#315d88]`}>
          {scope.financialYears.length > 2 ? `${scope.financialYears[0]} – ${scope.financialYears.at(-1)}` : scope.financialYears.join(", ")}
        </li>
      )}
      <li className={`${chip} bg-[#e6f0e7] text-[#26744b]`}>{scope.district ? `${scope.district} District` : "All districts"}</li>
      {scope.currency && <li className={`${chip} bg-[#f0f1ee] text-ink-soft`}>{scope.currency}</li>}
      {scope.societiesIncluded !== undefined && (
        <li className={`${chip} bg-[#e6f0e7] text-[#26744b]`}>{scope.societiesIncluded.toLocaleString("en-GB")} societies included</li>
      )}
      {scope.societiesExcluded ? (
        <li className={`${chip} bg-[#fff5d9] text-[#7a5a00]`}>
          {scope.societiesExcluded.toLocaleString("en-GB")} excluded{scope.excludedReason ? ` · ${scope.excludedReason}` : ""}
        </li>
      ) : null}
    </ul>
  );
}

/** V5 D44 / M84: "How was this answered?" — what was read, what was left out and how it was worked out. */
function HowAnswered({ answer, onClose, question, sample }: { answer: AssistantAnswer; onClose: () => void; question: string; sample: boolean }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  const scope = answer.scope;
  const rows: [string, string][] = [
    ...(scope?.financialYears.length ? [["Year", scope.financialYears.join(", ")] as [string, string]] : []),
    ["District", scope?.district ?? (scope ? "All districts" : "—")],
    ...(scope?.currency ? [["Currency", "Sri Lankan rupees (LKR), as entered by societies"] as [string, string]] : []),
    ["Records used", answer.details.recordsUsed.length ? answer.details.recordsUsed.join("; ") : "No society records were needed"],
    ...(scope?.societiesIncluded !== undefined ? [["Included", `${scope.societiesIncluded.toLocaleString("en-GB")} societies`] as [string, string]] : []),
    ...(scope?.societiesExcluded
      ? [["Excluded", `${scope.societiesExcluded.toLocaleString("en-GB")} societies${scope.excludedReason ? ` (${scope.excludedReason})` : ""}. They are left out, not counted as zero.`] as [string, string]]
      : []),
    ["Data as of", new Date(answer.dataAsOf).toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Colombo" })],
  ];
  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-black/30" onClick={onClose} role="presentation">
      <section
        aria-labelledby="how-answered-title"
        aria-modal="true"
        className="h-full w-full max-w-[420px] overflow-y-auto bg-surface p-5 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-[17px] font-bold text-ink" id="how-answered-title">How was this answered?</h2>
            <p className="mt-0.5 text-[12px] text-muted">{question}</p>
            <p className="mt-2 flex gap-1.5">
              {sample && <Pill tone="preview">Sample data</Pill>}
              <Pill tone="inactive">HQ only</Pill>
            </p>
          </div>
          <button aria-label="Close" className="rounded p-1 text-ink-soft hover:bg-[#f0f1ee]" onClick={onClose} ref={closeRef} type="button">
            <Icon className="size-5" name="close" />
          </button>
        </div>
        <dl className="mt-4 divide-y divide-line-soft border-y border-line-soft text-[12px]">
          {rows.map(([label, value]) => (
            <div className="grid grid-cols-[130px_1fr] gap-3 py-2.5" key={label}>
              <dt className="text-muted">{label}</dt>
              <dd className="text-ink">{value}</dd>
            </div>
          ))}
        </dl>
        {answer.details.calculation && (
          <div className="mt-4 rounded-lg bg-[#eef6ef] p-3 text-[12px] text-ink">
            <p className="font-bold">Calculation</p>
            <p className="mt-1">{answer.details.calculation}</p>
          </div>
        )}
        <p className="mt-4 flex gap-2 rounded-lg border border-line bg-[#f4f5f1] p-3 text-[11px] text-ink-soft">
          <Icon className="mt-0.5 size-3.5 shrink-0" name="help" />
          Only yearly totals are used. No share capital, savings, loans, assets or cash figures are used — they are not recorded in Sarvodaya Connect.
        </p>
      </section>
    </div>
  );
}

function AnswerCard({
  answer,
  onAsk,
  onDetails,
  onRefine,
  sample,
}: {
  answer: AssistantAnswer;
  onAsk: (text: string) => void;
  onDetails: () => void;
  onRefine: () => void;
  sample: boolean;
}) {
  const [choice, setChoice] = useState(0);
  const [copied, setCopied] = useState(false);
  const optionChips = (label?: string) =>
    answer.options.length > 0 && (
      <div className="mt-3">
        {label && <p className="mb-1.5 text-[12px] font-semibold text-ink">{label}</p>}
        <div className="flex flex-wrap gap-1.5">
          {answer.options.map((option) => (
            <button className="rounded-full border border-line bg-surface px-3 py-1 text-[12px] text-ink hover:border-brand-forest" key={option} onClick={() => onAsk(option)} type="button">
              {option}
            </button>
          ))}
        </div>
      </div>
    );

  if (answer.kind === "CLARIFY") {
    // V5 D46 "Which do you mean?" (choices to pick) and D48 unclear question (chips).
    const isChoice = answer.options.length >= 2 && answer.options.length <= 4 && /which do you mean/i.test(answer.summary);
    return (
      <div className="rounded-card border border-line bg-surface p-4">
        <p className="flex items-start gap-2 text-[13px] text-ink">
          <Icon className="mt-0.5 size-4 shrink-0 text-[#315d88]" name="help" />
          <span>{answer.summary}</span>
        </p>
        {isChoice ? (
          <>
            <fieldset className="mt-3 space-y-2">
              <legend className="sr-only">Which do you mean?</legend>
              {answer.options.map((option, index) => (
                <label
                  className={`flex cursor-pointer items-center gap-3 rounded-lg border px-3 py-2.5 text-[12px] font-semibold text-ink ${index === choice ? "border-brand-forest bg-[#eef6ef]" : "border-line"}`}
                  key={option}
                >
                  <input checked={index === choice} className="accent-[var(--brand-forest)]" name="clarify" onChange={() => setChoice(index)} type="radio" />
                  {option}
                </label>
              ))}
            </fieldset>
            <div className="mt-3 flex flex-wrap gap-2">
              <button className={primaryButtonClass} onClick={() => onAsk(answer.options[choice]!)} type="button">
                <Icon className="size-4" name="check" />
                Answer with this
              </button>
              <button className={secondaryButtonClass} onClick={onRefine} type="button">Rewrite my question</button>
            </div>
          </>
        ) : (
          optionChips()
        )}
      </div>
    );
  }

  const tone =
    answer.kind === "INCOMPLETE"
      ? { box: "border-[#ecd9a0] bg-[#fffaf0]", icon: "alert" as const, iconTone: "text-[#8a6100]", title: undefined }
      : answer.kind === "NO_MATCH"
        ? { box: "border-line bg-surface", icon: "search" as const, iconTone: "text-brand-forest", title: "No societies match" }
        : answer.kind === "UNSUPPORTED"
          ? { box: "border-line bg-surface", icon: "help" as const, iconTone: "text-ink-soft", title: "SarvoAI can’t answer this" }
          : null;

  if (tone) {
    return (
      <div className={`rounded-card border p-4 ${tone.box}`}>
        <div className="flex items-start gap-3">
          <span className={`mt-0.5 grid size-8 shrink-0 place-items-center rounded-full bg-[#f0f1ee] ${tone.iconTone}`}>
            <Icon className="size-4" name={tone.icon} />
          </span>
          <div className="min-w-0">
            {tone.title && <p className="text-[14px] font-bold text-ink">{tone.title}</p>}
            <p className={`text-[13px] ${answer.kind === "INCOMPLETE" ? "font-semibold" : ""} text-ink`}>{answer.summary}</p>
            <ScopeChips answer={answer} />
            {sample && <p className="mt-2"><Pill tone="preview">Sample data</Pill></p>}
            {optionChips(answer.kind === "NO_MATCH" ? "Try instead" : answer.kind === "UNSUPPORTED" ? "You could ask" : undefined)}
            {answer.kind !== "UNSUPPORTED" && answer.details.recordsUsed.length > 0 && (
              <button className="mt-3 flex items-center gap-1 text-[12px] font-semibold text-brand-forest" onClick={onDetails} type="button">
                <Icon className="size-3.5" name="help" />
                How was this answered?
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  const table = answer.table;
  return (
    <div className="rounded-card border border-line bg-surface p-4">
      <p className="text-[14px] text-ink">{answer.summary}</p>
      <ScopeChips answer={answer} />
      {answer.scope?.societiesIncluded !== undefined && (
        <ul className="mt-3 grid auto-rows-fr gap-2 sm:grid-cols-2">
          <li className="flex h-full flex-col rounded-tile border border-[#cfe3d3] bg-[#eef6ef] px-3 py-2">
            <span className="text-[11px] text-brand-forest">Included</span>
            <strong className="text-[20px] text-ink">{answer.scope.societiesIncluded.toLocaleString("en-GB")} societies</strong>
            <span className="text-[10px] text-muted">{answer.scope.financialYears.join(", ")}</span>
          </li>
          <li className={`flex h-full flex-col rounded-tile border px-3 py-2 ${answer.scope.societiesExcluded ? "border-[#ecd9a0] bg-[#fffaf0]" : "border-line bg-surface"}`}>
            <span className="text-[11px] text-[#8a6100]">Not included</span>
            <strong className="text-[20px] text-ink">{(answer.scope.societiesExcluded ?? 0).toLocaleString("en-GB")} societies</strong>
            <span className="text-[10px] text-muted">{answer.scope.excludedReason ?? "None left out"}</span>
          </li>
        </ul>
      )}
      {table && table.rows.length > 0 && (
        <div className="mt-3 overflow-x-auto rounded-lg border border-line-soft">
          <table className="w-full text-left text-[12px]">
            <caption className="sr-only">Records behind this answer</caption>
            <thead className="bg-[#f2f4f0] text-[11px] text-muted">
              <tr>{table.columns.map((column) => <th className="px-3 py-2 font-medium" key={column} scope="col">{column}</th>)}</tr>
            </thead>
            <tbody className="divide-y divide-line-soft">
              {table.rows.map((row, index) => (
                <tr key={index}>
                  {row.map((cell, cellIndex) => (
                    <td className={`px-3 py-2 ${cellIndex === 0 ? "font-semibold text-ink" : "text-ink-soft"} ${typeof cell === "number" && cell < 0 ? "text-[#a8312a]" : ""}`} key={cellIndex}>
                      {format(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line-soft px-3 py-2 text-[11px] text-muted">
            Showing {table.rows.length} of {table.totalRows.toLocaleString("en-GB")} · a loss is shown with a minus sign
          </p>
        </div>
      )}
      <div className="mt-3 flex flex-wrap items-center gap-4 text-[12px]">
        <button className="flex items-center gap-1 font-semibold text-brand-forest" onClick={onDetails} type="button">
          <Icon className="size-3.5" name="help" />
          How was this answered?
        </button>
        <button className="text-ink-soft hover:text-ink" onClick={onRefine} type="button">Refine question</button>
        <button
          className="text-ink-soft hover:text-ink"
          onClick={() => {
            void navigator.clipboard?.writeText(answer.summary).then(() => setCopied(true));
          }}
          type="button"
        >
          {copied ? "Copied" : "Copy answer"}
        </button>
        {sample && <span className="ml-auto"><Pill tone="preview">Sample data</Pill></span>}
      </div>
    </div>
  );
}

function Failure({ onRetry, result }: { onRetry: () => void; result: Extract<SarvoAiResult, { ok: false }> }) {
  if (result.status === 403) {
    return (
      <div className="rounded-card border border-line bg-surface p-4" role="alert">
        <p className="text-[14px] font-bold text-ink">SarvoAI is for HQ only</p>
        <p className="text-[12px] text-ink-soft">Your account cannot use SarvoAI, so nothing was looked up.</p>
      </div>
    );
  }
  if (result.status === 429) {
    // The API's own wording, with the date SarvoAI is available again (issue #96).
    return (
      <div className="rounded-card border border-[#ecd9a0] bg-[#fffaf0] p-4" role="alert">
        <p className="text-[14px] font-bold text-ink">SarvoAI has reached this month’s limit</p>
        <p className="text-[12px] text-ink-soft">{result.message}</p>
        <div className="mt-3">
          <Link className={secondaryButtonClass} href="/reports">Open Reports</Link>
        </div>
      </div>
    );
  }
  if (result.status === 400) {
    return (
      <div className="rounded-card border border-line bg-surface p-4" role="alert">
        <p className="text-[13px] text-ink">{result.message}</p>
      </div>
    );
  }
  return (
    <div className="rounded-card border border-[#f0cfcb] bg-surface p-4" role="alert">
      <div className="flex items-start gap-3">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-danger-bg text-danger-text">
          <Icon className="size-4" name="error" />
        </span>
        <div>
          <p className="text-[14px] font-bold text-ink">SarvoAI isn’t available right now</p>
          <p className="text-[12px] text-ink-soft">
            {result.status === 503 && /switched on/i.test(result.message)
              ? "SarvoAI is not switched on for this environment. Society records are not affected, and you can still find the figures in Reports."
              : "Your question has been kept. Try again in a minute. Society records are not affected, and you can still find the figures in Reports."}
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button className={primaryButtonClass} onClick={onRetry} type="button">
              <Icon className="size-4" name="refresh" />
              Try again
            </button>
            <Link className={secondaryButtonClass} href="/reports">Open Reports</Link>
          </div>
        </div>
      </div>
    </div>
  );
}

function Mark() {
  return (
    <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-full bg-brand-forest text-[#f3c44e]">
      <Icon className="size-4" name="sparkle" />
    </span>
  );
}

/** V5 D40–D49f: SarvoAI for HQ. Every question goes to the API, which allows HQ only. */
export function SarvoAiChat({ demo, initialQuestion, viewerId, viewerInitials }: { demo: boolean; initialQuestion?: string; viewerId: string; viewerInitials: string }) {
  const [turns, setTurns] = useState<Turn[]>([]);
  const [input, setInput] = useState("");
  const [recent, setRecent] = useState<Recent[]>([]);
  const [details, setDetails] = useState<{ answer: AssistantAnswer; question: string; sample: boolean } | null>(null);
  const [, startTransition] = useTransition();
  const nextId = useRef(1);
  const inputRef = useRef<HTMLInputElement>(null);
  const started = useRef(false);

  useEffect(() => setRecent(readRecent(viewerId)), [viewerId]);

  // The last question is still waiting for its answer (and was not stopped).
  const working = Boolean(turns.at(-1) && !turns.at(-1)!.result && !turns.at(-1)!.stopped);

  const history = (upTo: Turn[]): AssistantTurn[] =>
    upTo.flatMap((turn) =>
      turn.result?.ok ? [{ role: "user" as const, text: turn.question }, { role: "assistant" as const, text: turn.result.answer.summary }] : [],
    );

  function ask(text: string, base = turns) {
    const question = text.trim();
    if (question.length < 3 || working) return;
    const id = nextId.current++;
    const earlier = history(base);
    setTurns([...base, { id, question }]);
    setInput("");
    setRecent(saveRecent(viewerId, question));
    startTransition(async () => {
      const result = await askSarvoAi(question, earlier);
      setTurns((current) => current.map((turn) => (turn.id === id && !turn.stopped ? { ...turn, result } : turn)));
    });
  }

  useEffect(() => {
    if (initialQuestion && !started.current) {
      started.current = true;
      ask(initialQuestion, []);
    }
    // Run once for a question passed from the D02 bar.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuestion]);

  const edit = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const askBox = (placeholder: string, big = false) => (
    <form
      className={`flex items-center gap-2 rounded-card border bg-surface ${big ? "px-4 py-2.5" : "px-3 py-2"} ${input ? "border-brand-forest" : "border-line"}`}
      onSubmit={(event) => {
        event.preventDefault();
        ask(input);
      }}
    >
      <Icon className="size-4 shrink-0 text-[#c58a00]" name="sparkle" />
      <label className="sr-only" htmlFor="sarvoai-question">Ask SarvoAI</label>
      <input
        className="min-w-0 flex-1 bg-transparent text-[13px] text-ink outline-none placeholder:text-muted"
        disabled={Boolean(working)}
        id="sarvoai-question"
        maxLength={500}
        onChange={(event) => setInput(event.target.value)}
        placeholder={working ? "Waiting for the answer…" : placeholder}
        ref={inputRef}
        value={input}
      />
      {working ? (
        <button
          className={secondaryButtonClass}
          onClick={() => setTurns((current) => current.map((turn, index) => (index === current.length - 1 ? { ...turn, stopped: true } : turn)))}
          type="button"
        >
          <span aria-hidden className="size-2.5 rounded-sm border-2 border-current" />
          Stop
        </button>
      ) : (
        <button className={primaryButtonClass} disabled={input.trim().length < 3} type="submit">
          <Icon className="size-4" name="mail" />
          Ask
        </button>
      )}
    </form>
  );

  const side = (
    <aside className="flex flex-col gap-4">
      <section aria-labelledby="try-asking" className="rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest" id="try-asking">Try asking</p>
        <ul className="mt-2 divide-y divide-line-soft">
          {SARVOAI_EXAMPLES.map((example) => (
            <li key={example.question}>
              <button className="flex w-full items-start gap-3 py-2.5 text-left text-[12px] text-ink hover:text-brand-forest" disabled={Boolean(working)} onClick={() => ask(example.question)} type="button">
                <span aria-hidden className={`grid size-7 shrink-0 place-items-center rounded-md ${example.tone}`}><Icon className="size-3.5" name={example.icon} /></span>
                {example.question}
              </button>
            </li>
          ))}
        </ul>
      </section>
      <section aria-labelledby="sarvoai-uses" className="rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest" id="sarvoai-uses">What SarvoAI uses</p>
        <ul className="mt-2 space-y-1.5 text-[12px] text-ink">
          {SARVOAI_USES.map((item) => (
            <li className="flex items-center gap-2" key={item}><Icon className="size-3.5 text-brand-forest" name="success" />{item}</li>
          ))}
        </ul>
        <p className="mt-3 rounded-lg bg-[#f2f4f0] p-2.5 text-[11px] text-ink-soft"><strong className="block text-ink">Never used or shown</strong>{SARVOAI_NEVER}</p>
      </section>
      <section aria-labelledby="recent-questions" className="rounded-card border border-line bg-surface p-4">
        <p className="text-[10px] font-bold uppercase tracking-[0.08em] text-brand-forest" id="recent-questions">Your recent questions</p>
        {recent.length === 0 ? (
          <p className="mt-2 text-[12px] text-muted">Questions you ask on this computer appear here.</p>
        ) : (
          <ul className="mt-2 divide-y divide-line-soft">
            {recent.map((item) => (
              <li key={item.question}>
                <button className="flex w-full items-start justify-between gap-3 py-2.5 text-left text-[12px] text-ink hover:text-brand-forest" disabled={Boolean(working)} onClick={() => ask(item.question)} type="button">
                  <span className="line-clamp-2">{item.question}</span>
                  <span className="shrink-0 text-[11px] text-muted">{when(item.at)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </aside>
  );

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      {turns.length === 0 ? (
        <div className="flex flex-col gap-4">
          <section className="relative overflow-hidden rounded-card bg-brand-forest p-6 text-white">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Icon className="mt-1 size-6 text-[#f3c44e]" name="sparkle" />
                <div>
                  <h1 className="text-[26px] font-light">Sarvo <span className="text-[#f0a040]">AI</span></h1>
                  <p className="text-[13px] font-semibold">Collective Wisdom. Intelligent Impact.</p>
                  <p className="text-[12px] text-white/80">Ask in plain words about societies, districts, Exco members, or yearly total profit and expenses.</p>
                </div>
              </div>
              <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-semibold"><Icon className="size-3" name="lock" />HQ only</span>
            </div>
            <div className="mt-4 text-ink">{askBox("e.g. Which societies in Kandy have not submitted their FY 2025/26 figures?", true)}</div>
            <p className="mt-2 text-[11px] text-white/80">SarvoAI answers only from Sarvodaya Connect records your HQ account can open. If a record is missing it says so — it does not guess.</p>
          </section>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[14px] font-bold text-ink">Example questions</h2>
            {demo && <span className="text-[11px] text-muted">Answers in demonstration mode use sample data</span>}
          </div>
          <ul className="grid auto-rows-fr gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {SARVOAI_EXAMPLES.map((example) => (
              <li key={example.question}>
                <button className="flex h-full w-full flex-col items-start rounded-card border border-line bg-surface p-4 text-left hover:border-brand-forest" onClick={() => ask(example.question)} type="button">
                  <span aria-hidden className={`grid size-8 place-items-center rounded-md ${example.tone}`}><Icon className="size-4" name={example.icon} /></span>
                  <strong className="mt-3 text-[13px] text-ink">{example.title}</strong>
                  <span className="mt-1 text-[11px] text-muted">“{example.question}”</span>
                </button>
              </li>
            ))}
          </ul>
          <p className="flex gap-2 rounded-card border border-line bg-surface p-3 text-[12px] text-ink-soft">
            <Icon className="mt-0.5 size-4 shrink-0" name="help" />
            <span>
              <strong className="block text-ink">What it can and cannot answer</strong>
              SarvoAI can only use the yearly <strong>total profit</strong> and <strong>total expenses</strong> each society records. It cannot answer about share capital, savings, loans, assets or cash, and it never shows member NICs or passwords. It only uses records your HQ account can already open.
            </span>
          </p>
        </div>
      ) : (
        <section aria-label="SarvoAI conversation" className="flex min-h-[560px] flex-col rounded-card border border-line bg-surface">
          <header className="flex items-center justify-between border-b border-line-soft px-4 py-3">
            <p className="flex items-center gap-2 text-[14px] font-bold text-ink">
              <Mark />
              Sarvo<span className="-ml-2 text-[#f0a040]">AI</span>
              <Pill tone="inactive">HQ only</Pill>
            </p>
            <button className={secondaryButtonClass} disabled={Boolean(working)} onClick={() => setTurns([])} type="button">
              <span aria-hidden className="text-[15px] leading-none">+</span>
              New question
            </button>
          </header>
          <ol aria-live="polite" className="flex-1 space-y-5 overflow-y-auto px-4 py-4">
            {turns.map((turn, index) => (
              <li className="space-y-3" key={turn.id}>
                <div className="flex flex-col items-end gap-1">
                  <div className="flex items-start gap-2">
                    <p className="max-w-[560px] rounded-card bg-brand-forest px-4 py-2.5 text-[13px] text-white">{turn.question}</p>
                    <span aria-hidden className="grid size-7 place-items-center rounded-full bg-[#eef0eb] text-[10px] font-bold text-ink-soft">{viewerInitials}</span>
                  </div>
                  <button className="mr-9 text-[11px] text-muted hover:text-ink" onClick={() => edit(turn.question)} type="button">Edit question</button>
                </div>
                <div className="flex items-start gap-3">
                  <Mark />
                  <div className="min-w-0 flex-1">
                    {turn.stopped ? (
                      <p className="rounded-card border border-line px-4 py-3 text-[12px] text-muted">Stopped. Nothing from this question is shown.</p>
                    ) : !turn.result ? (
                      <div className="rounded-card border border-line px-4 py-3" role="status">
                        <p className="flex items-center gap-2 text-[12px] font-semibold text-brand-forest">
                          <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-brand-forest border-t-transparent" />
                          Working on it…
                        </p>
                        <p className="mt-1 text-[12px] text-ink-soft">Understanding the question and reading the society records your HQ account can open.</p>
                      </div>
                    ) : turn.result.ok ? (
                      <AnswerCard
                        answer={turn.result.answer}
                        onAsk={(text) => ask(text, turns.slice(0, index + 1))}
                        onDetails={() => turn.result?.ok && setDetails({ answer: turn.result.answer, question: turn.question, sample: turn.result.sample })}
                        onRefine={() => edit(turn.question)}
                        sample={turn.result.sample}
                      />
                    ) : (
                      <Failure onRetry={() => ask(turn.question, turns.slice(0, index))} result={turn.result} />
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ol>
          <div className="border-t border-line-soft p-4">
            {askBox("Ask a follow-up, or ask something new…")}
            <p className="mt-2 text-[11px] text-muted">SarvoAI answers only from Sarvodaya Connect records your HQ account can open. If a record is missing it says so — it does not guess.</p>
          </div>
        </section>
      )}
      {side}
      {details && <HowAnswered answer={details.answer} onClose={() => setDetails(null)} question={details.question} sample={details.sample} />}
    </div>
  );
}
