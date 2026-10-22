import { PageHeading } from "@/components/dashboard/page-heading";
import { ReviewQueue } from "@/components/dashboard/review-queue";
import { reviewQueue } from "@/lib/demo-registry";

export default function ReviewsPage() {
  return (
    <>
      <PageHeading
        description="Submissions from village societies waiting for your review. Oldest first."
        title="Review Queue"
      />
      <ReviewQueue items={reviewQueue} />
    </>
  );
}
