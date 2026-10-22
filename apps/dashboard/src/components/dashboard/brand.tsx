import Image from "next/image";

type BrandProps = {
  compact?: boolean;
  inverse?: boolean;
  masthead?: boolean;
  sidebar?: boolean;
};

export function Brand({ compact = false, inverse = false, masthead = false, sidebar = false }: BrandProps) {
  return (
    <div className={sidebar ? "flex w-full justify-center" : "flex items-center gap-3"}>
      <span className={`relative block shrink-0 overflow-hidden rounded-md bg-white ${sidebar ? "h-[72px] w-full max-w-[190px]" : masthead ? "h-14 w-[148px] md:h-[68px] md:w-[178px]" : "h-11 w-[116px]"}`}>
        <Image
          alt="Sarvodaya Connect"
          className="object-cover"
          fill
          priority
          sizes={sidebar ? "208px" : masthead ? "178px" : "116px"}
          src="/brand/sarvodaya-connect-logo.jpg"
        />
      </span>
      {!compact && !sidebar && (
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
