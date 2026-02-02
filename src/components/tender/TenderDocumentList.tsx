"use client";

import { Deal } from "@/types/deal";

type Props = {
  deal: Deal;
};

export default function TenderDocumentList({ deal }: Props) {
  if (!deal.documents || deal.documents.length === 0) {
    return <p>No documents uploaded</p>;
  }

  return (
    <ul style={{ marginTop: 6 }}>
      {deal.documents.map(doc => (
        <li key={doc.id}>📄 {doc.name}</li>
      ))}
    </ul>
  );
}