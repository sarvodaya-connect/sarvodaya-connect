import { Icon } from "./icon";

export function GlobalSearchForm() {
  return (
    <form action="/search" className="relative w-full max-w-md" role="search">
      <label className="sr-only" htmlFor="global-search">Search all permitted records</label>
      <Icon className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[#78857d]" name="search" />
      <input
        className="w-full rounded-lg border border-[#d8dfd8] bg-[#fbfcfa] py-2.5 pl-9 pr-3 text-sm outline-none focus:border-[#39815a] focus:ring-3 focus:ring-[#e1eee3]"
        id="global-search"
        name="q"
        placeholder="Search societies, people and records"
        type="search"
      />
    </form>
  );
}
