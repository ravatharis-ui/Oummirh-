import type { Metadata } from "next";

import { getMyDocuments, MyDocuments } from "@/modules/documents";

export const metadata: Metadata = { title: "Documents" };
export const dynamic = "force-dynamic";

export default async function CollabDocumentsPage() {
  const documents = await getMyDocuments();

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4">
      <h1 className="text-2xl font-semibold">Mes documents</h1>
      <MyDocuments documents={documents} />
    </div>
  );
}
