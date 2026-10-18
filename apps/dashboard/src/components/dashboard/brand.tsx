import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  inverse?: boolean;
};

export function Brand({ compact = false, inverse = false }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <span className="relative block h-11 w-[116px] shrink-0 overflow-hidden rounded-md bg-white">
        <Image
          alt="Sarvodaya Connect"
          className="object-cover"
          fill
          priority
          sizes="116px"
          src="/brand/sarvodaya-connect-logo.jpg"
        />
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
