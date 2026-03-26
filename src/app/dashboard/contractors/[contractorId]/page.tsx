import { redirect } from "next/navigation";
import GenerateSBD4Button from "./GenerateSBD4Button";
import ContractorDocumentsSection from "./ContractorDocumentsSection";
import UploadDocument from "@/components/upload/UploadDocument";
import { normalizeContractorId, normalizeRole } from "@/lib/auth/userProfile";
import { calculateComplianceScore } from "@/lib/compliance/calculateComplianceScore";
import { getLatestDocumentsByType } from "@/lib/compliance/contractorCompliance";
import {
  AuthorizationError,
  assertCanAccessContractor,
  type AuthorizedUser,
} from "@/lib/server/authz";
import { verifySession } from "@/lib/server/verifySession";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import {
  getContractorById,
  listContractorDocuments,
} from "@/server/services/contractorService";

type PageProps = {
  params: Promise<{ contractorId: string }>;
};

type ContractorRecord = {
  companyName?: string | null;
  companyRegistrationNumber?: string | null;
  contactPerson?: string | null;
  email?: string | null;
  phone?: string | null;
  directors?: string | null;
  directorNames?: string | null;
};

async function getAuthorizedUser(): Promise<AuthorizedUser | null> {
  const session = await verifySession();

  if (!session) {
    return null;
  }

  const profileSnapshot = await getFirebaseAdmin().collection("users").doc(session.uid).get();
  const profile = profileSnapshot.exists ? profileSnapshot.data() : null;

  return {
    uid: session.uid,
    email: typeof session.email === "string" ? session.email : undefined,
    role: normalizeRole(profile?.role ?? session.role),
    contractorId: normalizeContractorId(profile?.contractorId ?? session.contractorId),
  };
}

async function getContractorWorkspace(contractorId: string) {
  const [contractor, documents] = await Promise.all([
    getContractorById(contractorId),
    listContractorDocuments(contractorId),
  ]);

  if (!contractor) {
    return null;
  }

  return {
    contractor: contractor as ContractorRecord,
    documents,
  };
}

export default async function ContractorPage({ params }: PageProps) {
  const { contractorId } = await params;
  const user = await getAuthorizedUser();

  if (!user) {
    redirect("/login");
  }

  try {
    assertCanAccessContractor(user, contractorId);
  } catch (error) {
    if (error instanceof AuthorizationError) {
      return <div style={{ padding: "20px" }}>Access denied</div>;
    }

    throw error;
  }

  const data = await getContractorWorkspace(contractorId);

  if (!data) {
    return <div style={{ padding: "20px" }}>Contractor not found</div>;
  }

  const documents = data.documents || [];
  const latestDocuments = getLatestDocumentsByType(documents);
  const validDocs = latestDocuments.filter((doc) => doc?.status === "APPROVED").length;
  const stats = calculateComplianceScore(latestDocuments);
  const hasDocumentsNeedingReview = latestDocuments.some((doc) => doc?.status !== "APPROVED");

  return (
    <div style={{ padding: "20px", display: "grid", gap: "24px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: "bold", margin: 0 }}>
          Contractor Workspace
        </h1>
        <p style={{ marginTop: "8px", color: "#475569" }}>
          View contractor details, compliance progress, and document readiness.
        </p>
      </div>

      <div>
        <h2 style={{ marginBottom: "12px" }}>Company Info</h2>
        <p>
          <strong>Name:</strong> {data.contractor.companyName || "-"}
        </p>
        <p>
          <strong>Registration:</strong>{" "}
          {data.contractor.companyRegistrationNumber || "-"}
        </p>
        <p>
          <strong>Email:</strong> {data.contractor.email || "-"}
        </p>
        <p>
          <strong>Phone:</strong> {data.contractor.phone || "-"}
        </p>
      </div>

      <div>
        <h2 style={{ marginBottom: "12px" }}>Compliance Score</h2>
        <p style={{ fontSize: "28px", fontWeight: "bold", margin: 0 }}>
          {stats.score}%
        </p>
        <p style={{ marginTop: "8px" }}>
          {validDocs} approved / {latestDocuments.length} total
        </p>
      </div>

      <div>
        <h2 style={{ marginBottom: "12px" }}>Documents</h2>
        <ContractorDocumentsSection contractorId={contractorId} documents={latestDocuments} />
      </div>

      <div>
        <h2 style={{ marginBottom: "12px" }}>Fix Suggestions</h2>

        {!hasDocumentsNeedingReview ? (
          <p>No fixes needed</p>
        ) : (
          <ul style={{ paddingLeft: "20px", margin: 0 }}>
            {latestDocuments
              .filter((doc) => doc.status !== "APPROVED")
              .flatMap((doc) => (doc.suggestions ?? doc.aiAnalysis?.suggestions ?? []).map((suggestion, index) => (
                <li key={`${doc.id}-page-suggestion-${index}`} style={{ marginBottom: "8px" }}>
                  {suggestion}
                </li>
              )))}
          </ul>
        )}
      </div>

      <div>
        <h2 style={{ marginBottom: "12px" }}>Actions</h2>

        <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
          <GenerateSBD4Button
            contractor={{
              contractorId,
              companyName: data.contractor.companyName,
              companyRegistrationNumber: data.contractor.companyRegistrationNumber,
              contactPerson: data.contractor.contactPerson,
              email: data.contractor.email,
              phone: data.contractor.phone,
              directors: data.contractor.directors,
              directorNames: data.contractor.directorNames,
            }}
          />
          <UploadDocument contractorId={contractorId} />
        </div>
      </div>
    </div>
  );
}
