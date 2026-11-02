import { TableSkeleton } from "@/components/dashboard/data-states";

export default function DashboardLoading() {
  return (
    <>
      <div aria-hidden="true">
        <div className="h-7 w-48 rounded-lg bg-[#e3e8e1] motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-full max-w-md rounded-full bg-[#e9ede6] motion-safe:animate-pulse" />
      </div>
      <div className="mt-6">
        <TableSkeleton label="Loading dashboard data" />
      </div>
    </>
  );
}
