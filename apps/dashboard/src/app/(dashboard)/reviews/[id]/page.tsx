import Link from "next/link";
import { notFound } from "next/navigation";

import { PageHeading } from "@/components/dashboard/page-heading";
import { ReviewDetail } from "@/components/dashboard/review-detail";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getSubmission } from "@/lib/submissions-api";

import { reviewAction } from "./actions";

export default async function ReviewDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getSubmission(await getCurrentViewer(), id);
  if (result.status === "not-found") notFound();

  if (result.status !== "ok") {
    const message =
      result.status === "forbidden" ? "Your role cannot review this submission." : result.message;
    return (
      <>
        <PageHeading description="Review a submission from a village society." title="Review submission" />
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-4 text-[13px] text-danger-text" role="alert">
          {message}
        </p>
      </>
    );
  }

  return (
    <>
      <PageHeading
        description={`${result.submission.societyName ?? "Society"} · ${result.submission.reference}`}
        title={result.submission.title}
      />
      <p className="mt-2 text-[12px]">
        <Link className="text-[#2d5c88] underline underline-offset-2" href="/reviews">
          Back to the review queue
        </Link>
      </p>
      <ReviewDetail performAction={reviewAction} submission={result.submission} />
    </>
  );
}
