export async function logActivity({
  contractorId,
  action,
  performedBy = "system",
}: {
  contractorId: string;
  action: string;
  performedBy?: string;
}) {
  const { getFirebaseAdmin } = await import("@/lib/firebase/admin");
  const db = getFirebaseAdmin();

  await db.collection("contractorActivity").add({
    contractorId,
    action,
    performedBy,
    timestamp: new Date(),
  });
}
