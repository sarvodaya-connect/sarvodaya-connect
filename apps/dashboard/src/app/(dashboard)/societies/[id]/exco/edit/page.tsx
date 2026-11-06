import { notFound } from "next/navigation";

import { NoAccessState } from "@/components/dashboard/data-states";
import { ExcoEditForm } from "@/components/dashboard/society-record/exco-edit-form";
import { getT } from "@/i18n/server";
import { getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { updateExco } from "../../record-actions";

/** Edit Exco / Change office bearers. Only people who may edit the record get the form; the API checks again. */
export default async function EditExcoPage({ params, searchParams }: PageProps<"/societies/[id]/exco/edit">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const [record, { focus }, t] = await Promise.all([getSocietyRecord(id), searchParams, getT()]);
  if (!record.permissions.canEdit) return <NoAccessState description={t("sr.ex.cantEditBody")} t={t} title={t("sr.ex.cantEditTitle")} />;
  return (
    <ExcoEditForm
      action={updateExco.bind(null, id)}
      focusOffices={focus === "offices"}
      members={record.committee}
      societyId={id}
    />
  );
}
