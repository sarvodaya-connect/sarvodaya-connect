import { PaginationView, YearLinksView } from "./parts";

/**
 * These take functions that build each link, so they stay out of the client
 * parts: a server page cannot pass a function to a client component.
 */
export function YearLinks({ current, href, years }: { current: number; href: (year: number) => string; years: number[] }) {
  return <YearLinksView current={current} links={years.map((year) => ({ href: href(year), year }))} />;
}

export function Pagination({ href, page, totalPages }: { href: (page: number) => string; page: number; totalPages: number }) {
  return <PaginationView nextHref={href(page + 1)} page={page} previousHref={href(page - 1)} totalPages={totalPages} />;
}
