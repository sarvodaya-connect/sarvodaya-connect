import { PageHeading } from "@/components/dashboard/page-heading";
import { ReviewQueue } from "@/components/dashboard/review-queue";
import { getCurrentViewer } from "@/lib/current-viewer";
import { getReviewQueue } from "@/lib/submissions-api";

export default async function ReviewsPage() {
  const viewer = await getCurrentViewer();
  const data = await getReviewQueue(viewer);
  return (
    <>
      <PageHeading
        description="Submissions from village societies waiting for your review. Oldest first."
        title="Review Queue"
      />
      {data.available ? (
        <ReviewQueue items={data.items} />
      ) : (
        <p className="mt-6 rounded-card border border-line bg-surface px-5 py-4 text-[13px] text-danger-text" role="alert">
          {data.message}
        </p>
      )}
    </>
  );
}
