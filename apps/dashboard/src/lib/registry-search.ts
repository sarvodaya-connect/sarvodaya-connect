import type { SocietyDetails } from "@sarvodaya-connect/api-contracts";

export type RegistrySearchResult = {
  societyId: string;
  societyName: string;
  societyCode: string;
  kind: "Society" | "Contact" | "Committee" | "Document" | "History";
  title: string;
  description: string;
};

export function searchRegistry(societies: SocietyDetails[], query: string): RegistrySearchResult[] {
  const term = query.trim().toLocaleLowerCase();
  if (!term) return [];

  return societies.flatMap((society) => {
    const results: RegistrySearchResult[] = [];
    const base = {
      societyId: society.id,
      societyName: society.nameEn,
      societyCode: society.societyCode,
    };
    const add = (kind: RegistrySearchResult["kind"], title: string, description: string, searchable: string) => {
      if (searchable.toLocaleLowerCase().includes(term)) results.push({ ...base, kind, title, description });
    };

    add(
      "Society",
      society.nameEn,
      `${society.societyCode} · ${society.district.nameEn} · ${society.address.dsDivision ?? "Division not recorded"}`,
      [society.nameEn, society.nameLocal, society.societyCode, society.status, society.district.nameEn,
        society.address.addressLine, society.address.village, society.address.gnDivision, society.address.dsDivision]
        .filter(Boolean).join(" "),
    );
    society.contacts.forEach((contact) => add(
      "Contact",
      contact.fullName ?? contact.label ?? "Society contact",
      [contact.position, contact.phone, contact.email].filter(Boolean).join(" · "),
      [contact.fullName, contact.label, contact.position, contact.phone, contact.email].filter(Boolean).join(" "),
    ));
    society.committee.forEach((member) => add(
      "Committee",
      member.fullName,
      [member.position, member.phone, member.email].filter(Boolean).join(" · "),
      [member.fullName, member.position, member.phone, member.email].filter(Boolean).join(" "),
    ));
    society.documents.forEach((document) => add(
      "Document",
      document.fileName,
      `${document.documentType.replaceAll("_", " ")} · ${document.status}`,
      [document.fileName, document.documentType, document.status, document.uploadedBy].join(" "),
    ));
    society.history.forEach((event) => add(
      "History",
      event.summary,
      [event.actorDisplayName, event.eventType].filter(Boolean).join(" · "),
      [event.summary, event.actorDisplayName, event.eventType].filter(Boolean).join(" "),
    ));
    return results;
  });
}
