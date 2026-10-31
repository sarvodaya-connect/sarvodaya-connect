"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import type { GradeChangeRequest, GradeChangeStatus, PaginatedResponse } from "@sarvodaya-connect/api-contracts";
import { EmptyState, ErrorState, NoResultsState, TableSkeleton } from "./data-states";

const formatDate = (value: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(new Date(value));
const formatDateTime = (value: string) => new Intl.DateTimeFormat("en-GB", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));

export function GradeChangeQueue() {
  const [items, setItems] = useState<GradeChangeRequest[]>([]);
  const [status, setStatus] = useState<GradeChangeStatus | "all">("PENDING");
  const [district, setDistrict] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const params = useMemo(() => {
    const search = new URLSearchParams({ page: "1", pageSize: "100" });
    if (status !== "all") search.set("status", status);
    if (district !== "all") search.set("districtId", district);
    if (query.trim()) search.set("search", query.trim());
    return search.toString();
  }, [district, query, status]);
  async function load() {
    setLoading(true); setError(false);
    try {
      const response = await fetch(`/api/grade-changes?${params}`, { cache: "no-store" });
      if (!response.ok) throw new Error("Grade queue unavailable");
      const result = await response.json() as PaginatedResponse<GradeChangeRequest>;
      setItems(result.data);
    } catch { setError(true); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [params]);
  const districts = [...new Map(items.map((item) => [item.district.id, item.district.nameEn])).entries()];
  if (loading) return <TableSkeleton columns={6} label="Loading grade requests" rows={5} />;
  if (error) return <section className="rounded-card border border-line bg-surface"><ErrorState onRetry={() => void load()} title="Grade requests couldn&apos;t be loaded" /></section>;
  return <section className="mt-4 overflow-hidden rounded-card border border-line bg-surface">
    <div className="flex flex-wrap items-center gap-2 border-b border-line-soft p-3">
      <label><span className="sr-only">Search grade requests</span><input className="rounded-button border border-line px-3 py-1.5 text-xs" onChange={(event) => setQuery(event.target.value)} placeholder="Search society or S number" value={query} /></label>
      <label><span className="sr-only">Filter request status</span><select className="rounded-button border border-line bg-surface px-2.5 py-1.5 text-xs" onChange={(event) => setStatus(event.target.value as GradeChangeStatus | "all")} value={status}><option value="PENDING">Waiting for HQ</option><option value="APPROVED">Approved</option><option value="REJECTED">Rejected</option><option value="all">All statuses</option></select></label>
      <label><span className="sr-only">Filter district</span><select className="rounded-button border border-line bg-surface px-2.5 py-1.5 text-xs" onChange={(event) => setDistrict(event.target.value)} value={district}><option value="all">All districts</option>{districts.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    {items.length ? <div className="overflow-x-auto"><table className="w-full min-w-[700px] text-left text-sm"><thead className="bg-surface-muted text-ink-soft"><tr>{["Society", "District", "Change", "Requested by", "Sent", "Status"].map((head) => <th className="px-4 py-3 font-medium" key={head}>{head}</th>)}</tr></thead><tbody className="divide-y divide-line-soft">{items.map((item) => <tr key={item.id}><td className="px-4 py-3"><Link className="text-[#2d5c88] underline" href={`/grade-changes/${item.id}`}>{item.societyName}<span className="block text-xs text-muted">{item.societyCode}</span></Link></td><td className="px-4 py-3">{item.district.nameEn}</td><td className="px-4 py-3">{item.currentGrade} → {item.proposedGrade}</td><td className="px-4 py-3">{item.requestedBy.name}</td><td className="px-4 py-3">{formatDate(item.requestedAt)}</td><td className="px-4 py-3"><span>{item.status === "PENDING" ? "Waiting" : item.status === "APPROVED" ? `Approved${item.decidedBy ? ` by ${item.decidedBy.name}` : ""}` : `Rejected${item.decidedBy ? ` by ${item.decidedBy.name}` : ""}`}</span><Link className="ml-2 text-[#2d5c88] underline" href={`/grade-changes/${item.id}`}>{item.status === "PENDING" ? "Review" : "View"}</Link></td></tr>)}</tbody></table></div> : <NoResultsState filters={[]} itemLabel="requests" onClearAll={() => { setQuery(""); setDistrict("all"); setStatus("all"); }} onRemoveFilter={() => undefined} />}
    <p className="border-t border-line-soft px-4 py-3 text-xs text-muted" role="status">Showing {items.length} grade requests in the national queue</p>
  </section>;
}

export function GradeChangeReview({ id }: { id: string }) {
  const [request, setRequest] = useState<GradeChangeRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [decision, setDecision] = useState<"APPROVED" | "REJECTED">("APPROVED");
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  async function load() {
    setLoading(true); setError("");
    try {
      const response = await fetch(`/api/grade-changes/${id}`, { cache: "no-store" });
      if (response.status === 403) { setError("permission"); return; }
      if (response.status === 404) { setError("missing"); return; }
      if (!response.ok) throw new Error("Request unavailable");
      setRequest(await response.json() as GradeChangeRequest);
    } catch { setError("load"); } finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, [id]);
  async function submitDecision() {
    if (!comment.trim() || !request || saving) return;
    setSaving(true); setMessage(""); setError("");
    try {
      const response = await fetch(`/api/grade-changes/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision, comment: comment.trim() }) });
      const payload = await response.json() as GradeChangeRequest | { error?: { message?: string } };
      if (response.status === 409) { setError("conflict"); return; }
      if (!response.ok) throw new Error((payload as { error?: { message?: string } }).error?.message ?? "Decision could not be saved");
      const updated = payload as GradeChangeRequest;
      setRequest(updated);
      setMessage(decision === "APPROVED" ? `Approved: grade changed to ${updated.proposedGrade}.` : `Request rejected: grade remains ${updated.currentGrade}.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Decision could not be saved"); }
    finally { setSaving(false); }
  }
  if (loading) return <div className="mt-5"><TableSkeleton columns={2} label="Loading grade request" rows={5} /></div>;
  if (error === "permission") return <section className="mt-5 rounded-card border border-line bg-surface p-6"><h2 className="font-semibold">Permission denied</h2><p className="mt-2 text-sm text-muted">Only HQ can access and review grade-change requests.</p></section>;
  if (error === "missing") return <section className="mt-5 rounded-card border border-line bg-surface p-6"><h2 className="font-semibold">Request not found</h2><p className="mt-2 text-sm text-muted">This grade-change request is no longer available.</p></section>;
  if (!request) return <section className="rounded-card border border-line bg-surface"><ErrorState onRetry={() => void load()} title="Request couldn&apos;t be loaded" /></section>;
  const pending = request.status === "PENDING";
  return <article className="mt-5">
    <Link className="text-sm text-[#2d5c88] underline" href="/grade-changes">Grade requests</Link><span className="mx-2 text-muted">›</span><span className="text-sm">{request.societyName}</span>
    <h2 className="mt-3 text-xl font-bold">Grade change {request.currentGrade} → {request.proposedGrade} · {request.societyName}</h2>
    <p className="mt-1 text-sm text-muted">{request.societyCode} · {request.district.nameEn} · sent by {request.requestedBy.name} on {formatDateTime(request.requestedAt)} · {pending ? "Waiting for HQ" : request.status.toLowerCase()}</p>
    <div className="mt-5 grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
      <div className="space-y-4">
        <section className="rounded-card border border-line bg-surface p-5"><h3 className="font-semibold">Request</h3><p className="mt-3 text-2xl font-bold">{request.currentGrade} → {request.proposedGrade}</p><p className="mt-1 text-xs text-muted">{request.currentGrade === "A" ? "Strong" : request.currentGrade === "B" ? "Developing" : "Needs strengthening"} to {request.proposedGrade === "A" ? "Strong" : request.proposedGrade === "B" ? "Developing" : "Needs strengthening"}</p><h4 className="mt-5 text-sm font-semibold">Reason given</h4><blockquote className="mt-2 rounded-lg bg-surface-muted p-4 text-sm leading-6 text-ink-soft">“{request.rationale}”</blockquote></section>
        <section className="rounded-card border border-line bg-surface p-5"><h3 className="font-semibold">Society at a glance</h3><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-xs text-muted">Members</dt><dd className="mt-1 font-semibold">{request.societySummary.memberCount?.toLocaleString("en-GB") ?? "Not recorded"}</dd></div><div><dt className="text-xs text-muted">Exco members</dt><dd className="mt-1 font-semibold">{request.societySummary.excoCount} / 25</dd></div><div><dt className="text-xs text-muted">Annual plan</dt><dd className="mt-1 font-semibold">Not tracked</dd></div><div><dt className="text-xs text-muted">Last update</dt><dd className="mt-1 font-semibold">See society record</dd></div></dl><Link className="mt-4 inline-block text-sm text-[#2d5c88] underline" href={`/societies/${request.societyId}`}>Open society record · Exco · Work plan · Documents</Link></section>
        <section className="rounded-card border border-line bg-surface p-5"><h3 className="font-semibold">Grade history</h3>{request.history.length ? <ol className="mt-4 space-y-4">{request.history.map((entry) => <li className="flex gap-3 text-sm" key={entry.id}><span aria-hidden="true" className="mt-1 size-2.5 shrink-0 rounded-full bg-brand-forest"/><span>{entry.summary} · {entry.actorName} · {formatDateTime(entry.occurredAt)}{entry.comment ? ` · “${entry.comment}”` : ""}</span></li>)}</ol> : <p className="mt-3 text-sm text-muted">No earlier grade history is recorded.</p>}</section>
      </div>
      <section className="rounded-card border border-line bg-surface p-5"><h3 className="font-semibold">Your decision</h3>{pending ? <>
        <label className={`mt-4 flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${decision === "APPROVED" ? "border-brand-forest bg-brand-mint-soft" : "border-line"}`}><input checked={decision === "APPROVED"} name="grade-decision" onChange={() => setDecision("APPROVED")} type="radio"/><span><strong className="block text-sm">Approve · change grade to {request.proposedGrade}</strong><span className="text-xs text-muted">The grade changes straight away.</span></span></label>
+        <label className={`mt-2 flex cursor-pointer items-start gap-3 rounded-lg border p-3 ${decision === "REJECTED" ? "border-brand-forest bg-brand-mint-soft" : "border-line"}`}><input checked={decision === "REJECTED"} name="grade-decision" onChange={() => setDecision("REJECTED")} type="radio"/><span><strong className="block text-sm">Reject · keep grade {request.currentGrade}</strong><span className="text-xs text-muted">A decision comment is required.</span></span></label>
        <label className="mt-4 block text-sm font-medium" htmlFor="grade-decision-comment">Comment to the requester</label><textarea className="mt-2 min-h-28 w-full rounded-lg border border-line p-3 text-sm outline-none focus:border-brand-leaf" id="grade-decision-comment" maxLength={2000} onChange={(event) => setComment(event.target.value)} placeholder="Explain your decision" value={comment}/><p className="mt-2 text-xs text-muted">Your name, decision and time are added to the grade history and change log.</p>
        {error && <p className="mt-3 rounded-lg bg-danger-bg p-3 text-sm text-danger-text" role="alert">{error === "conflict" ? "This request changed while you were reviewing it. Reload to see the latest decision." : error}</p>}
        <div className="mt-4 flex flex-wrap gap-2"><Link className="rounded-button border border-line px-4 py-2 text-sm font-semibold" href="/grade-changes">Back to queue</Link><button className="rounded-button bg-brand-forest px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50" disabled={!comment.trim() || saving} onClick={() => void submitDecision()} type="button">{saving ? "Saving…" : decision === "APPROVED" ? `Approve grade ${request.proposedGrade}` : `Reject · keep grade ${request.currentGrade}`}</button></div>
      </> : <div className="mt-4 rounded-lg bg-surface-muted p-4 text-sm text-ink-soft"><p>This request has already been {request.status.toLowerCase()}. {request.decidedBy && `Decision by ${request.decidedBy.name}.`}{request.decisionComment && ` Comment: “${request.decisionComment}”`}</p></div>}
      {message && <p className="mt-4 rounded-lg bg-brand-mint-soft p-3 text-sm font-medium text-brand-forest" role="status">{message}</p>}
    </section></div>
  </article>;
}
