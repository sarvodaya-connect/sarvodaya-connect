"use client";

import { useRef, useState } from "react";

import { REGISTRAR_DOCUMENT_TYPES } from "@/lib/v5-constants";

import { OTHER_DOCUMENT_LABELS, REGISTRAR_LABELS, formatSize } from "./document-labels";

type Start = (input: {
  documentType: string;
  financialYear?: number;
  title: string;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  checksumSha256: string;
}) => Promise<{ error?: string; documentId?: string; upload?: { url: string; headers: Record<string, string> } }>;

type Complete = (documentId: string) => Promise<{ error?: string }>;

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 10_000_000;

/** SHA-256 of the file in base64, which storage checks on upload. */
async function sha256(file: File) {
  const digest = await crypto.subtle.digest("SHA-256", await file.arrayBuffer());
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  return btoa(binary);
}

const fieldClass =
  "mt-1 w-full rounded-input border border-line bg-surface px-3 py-2 text-[12px] text-ink outline-none focus:border-brand-leaf focus:ring-2 focus:ring-brand-mint-ring";

/**
 * V5 M13a on the desktop: choose the document type, year and file (PDF or
 * photo, up to 10 MB). The file goes straight to storage through a
 * short-lived pre-signed URL; the API then checks and records it.
 */
export function DocumentUpload({
  allowAuditReport = true,
  complete,
  financialYears,
  start,
}: {
  /** The audit report is uploaded by the Society Officer or assigned SPC only. */
  allowAuditReport?: boolean;
  complete: Complete;
  financialYears: { startYear: number; label: string }[];
  start: Start;
}) {
  const registrarTypes = REGISTRAR_DOCUMENT_TYPES.filter((value) => allowAuditReport || value !== "AUDIT_REPORT");
  const [type, setType] = useState<string>(registrarTypes[0]!);
  const [year, setYear] = useState(financialYears[0]?.startYear);
  const [file, setFile] = useState<File>();
  const [title, setTitle] = useState("");
  const [state, setState] = useState<"idle" | "uploading" | "done">("idle");
  const [error, setError] = useState<string>();
  const input = useRef<HTMLInputElement>(null);
  const isYearly = (REGISTRAR_DOCUMENT_TYPES as readonly string[]).includes(type);

  async function upload(event: React.FormEvent) {
    event.preventDefault();
    setError(undefined);
    if (!file) return setError("Choose a PDF or photo to upload.");
    if (!ACCEPTED.includes(file.type)) return setError("Choose a PDF, JPG or PNG file.");
    if (file.size > MAX_BYTES) return setError("The file is larger than 10 MB. Choose a smaller PDF or photo.");
    if (!isYearly && !title.trim()) return setError("Give the document a name, for example Registration certificate.");
    setState("uploading");
    try {
      const started = await start({
        documentType: type,
        ...(isYearly ? { financialYear: year } : {}),
        title: isYearly ? REGISTRAR_LABELS[type as keyof typeof REGISTRAR_LABELS].title : title.trim(),
        fileName: file.name,
        contentType: file.type,
        sizeBytes: file.size,
        checksumSha256: await sha256(file),
      });
      if (started.error || !started.upload || !started.documentId) throw new Error(started.error ?? "The upload could not be started.");
      const response = await fetch(started.upload.url, { method: "PUT", headers: started.upload.headers, body: file });
      if (!response.ok) throw new Error("The file did not reach storage. Check your connection and try again.");
      const done = await complete(started.documentId);
      if (done.error) throw new Error(done.error);
      setState("done");
      setFile(undefined);
      setTitle("");
      if (input.current) input.current.value = "";
    } catch (failure) {
      setState("idle");
      setError(failure instanceof Error ? failure.message : "The upload failed. Try again.");
    }
  }

  const uploading = state === "uploading";
  return (
    <form className="rounded-card border border-line bg-surface p-4" onSubmit={upload}>
      <h3 className="text-[14px] font-bold text-ink">Upload a document</h3>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <label className="text-[12px] font-semibold text-ink">
          Document type <span className="text-danger-text">*</span>
          <select className={fieldClass} disabled={uploading} onChange={(event) => setType(event.target.value)} value={type}>
            {registrarTypes.map((value) => (
              <option key={value} value={value}>{REGISTRAR_LABELS[value].title}</option>
            ))}
            {["REGISTRATION", "ACTIVITY_EVIDENCE", "OTHER"].map((value) => (
              <option key={value} value={value}>{OTHER_DOCUMENT_LABELS[value]}</option>
            ))}
          </select>
        </label>
        {isYearly ? (
          <label className="text-[12px] font-semibold text-ink">
            Financial year <span className="text-danger-text">*</span>
            <select className={fieldClass} disabled={uploading} onChange={(event) => setYear(Number(event.target.value))} value={year}>
              {financialYears.map((option) => (
                <option key={option.startYear} value={option.startYear}>{option.label}</option>
              ))}
            </select>
          </label>
        ) : (
          <label className="text-[12px] font-semibold text-ink">
            Name <span className="text-danger-text">*</span>
            <input className={fieldClass} disabled={uploading} maxLength={150} onChange={(event) => setTitle(event.target.value)} value={title} />
          </label>
        )}
      </div>
      <label className="mt-3 block text-[12px] font-semibold text-ink">
        File <span className="text-danger-text">*</span>
        <input
          accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png"
          className="mt-1 block w-full text-[12px] text-ink-soft file:mr-3 file:rounded-button file:border file:border-line file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-semibold"
          disabled={uploading}
          onChange={(event) => {
            setFile(event.target.files?.[0]);
            setState("idle");
          }}
          ref={input}
          type="file"
        />
        <span className="mt-1 block text-[11px] font-normal text-muted">
          {file ? `${file.name} · ${formatSize(file.size)}` : "PDF or photo, up to 10 MB."}
        </span>
      </label>
      {error && (
        <p className="mt-3 rounded-lg border border-[#efc4bd] bg-danger-bg px-3 py-2 text-[12px] font-semibold text-danger-text" role="alert">
          {error}
        </p>
      )}
      {state === "done" && (
        <p className="mt-3 rounded-lg bg-success-bg px-3 py-2 text-[12px] font-semibold text-success-text" role="status">
          Uploaded. The document is on the society record.
        </p>
      )}
      <div className="mt-3 flex items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-button bg-brand-action px-4 py-2 text-[12px] font-semibold text-white hover:bg-brand-action-pressed disabled:cursor-not-allowed disabled:opacity-60"
          disabled={uploading}
          type="submit"
        >
          {uploading && (
            <span aria-hidden className="size-3.5 animate-spin rounded-full border-2 border-white/40 border-t-white" />
          )}
          {uploading ? "Uploading…" : "Upload"}
        </button>
        {uploading && <span className="sr-only" role="status">Uploading…</span>}
      </div>
    </form>
  );
}
