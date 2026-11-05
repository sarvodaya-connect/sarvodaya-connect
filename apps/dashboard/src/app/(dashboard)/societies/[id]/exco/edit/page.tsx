import { notFound } from "next/navigation";

import { NoAccessState } from "@/components/dashboard/data-states";
import { ExcoEditForm } from "@/components/dashboard/society-record/exco-edit-form";
import { getSocietyRecord } from "@/lib/society-record-api";
import { isSocietyRecordId } from "@/lib/society-record-format";

import { updateExco } from "../../record-actions";

/** Edit Exco / Change office bearers. Only people who may edit the record get the form; the API checks again. */
export default async function EditExcoPage({ params, searchParams }: PageProps<"/societies/[id]/exco/edit">) {
  const { id } = await params;
  if (!isSocietyRecordId(id)) notFound();
  const [record, { focus }] = await Promise.all([getSocietyRecord(id), searchParams]);
  if (!record.permissions.canEdit) return <NoAccessState description="Your role can view this Exco but not change it." title="You Can’t Edit This Exco" />;
  return (
    <ExcoEditForm
      action={updateExco.bind(null, id)}
      focusOffices={focus === "offices"}
      members={record.committee}
      societyId={id}
    />
  );
}
