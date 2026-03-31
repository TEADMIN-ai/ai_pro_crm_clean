"use client";

import { useEffect, useState } from "react";
import { collection, getDocs, orderBy, query, where } from "firebase/firestore";

import { db } from "@/lib/firebase";

type FirestoreTimestampLike = {
  seconds?: number;
};

type TenderPackRecord = {
  id: string;
  contractorId?: string;
  templateKey?: string;
  documentType?: string;
  createdAt?: number | FirestoreTimestampLike | null;
  downloadURL?: string;
  fileUrl?: string;
};

type Props = {
  contractorId: string;
};

function formatCreatedAt(value: TenderPackRecord["createdAt"]) {
  if (typeof value === "number") {
    return new Date(value).toLocaleString();
  }

  if (value && typeof value.seconds === "number") {
    return new Date(value.seconds * 1000).toLocaleString();
  }

  return "Unknown date";
}

function resolveDownloadUrl(pack: TenderPackRecord) {
  return pack.downloadURL ?? pack.fileUrl ?? "";
}

function resolveDocumentLabel(pack: TenderPackRecord) {
  const label = pack.documentType ?? pack.templateKey ?? "Tender Pack";
  return label.toUpperCase();
}

export default function TenderPackHistory({ contractorId }: Props) {
  const [packs, setPacks] = useState<TenderPackRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchPacks() {
      try {
        const packsQuery = query(
          collection(db, "tenderPacks"),
          where("contractorId", "==", contractorId),
          orderBy("createdAt", "desc")
        );

        const snapshot = await getDocs(packsQuery);
        const records = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...(doc.data() as Omit<TenderPackRecord, "id">),
        }));

        setPacks(records);
      } catch (error) {
        console.error("Failed to fetch tender packs", error);
      } finally {
        setLoading(false);
      }
    }

    if (!contractorId) {
      setPacks([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    void fetchPacks();
  }, [contractorId]);

  if (loading) {
    return <p>Loading tender packs...</p>;
  }

  if (!packs.length) {
    return <p>No tender packs found.</p>;
  }

  return (
    <div className="space-y-4">
      {packs.map((pack) => {
        const downloadUrl = resolveDownloadUrl(pack);

        return (
          <div
            key={pack.id}
            className="flex items-center justify-between rounded-lg border p-4"
          >
            <div>
              <p className="font-semibold">{resolveDocumentLabel(pack)}</p>
              <p className="text-sm text-gray-500">{formatCreatedAt(pack.createdAt)}</p>
            </div>

            {downloadUrl ? (
              <a
                href={downloadUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded bg-blue-600 px-3 py-1 text-white"
              >
                Download
              </a>
            ) : (
              <span className="text-sm text-gray-500">Unavailable</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
