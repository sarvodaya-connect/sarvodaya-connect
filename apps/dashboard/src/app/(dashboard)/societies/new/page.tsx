import type { ScopeOptions } from "@sarvodaya-connect/api-contracts";

import { NoAccessState } from "@/components/dashboard/data-states";
import { CreateSocietyForm } from "@/components/dashboard/society-record/create-society-form";
import { getT } from "@/i18n/server";
import { getCurrentViewer } from "@/lib/current-viewer";
import { platformApi } from "@/lib/platform-api";

import { createSociety } from "../[id]/record-actions";

/** V5 D05n / D05c: HQ creates a society record. The API allows HQ only. */
export default async function NewSocietyPage() {
  const [viewer, t] = await Promise.all([getCurrentViewer(), getT()]);
  if (viewer.role !== "HQ_ADMIN") return <NoAccessState heading="h1" t={t} />;
  const options: ScopeOptions = await platformApi("/identity/scope-options");
  return <CreateSocietyForm action={createSociety} districts={options.districts} />;
}
