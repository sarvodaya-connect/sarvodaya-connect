import { Icon } from "./icon";

/** V5 header search box. The search page applies the viewer's scope on the server. */
export function GlobalSearchForm({
  action = "/search",
  placeholder = "Search societies, people and records",
}: {
  /** HQ searches nationally; SPCs, DDMs and DMs search their own society list. */
  action?: string;
  placeholder?: string;
}) {
  return (
    <form action={action} className="relative w-full" role="search">
      <label className="sr-only" htmlFor="global-search">Search all permitted records</label>
      <Icon className="absolute left-3 top-1/2 size-[15px] -translate-y-1/2 text-[#6a776e]" name="search" strokeWidth={2} />
      <input
        className="h-[38px] w-full rounded-[10px] border border-line bg-surface pl-[34px] pr-3 text-xs text-ink shadow-[0_1px_2px_rgba(0,0,0,0.05)] outline-none placeholder:text-[#6a776e] focus:border-brand-leaf focus:ring-3 focus:ring-brand-mint"
        id="global-search"
        name="q"
        placeholder={placeholder}
        type="search"
      />
    </form>
  );
}
