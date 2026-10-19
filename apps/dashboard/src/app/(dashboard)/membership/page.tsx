import { MembershipDashboard } from "@/components/dashboard/membership-dashboard";
import { getCurrentViewer } from "@/lib/current-viewer";
import {
  calculateMembershipTotals,
  demoMembershipSocieties,
  membershipVisibleTo,
} from "@/lib/demo-membership";

export default async function MembershipPage() {
  const viewer = await getCurrentViewer();
  const visibleSocieties = membershipVisibleTo(demoMembershipSocieties, viewer);
  const summary = calculateMembershipTotals(visibleSocieties);

  return <MembershipDashboard summary={summary} />;
}
