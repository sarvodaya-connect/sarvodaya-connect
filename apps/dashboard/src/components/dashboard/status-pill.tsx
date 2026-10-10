const styles: Record<string, string> = {
  ACTIVE: "bg-[#e5f3e8] text-[#25643f] ring-[#c6e2cd]",
  APPROVED: "bg-[#e5f3e8] text-[#25643f] ring-[#c6e2cd]",
  INACTIVE: "bg-[#f0f1ee] text-[#667168] ring-[#dde1dc]",
  PENDING: "bg-[#fff5d9] text-[#7a5a00] ring-[#efdda5]",
  SUBMITTED: "bg-[#e5eef8] text-[#315d88] ring-[#c8d9ea]",
  UNDER_REVIEW: "bg-[#fff5d9] text-[#7a5a00] ring-[#efdda5]",
  UNVERIFIED: "bg-[#fff0e5] text-[#92511f] ring-[#f0d3bc]",
  VERIFIED: "bg-[#e5f3e8] text-[#25643f] ring-[#c6e2cd]",
};

export function StatusPill({ value }: { value: string }) {
  const label = value.replaceAll("_", " ").toLowerCase();
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ring-1 ring-inset ${
        styles[value] ?? "bg-[#f0f1ee] text-[#667168] ring-[#dde1dc]"
      }`}
    >
      <span className="size-1.5 rounded-full bg-current opacity-80" />
      {label}
    </span>
  );
}
