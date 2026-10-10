import { PageHeading } from "@/components/dashboard/page-heading";
import { ReviewQueue } from "@/components/dashboard/review-queue";
import { reviewQueue } from "@/lib/demo-registry";

export default function ReviewsPage() {
  return (
    <>
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <PageHeading description="Submissions awaiting District Manager review. Decision actions are intentionally deferred to Sprint 2." title="Review queue" />
        <div className="rounded-xl border border-[#eadba7] bg-[#fff9e9] px-5 py-3"><span className="text-xs text-[#806718]">Waiting for review</span><strong className="ml-3 text-xl text-[#745704]">{reviewQueue.length}</strong></div>
      </div>
      <ReviewQueue items={reviewQueue} />
    </>
  );
}
