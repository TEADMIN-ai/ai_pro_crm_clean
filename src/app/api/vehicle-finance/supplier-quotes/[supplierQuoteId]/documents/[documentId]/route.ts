export const runtime="nodejs";
import { NextRequest, NextResponse } from "next/server";
import { getFirebaseStorageBucket } from "@/lib/firebase/admin";
import { assertVehicleFinanceStaffRole, AuthorizationError, requireAuthorizedUser } from "@/lib/server/authz";
import { getVehicleFinanceSupplierQuoteDocument, VehicleFinanceProcurementValidationError } from "@/lib/vehicleFinance/vehicleFinanceService";
export async function GET(request:NextRequest,{params}:{params:Promise<{supplierQuoteId:string;documentId:string}>}){try{const user=await requireAuthorizedUser(request);assertVehicleFinanceStaffRole(user);const {supplierQuoteId,documentId}=await params;const {document}=await getVehicleFinanceSupplierQuoteDocument(supplierQuoteId,documentId);const [bytes]=await getFirebaseStorageBucket().file(document.storagePath!).download();return new NextResponse(new Uint8Array(bytes),{headers:{"Content-Type":document.mimeType??"application/octet-stream","Content-Disposition":`attachment; filename="${document.fileName.replace(/[\\"]/g,"_")}"`,"Cache-Control":"private, no-store"}})}catch(error){const status=error instanceof AuthorizationError?error.status:error instanceof VehicleFinanceProcurementValidationError?error.status:500;return NextResponse.json({error:error instanceof Error?error.message:"Quote document unavailable"},{status})}}

