
import { buildOpportunityExecutionState } from "@/lib/opportunities/opportunityExecution";
import { buildProcurementExecutionProjection } from "@/lib/opportunities/procurementExecutionProjection";

export type SubmissionReviewAccessRole="admin"|"manager"|"staff"|"contractor"|string;
export type SubmissionReviewSectionKey="overview"|"compliance"|"documents"|"boqPricing"|"reviewApproval"|"tenderPack"|"submission";
export type SubmissionReviewSection={key:SubmissionReviewSectionKey;label:string;status:string;blockers:string[];evidence:string[];owner:string;nextAction:string};
export type SubmissionReviewTimelineItem={id:string;message:string;phase:string|null;actor:string|null;createdAt:string|null};
export type SubmissionReviewView={
id:string;opportunityId:string;dealId:string;opportunityTitle:string;rfqNumber:string;clientIssuer:string;
closingDate:string|null;contractorId:string|null;contractorName:string;contractorArchived:boolean;
currentWorkflowPhase:string;readiness:number;complianceStatus:string;pricingStatus:string;boqStatus:string;
documentStatus:string;signatureStatus:string;approvalStatus:string;packStatus:string;submissionStatus:string;
blockers:string[];nextAction:string;assignedOwner:string;updatedAt:string|null;workspaceId:string|null;
connectionStatus:"connected"|"incomplete";sections:SubmissionReviewSection[];auditTimeline:SubmissionReviewTimelineItem[];
};
export type SubmissionReviewAccessInput={role:SubmissionReviewAccessRole;contractorId?:string|null;workspaceId?:string|null};
type R=Record<string,unknown>;
const rec=(v:unknown):R=>v&&typeof v==="object"&&!Array.isArray(v)?v as R:{};
const str=(v:unknown):string|null=>typeof v==="string"&&v.trim()?v.trim():null;
const arr=(v:unknown):string[]=>Array.isArray(v)?v.filter((x):x is string=>typeof x==="string"&&x.trim().length>0).map((x)=>x.trim()):[];
const pct=(v:unknown):number=>typeof v==="number"&&Number.isFinite(v)?Math.max(0,Math.min(100,Math.round(v))):0;
const stat=(v:unknown,f="pending"):string=>str(v)??f;
const evidence=(...v:unknown[]):string[]=>Array.from(new Set(v.flatMap(arr)));
const owner=(k:SubmissionReviewSectionKey,r:R):string=>str(r.assignedOwner??r.owner)??(k==="boqPricing"?"qs":k==="compliance"?"compliance":k==="reviewApproval"||k==="tenderPack"?"manager":k==="submission"?"operations":"staff");
export function isMockSubmissionReviewData(v:unknown):boolean{const s=rec(v);return s.mockData===true||s.demoData===true||s.mockReview===true||s.demoReview===true||s.benchmarkReview===true;}
export function isArchivedSubmissionReviewContractor(v:unknown):boolean{const s=rec(v);return s.archived===true||str(s.status)?.toLowerCase()==="archived";}
export function getSubmissionReviewContractorName(contractor:unknown,review:unknown):string{const c=rec(contractor),r=rec(review);return str(c.companyName)??str(c.businessName)??str(c.tradingName)??str(c.name)??str(r.contractorName)??"Assigned contractor";}
export function canAccessSubmissionReview(input:{actor:SubmissionReviewAccessInput;review:unknown;contractor?:unknown}):{ok:true}|{ok:false;status:403;reason:string}{
const r=rec(input.review),c=rec(input.contractor),role=input.actor.role,w=input.actor.workspaceId,rw=str(r.workspaceId),cw=str(c.workspaceId);
if((role==="admin"||role==="manager"||role==="staff")&&w&&((rw&&rw!==w)||(cw&&cw!==w)))return{ok:false,status:403,reason:"cross_workspace"};
if(role==="admin"||role==="manager"||role==="staff")return{ok:true};
if(role==="contractor"&&input.actor.contractorId&&input.actor.contractorId===str(r.contractorId))return{ok:true};
return{ok:false,status:403,reason:"unauthorized"};}
export function buildSubmissionReviewView(input:{review:unknown;deal?:unknown;contractor?:unknown;activity?:unknown[]}):SubmissionReviewView{
const r=rec(input.review),d=rec(input.deal),c=rec(input.contractor);
if(isMockSubmissionReviewData(r)||isMockSubmissionReviewData(d)||isMockSubmissionReviewData(c))throw new Error("Submission review mock data is not allowed");
const executionState=buildOpportunityExecutionState({deal:Object.keys(d).length?d:r,contractor:Object.keys(c).length?c:null});
const projection=buildProcurementExecutionProjection({deal:Object.keys(d).length?d:r,state:executionState,remediationRequests:executionState.remediationRequests});
const dealId=str(r.dealId)??str(d.id)??str(r.id)??projection.dealId??"unknown",opportunityId=str(r.opportunityId)??projection.opportunityId??dealId,contractorId=str(r.contractorId)??projection.contractorId;
const archived=isArchivedSubmissionReviewContractor(c),projectionBlockers=projection.blockers.map((item)=>item.problem),base=arr(r.blockers).length?arr(r.blockers):projectionBlockers,blockers=archived?["Assigned contractor is archived",...base]:base;
const current=stat(r.currentWorkflowPhase??r.currentPhase??r.phase??projection.currentPhase,"COMPLIANCE_REVIEW");
const next=str(r.nextAction)??projection.nextAction.label??(blockers.length?"Resolve submission review blockers":"Continue submission review"),assigned=str(r.assignedOwner??r.owner)??projection.assignedOwner??owner("overview",r);
const section=(key:SubmissionReviewSectionKey,label:string,s:string,rx:RegExp,ev:string[],na:string):SubmissionReviewSection=>({key,label,status:s,blockers:blockers.filter((b)=>rx.test(b)),evidence:ev,owner:owner(key,r),nextAction:na});
const sections:SubmissionReviewSection[]=[
{key:"overview",label:"Overview",status:current,blockers,evidence:evidence(r.evidence,d.documents),owner:assigned,nextAction:next},
section("compliance","Compliance",stat(r.complianceStatus),/compliance|tax|bbbee|coida|csd|archived/i,evidence(r.complianceEvidence),stat(r.complianceNextAction,"Complete compliance review")),
section("documents","Documents",stat(r.documentStatus),/document|returnable|form|annexure/i,evidence(r.documentEvidence,d.documents),stat(r.documentNextAction,"Prepare returnable documents")),
section("boqPricing","BOQ & Pricing",`${stat(r.boqStatus)} / ${stat(r.pricingStatus)}`,/boq|pricing|price/i,evidence(r.pricingEvidence,r.boqEvidence),stat(r.pricingNextAction,"Complete BOQ and pricing")),
section("reviewApproval","Review & Approval",stat(r.approvalStatus),/approval|review|signature/i,evidence(r.approvalEvidence),stat(r.approvalNextAction,"Complete internal approval")),
section("tenderPack","Tender Pack",stat(r.packStatus),/pack|validation/i,evidence(r.packEvidence),stat(r.packNextAction,"Generate and validate tender pack")),
section("submission","Submission",stat(r.submissionStatus,"not_submitted"),/submission|portal|email|proof/i,evidence(r.submissionEvidence),stat(r.submissionNextAction,"Record submission"))];
return{id:str(r.id)??dealId,opportunityId,dealId,opportunityTitle:str(d.title)??str(r.opportunityTitle)??"Untitled opportunity",rfqNumber:str(d.rfqNumber)??str(r.rfqNumber)??str(rec(d.tenderAnalysis).tenderNumber)??dealId,clientIssuer:str(d.clientName)??str(d.issuingAuthority)??str(r.clientIssuer)??str(rec(d.tenderAnalysis).issuingAuthority)??"Unknown issuer",closingDate:str(d.closingDate)??str(d.deadline)??str(r.closingDate),contractorId,contractorName:archived?"Archived contractor":getSubmissionReviewContractorName(c,r),contractorArchived:archived,currentWorkflowPhase:current,readiness:pct(r.readiness??r.readinessScore??projection.submissionReadiness),complianceStatus:stat(r.complianceStatus??projection.complianceStatus),pricingStatus:stat(r.pricingStatus??projection.pricingStatus),boqStatus:stat(r.boqStatus??projection.pricingClassification),documentStatus:stat(r.documentStatus??projection.documentPreparationStatus),signatureStatus:stat(r.signatureStatus??projection.signatureStatus),approvalStatus:stat(r.approvalStatus??projection.reviewStatus),packStatus:stat(r.packStatus??projection.packStatus),submissionStatus:stat(r.submissionStatus??projection.submissionStatus,"not_submitted"),blockers,nextAction:next,assignedOwner:assigned,updatedAt:str(r.updatedAt),workspaceId:str(r.workspaceId)??str(d.workspaceId),connectionStatus:contractorId&&dealId!=="unknown"?"connected":"incomplete",sections,auditTimeline:(input.activity??[]).map((x,i)=>{const a=rec(x);return{id:str(a.id)??`activity-${i+1}`,message:str(a.message)??str(a.type)??"Submission review updated",phase:str(a.phase),actor:str(a.performedByEmail??a.actorEmail??a.actor),createdAt:str(a.createdAt)}})}}
