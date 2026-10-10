type BrandProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function Brand({ compact = false, inverse = false }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="relative grid size-10 shrink-0 place-items-center overflow-hidden rounded-full border-2 border-[#f6c744] bg-[#f5df53] shadow-sm"
      >
        <span className="absolute bottom-0 h-4 w-full bg-[#d94b35]" />
        <span className="relative text-lg font-black text-[#123d29]">S</span>
      </span>
      {!compact && (
        <span className="leading-tight">
          <strong
            className={`block text-sm font-semibold ${inverse ? "text-white" : "text-[#173b2a]"}`}
          >
            Sarvodaya Connect
          </strong>
          <span
            className={`text-[11px] ${inverse ? "text-[#c9ddcd]" : "text-[#6d7c72]"}`}
          >
            Village Society Registry
          </span>
        </span>
      )}
    </div>
  );
}
