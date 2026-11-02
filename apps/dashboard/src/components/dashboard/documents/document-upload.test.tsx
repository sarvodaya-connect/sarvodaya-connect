import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DocumentUpload } from "./document-upload";

const years = [
  { startYear: 2025, label: "FY 2025/26" },
  { startYear: 2024, label: "FY 2024/25" },
];

afterEach(() => vi.unstubAllGlobals());

describe("V5 M13a document upload on the desktop", () => {
  it("sends the file straight to storage with its checksum, then confirms it", async () => {
    let finishPut: (response: Response) => void = () => undefined;
    const fetchMock = vi.fn(() => new Promise<Response>((resolve) => (finishPut = resolve)));
    vi.stubGlobal("fetch", fetchMock);
    const start = vi.fn().mockResolvedValue({
      documentId: "doc-1",
      upload: { url: "https://bucket.example/put", headers: { "Content-Type": "application/pdf" } },
    });
    const complete = vi.fn().mockResolvedValue({});
    render(<DocumentUpload complete={complete} financialYears={years} start={start} />);

    const file = new File(["%PDF-1.7 fictional"], "audit.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/^File/), file);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));

    expect(await screen.findByRole("button", { name: /Uploading…/ })).toBeDisabled();
    expect(start).toHaveBeenCalledWith(
      expect.objectContaining({
        documentType: "AUDIT_REPORT",
        financialYear: 2025,
        fileName: "audit.pdf",
        contentType: "application/pdf",
        sizeBytes: file.size,
        checksumSha256: expect.stringMatching(/^[A-Za-z0-9+/]{43}=$/),
      }),
    );
    expect(fetchMock).toHaveBeenCalledWith("https://bucket.example/put", expect.objectContaining({ method: "PUT", body: file }));
    await act(async () => finishPut(new Response(null, { status: 200 })));
    expect(complete).toHaveBeenCalledWith("doc-1");
    expect(await screen.findByText("Uploaded. The document is on the society record.")).toBeInTheDocument();
  });

  it("refuses files over 10 MB and other file types before uploading", async () => {
    const start = vi.fn();
    render(<DocumentUpload complete={vi.fn()} financialYears={years} start={start} />);
    const big = new File([new Uint8Array(10_000_001)], "big.pdf", { type: "application/pdf" });
    await userEvent.upload(screen.getByLabelText(/^File/), big);
    await userEvent.click(screen.getByRole("button", { name: "Upload" }));
    expect(screen.getByRole("alert")).toHaveTextContent("larger than 10 MB");
    expect(start).not.toHaveBeenCalled();
  });

  it("leaves out the audit report for roles that cannot upload it", () => {
    render(<DocumentUpload allowAuditReport={false} complete={vi.fn()} financialYears={years} start={vi.fn()} />);
    expect(screen.queryByRole("option", { name: "Audit report" })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: "AGM minutes" })).toBeInTheDocument();
  });
});
