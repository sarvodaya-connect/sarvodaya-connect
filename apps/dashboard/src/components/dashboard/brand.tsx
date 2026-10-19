import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  inverse?: boolean;
  masthead?: boolean;
};

export function Brand({ compact = false, inverse = false, masthead = false }: BrandProps) {
  return (
    <div className="flex items-center gap-3">
      <span className={`relative block shrink-0 overflow-hidden rounded-md bg-white ${masthead ? "h-14 w-[148px] md:h-[68px] md:w-[178px]" : "h-11 w-[116px]"}`}>
        <Image
          alt="Sarvodaya Connect"
          className="object-cover"
          fill
          priority
          sizes={masthead ? "178px" : "116px"}
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
