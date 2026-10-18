import { GlobalSearchResults } from "@/components/dashboard/global-search";
import { PageHeading } from "@/components/dashboard/page-heading";
import { societyDetails } from "@/lib/demo-registry";
import { societiesVisibleTo, demoSocietyAccess } from "@/lib/society-access";
import { searchRegistry } from "@/lib/registry-search";

export default async function SearchPage({ searchParams }: PageProps<"/search">) {
  const { q } = await searchParams;
  const query = Array.isArray(q) ? q[0] ?? "" : q ?? "";
  const permittedSocieties = societiesVisibleTo(societyDetails, demoSocietyAccess);
  const results = searchRegistry(permittedSocieties, query);

  return (
    <>
      <PageHeading description="Search society profiles and related records you are permitted to view." title="Global search" />
      <GlobalSearchResults query={query} results={results} />
    </>
  );
}
