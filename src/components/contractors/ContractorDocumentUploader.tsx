"use client";

import { useState } from "react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";

type Props = {
  contractorId: string;

  /** Action called after successful upload */
  onUploadedAction?: () => void | Promise<void>;
};

export default function ContractorDocumentUploader({
  contractorId,
  onUploadedAction,
}: Props) {

  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);

  function detectDocType(name: string): string {
    const extension = name.toLowerCase().split(".").pop() ?? "";

    if (extension === "pdf") return "certificate";
    if (extension === "csv" || extension === "xls" || extension === "xlsx") return "tax";
    if (extension === "jpg" || extension === "jpeg" || extension === "png" || extension === "webp") {
      return "identity";
    }
    if (extension === "doc" || extension === "docx") return "general";

    return "general";
  }

  async function upload() {

    if (!file) return;

    try {

      setLoading(true);

      const res = await fetch(
        `/api/contractors/${contractorId}/documents`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({

            fileName: file.name,
            originalName: file.name,
            docType: detectDocType(file.name),
            status: "active",

          }),
        }
      );

      if (!res.ok) {

        const text = await res.text();
        throw new Error(text);

      }

      setFile(null);
      setFileName("");

      if (onUploadedAction) {

        await onUploadedAction();

      }

    }
    catch (err) {

      console.error(err);

    }
    finally {

      setLoading(false);

    }
  }

  return (
    <Card>
      <div className="enterprise-grid">
        <div>
          <Badge tone="info">Client Upload Flow</Badge>
        </div>
      <input
        type="file"
        onChange={(e) => {

          const selected = e.target.files?.[0] ?? null;

          setFile(selected);

          if (selected) {
            setFileName(selected.name);
          }

        }}
      />
      <div>
        <input
          value={fileName}
          readOnly
          placeholder="File name"
          style={{ width: "100%", maxWidth: 420, padding: 8, borderRadius: 8, border: "1px solid #c9d8ef" }}
        />
      </div>
      <button
        onClick={upload}
        disabled={loading || !file}
      >
        {loading ? "Uploading..." : "Upload"}
      </button>
      </div>
    </Card>
  );
}
