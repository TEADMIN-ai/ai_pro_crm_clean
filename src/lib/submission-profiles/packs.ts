import { submissionProfiles } from "./registry";
import type {
  SubmissionPackDefinition,
  SubmissionPackKey,
  SubmissionProfileDefinition,
  SubmissionProfileKey,
  SubmissionProfilePackSet,
} from "./types";

export const submissionProfileKeys: SubmissionProfileKey[] = submissionProfiles.map((profile) => profile.key);

export function getSubmissionProfile(key: SubmissionProfileKey): SubmissionProfileDefinition {
  const profile = submissionProfiles.find((item) => item.key === key);
  if (!profile) {
    throw new Error(`Unknown submission profile: ${key}`);
  }

  return profile;
}

function buildGovernmentSubmissionPack(profile: SubmissionProfileDefinition): SubmissionPackDefinition {
  return {
    key: "government_submission",
    title: "Government Submission",
    audience: "external",
    summary: "Submission-only release pack with no TEOS branding, no AI pages and no workflow pages.",
    includeBranding: false,
    includeAiPages: false,
    includeWorkflowPages: false,
    sections: [
      {
        title: "Submission Documents",
        detail: "The documents required to place the bid on record.",
        items: profile.requiredDocuments.map((item) => item.label),
      },
      {
        title: "Required Forms",
        detail: "Mandatory public-sector forms that must be completed and signed.",
        items: profile.requiredForms.map((item) => item.label),
      },
      {
        title: "Annexures",
        detail: "Supporting annexures that travel with the submission packet.",
        items: profile.annexures.map((item) => item.label),
      },
    ],
  };
}

function buildContractorReviewPack(profile: SubmissionProfileDefinition): SubmissionPackDefinition {
  return {
    key: "contractor_review_pack",
    title: "Contractor Review Pack",
    audience: "contractor",
    summary: "Readiness-first pack for contractor review, guidance and submission preparation.",
    includeBranding: true,
    includeAiPages: false,
    includeWorkflowPages: false,
    sections: [
      {
        title: "Readiness Report",
        detail: "Summary of what is present, what is missing and what needs sign-off.",
        items: [
          profile.summary,
          `${profile.requiredDocuments.length} required documents`,
          `${profile.requiredForms.length} required forms`,
          `${profile.signatureRequirements.length} signature roles`,
        ],
      },
      {
        title: "Checklist",
        detail: "Operational checklist for contractor review before release.",
        items: [
          "Readiness report",
          "Checklist for required documents",
          "Checklist for required forms",
          "Signature readiness guidance",
          "Naming convention check",
        ],
      },
      {
        title: "Guidance",
        detail: "Submission guidance tailored to the selected profile.",
        items: [
          `Naming convention: ${profile.namingConvention}`,
          `Page order: ${profile.pageOrder.join(" -> ")}`,
          `Profile audience: ${profile.audience}`,
        ],
      },
    ],
  };
}

function buildInternalOperationsPack(profile: SubmissionProfileDefinition): SubmissionPackDefinition {
  return {
    key: "internal_operations_pack",
    title: "Internal Operations Pack",
    audience: "internal",
    summary: "Operations pack containing AI, audit, workflow, validation and executive detail for staff use.",
    includeBranding: true,
    includeAiPages: true,
    includeWorkflowPages: true,
    sections: [
      {
        title: "AI Pages",
        detail: "AI-assisted readiness and classification views for internal review.",
        items: ["Readiness summary", "Profile reasoning", "Risk and exception flags"],
      },
      {
        title: "Audit Trail",
        detail: "Record of profile selection, validation and output generation.",
        items: [`Profile: ${profile.label}`, "Generation timestamp", "Reviewer notes"],
      },
      {
        title: "Workflow History",
        detail: "Operational handoff and approval history for the submission pack.",
        items: ["Draft", "Review", "Approved for release", "Archived"],
      },
      {
        title: "Validation Reports",
        detail: "Structured validation output for internal diagnostics and governance.",
        items: ["Rule pass count", "Rule exception count", "Document coverage", "Signature coverage"],
      },
      {
        title: "Executive Notes",
        detail: "Concise leadership summary for release decisions and next actions.",
        items: ["Readiness classification", "Release blockers", "Escalation notes"],
      },
    ],
  };
}

function isPublicSectorProfile(profile: SubmissionProfileDefinition): boolean {
  return profile.key === "government" || profile.key === "municipal";
}

function buildPacksForProfile(profile: SubmissionProfileDefinition): SubmissionPackDefinition[] {
  if (isPublicSectorProfile(profile)) {
    return [buildGovernmentSubmissionPack(profile), buildInternalOperationsPack(profile)];
  }

  return [buildContractorReviewPack(profile), buildInternalOperationsPack(profile)];
}

export const submissionPacks: SubmissionPackDefinition[] = [
  buildGovernmentSubmissionPack(getSubmissionProfile("government")),
  buildContractorReviewPack(getSubmissionProfile("private")),
  buildInternalOperationsPack(getSubmissionProfile("government")),
];

export const submissionPackKeys: SubmissionPackKey[] = submissionPacks.map((pack) => pack.key);

function assertUniquePackKeys(profile: SubmissionProfileDefinition, packs: SubmissionPackDefinition[]): void {
  const seen = new Set<SubmissionPackKey>();
  const duplicateKeys = packs.flatMap((pack) => {
    if (seen.has(pack.key)) {
      return [pack.key];
    }

    seen.add(pack.key);
    return [];
  });

  if (duplicateKeys.length > 0) {
    throw new Error(`Duplicate submission pack keys for ${profile.key}: ${duplicateKeys.join(", ")}`);
  }
}

export function getSubmissionPack(key: SubmissionPackKey): SubmissionPackDefinition {
  const pack = submissionPacks.find((item) => item.key === key);
  if (!pack) {
    throw new Error(`Unknown submission pack: ${key}`);
  }

  return pack;
}

export function getSubmissionProfilePackSet(key: SubmissionProfileKey): SubmissionProfilePackSet {
  const profile = getSubmissionProfile(key);
  const packs = buildPacksForProfile(profile);

  assertUniquePackKeys(profile, packs);

  return {
    profile,
    packs,
  };
}

export function buildSubmissionProfilePackSet(key: SubmissionProfileKey): SubmissionProfilePackSet {
  return getSubmissionProfilePackSet(key);
}

