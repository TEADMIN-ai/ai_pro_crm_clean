
import { NextRequest, NextResponse } from "next/server";
import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { AuthorizationError, requireAuthorizedUser, type AuthorizedUser } from "@/lib/server/authz";
import { buildSubmissionReviewView, canAccessSubmissionReview, isMockSubmissionReviewData } from "@/lib/submission-review";
import { isContractorVisibleToWorkspace } from "@/lib/contractors/contractorVisibility";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Data=Record<string,unknown>;
const asString=(v:unknown)=>typeof v==="string"&&v.trim()?v.trim():null;
const asRecord=(v:unknown):Data=>v&&typeof v==="object"?v as Data:{};
const jsonError=(message:string,status:number)=>NextResponse.json({error:message},{status});
function iso(v:unknown):unknown{return v&&typeof v==="object"&&"toDate" in v&&typeof (v as {toDate?:unknown}).toDate==="function"?(v as {toDate:()=>Date}).toDate().toISOString():v;}
function plain(id:string,data:Data):Data{return Object.fromEntries(Object.entries({id,...data}).map(([k,v])=>[k,iso(v)]));}
async function actorWorkspace(actor:AuthorizedUser){const snap=await getFirebaseAdmin().collection("users").doc(actor.uid).get();return asString((snap.data()??{}).workspaceId);}
async function doc(collection:string,id:string){const snap=await getFirebaseAdmin().collection(collection).doc(id).get();return snap.exists?plain(snap.id,snap.data()??{}):null;}
async function activity(dealId:string){const snap=await getFirebaseAdmin().collection("deals").doc(dealId).collection("activity").orderBy("createdAt","desc").limit(25).get();return snap.docs.map((d)=>plain(d.id,d.data()??{}));}
async function toView(review:Data,actor:AuthorizedUser,workspaceId:string|null){
if(isMockSubmissionReviewData(review))return null;
const dealId=asString(review.dealId)??asString(review.id),contractorId=asString(review.contractorId);
const deal=dealId?await doc("deals",dealId):null,contractor=contractorId?await doc("contractors",contractorId):null;
const pricingSnapshot=dealId?await getFirebaseAdmin().collection("tenderPricingWorkspaces").where("dealId","==",dealId).limit(1).get():null;
const canonicalPricing=pricingSnapshot&&!pricingSnapshot.empty?{id:pricingSnapshot.docs[0].id,...(pricingSnapshot.docs[0].data()??{})}:null;
const dealWithCanonicalPricing=deal&&canonicalPricing?{...deal,tenderPricing:canonicalPricing}:deal;
if(contractor&&!isContractorVisibleToWorkspace(contractor,{workspaceId:workspaceId??asString(review.workspaceId)??asString(asRecord(deal).workspaceId),actorRole:actor.role}).visible)return null;
const access=canAccessSubmissionReview({actor:{role:actor.role,contractorId:actor.contractorId,workspaceId},review,contractor});
if(!access.ok){const failure=access as {status:number;reason:string};throw Object.assign(new Error(failure.reason),{status:failure.status});}
return buildSubmissionReviewView({review,deal:dealWithCanonicalPricing,contractor,activity:dealId?await activity(dealId):[]});
}
export async function GET(request:NextRequest){
try{const actor=await requireAuthorizedUser(request);const workspaceId=await actorWorkspace(actor);const dealId=request.nextUrl.searchParams.get("dealId")?.trim();
if(dealId){const review=await doc("submissionReviews",dealId);if(!review)return NextResponse.json({status:"missing",message:"Submission review has not been created for this opportunity."},{status:404});const view=await toView(review,actor,workspaceId);return NextResponse.json({status:"ok",review:view},{status:200});}
let query:FirebaseFirestore.Query=getFirebaseAdmin().collection("submissionReviews").limit(50);
if(actor.role==="contractor")query=query.where("contractorId","==",actor.contractorId??"__none__");
const snap=await query.get();const reviews=[];for(const item of snap.docs){const view=await toView(plain(item.id,item.data()??{}),actor,workspaceId);if(view)reviews.push(view);}return NextResponse.json({status:"ok",reviews},{status:200});
}catch(error){if(error instanceof AuthorizationError)return jsonError(error.message,error.status);const status=typeof error==="object"&&error&&"status" in error&&typeof (error as {status?:unknown}).status==="number"?(error as {status:number}).status:500;return jsonError(status===403?"unauthorized":"Failed to load submission review records",status);}}
export async function POST(request:NextRequest){
try{const actor=await requireAuthorizedUser(request);if(!(actor.role==="admin"||actor.role==="manager"||actor.role==="staff"))return jsonError("unauthorized",403);
const body=asRecord(await request.json().catch(()=>({}))),dealId=asString(body.dealId);if(!dealId)return jsonError("dealId is required",400);
const deal=await doc("deals",dealId);if(!deal)return jsonError("Opportunity not found",404);
const contractorId=asString(deal.contractorId)??asString(asRecord(deal.contractorAssignment).contractorId);if(!contractorId)return jsonError("Submission review cannot be repaired before contractor assignment is complete",409);
await getFirebaseAdmin().collection("submissionReviews").doc(dealId).set({id:dealId,opportunityId:dealId,dealId,contractorId,workspaceId:asString(deal.workspaceId),readiness:0,validationStatus:"pending",complianceStatus:"pending",pricingStatus:"pending",boqStatus:"pending",documentStatus:"pending",signatureStatus:"pending",approvalStatus:"pending",packStatus:"pending",blockers:["Compliance review is required"],nextAction:"Start compliance review",updatedAt:new Date().toISOString(),repairedBy:actor.uid},{merge:true});
const review=await doc("submissionReviews",dealId);const view=review?await toView(review,actor,await actorWorkspace(actor)):null;return NextResponse.json({status:"ok",review:view},{status:200});
}catch(error){if(error instanceof AuthorizationError)return jsonError(error.message,error.status);return jsonError("Failed to repair submission review connection",500);}}

