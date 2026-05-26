import fs from "fs";
import path from "path";
import { bootstrapWorkflow } from "../src/lib/manus/executors/workflowBootstrap";
import { RecoveryExecutor } from "../src/lib/manus/executors/recoveryExecutor";
import { RetryExecutor } from "../src/lib/manus/executors/retryExecutor";
import { WorkflowExecutor } from "../src/lib/manus/executors/workflowExecutor";
import { getManusFeatureFlags } from "../src/lib/manus/config/featureFlags";
import { ContextManager } from "../src/lib/manus/context/contextManager";
import { FirestoreTool } from "../src/lib/manus/tools/firestoreTool";
import { EmailTool } from "../src/lib/manus/tools/emailTool";
import { assertContractorIsolation, assertToolAccess } from "../src/lib/manus/utils/permissionGuard";
import { runWithTimeoutGuard, TimeoutGuardError } from "../src/lib/manus/utils/timeoutGuard";
import { createComplianceWorkflow } from "../src/lib/manus/workflows/complianceWorkflow";
import { createOnboardingWorkflow } from "../src/lib/manus/workflows/onboardingWorkflow";

function assert(condition: unknown, message: string) {
  if (!condition) {
    throw new Error(message);
  }
}

function enableFlags() {
  process.env.ENABLE_MANUS_WORKFLOWS = "true";
  process.env.ENABLE_MANUS_TENDER_FLOW = "true";
  process.env.ENABLE_MANUS_MEMORY = "false";
  process.env.ENABLE_MANUS_NOTIFICATIONS = "true";
  process.env.ENABLE_MANUS_AUTO_ACTIONS = "false";
}

function verifyFeatureFlagIntegrity() {
  const flags = getManusFeatureFlags();
  assert(flags.ENABLE_MANUS_WORKFLOWS === true, "Workflows flag should be enabled for sanity");
  assert(flags.ENABLE_MANUS_TENDER_FLOW === true, "Tender flag should be enabled for sanity");
  assert(flags.ENABLE_MANUS_AUTO_ACTIONS === false, "Auto actions must remain disabled");
}

async function verifyWorkflowExecution() {
  const executor = new WorkflowExecutor();
  const context = {
    requestId: "req-1",
    workflowId: "wf-1",
    workflowType: "compliance" as const,
    actor: { uid: "staff-1", role: "staff" as const, email: "staff@example.com" },
    contractorId: "contractor-1",
    metadata: {},
    dryRun: true,
  };
  const workflow = createComplianceWorkflow(["taxClearance", "bbbee"]);
  const result = await executor.execute(workflow, context);
  assert(result.workflowType === "compliance", "Compliance workflow should execute with compliance type");
  assert(result.steps.length === 2, "Compliance workflow should expose two steps");
}

function verifyAgentChainingAndWorkflowDefinitions() {
  const compliance = createComplianceWorkflow(["taxClearance"]);
  const onboarding = createOnboardingWorkflow();
  assert(compliance.steps.length > 0, "Compliance workflow should have steps");
  assert(onboarding.steps.length > 0, "Onboarding workflow should have steps");
}

async function verifyToolExecution() {
  const emailTool = new EmailTool();
  const result = await emailTool.execute(
    { subject: "Test", summary: "Draft only" },
    {
      requestId: "req-2",
      workflowId: "wf-2",
      workflowType: "compliance",
      actor: { uid: "staff-1", role: "staff" },
      metadata: {},
      dryRun: true,
    }
  );
  assert(result.ok, "Email draft tool should succeed");
}

function verifyContractorIsolationAndRoleValidation() {
  assertToolAccess(
    {
      requestId: "req-3",
      workflowId: "wf-3",
      workflowType: "compliance",
      actor: { uid: "staff-1", role: "staff" },
      metadata: {},
    },
    "firestoreTool"
  );

  let blocked = false;
  try {
    assertContractorIsolation(
      {
        requestId: "req-4",
        workflowId: "wf-4",
        workflowType: "compliance",
        actor: { uid: "contractor-user", role: "contractor", contractorId: "c-1" },
        contractorId: "c-1",
        metadata: {},
      },
      "c-2"
    );
  } catch {
    blocked = true;
  }

  assert(blocked, "Contractor isolation should block cross-contractor access");
}

function verifyFirestoreSafety() {
  const tool = new FirestoreTool();
  let blocked = false;
  try {
    tool.validate(
      { mode: "read", collection: "users", docId: "unsafe" },
      {
        requestId: "req-5",
        workflowId: "wf-5",
        workflowType: "compliance",
        actor: { uid: "staff-1", role: "staff" },
        metadata: {},
      }
    );
  } catch {
    blocked = true;
  }

  assert(blocked, "Firestore tool should reject non-whitelisted collections");
}

async function verifyRetryHandling() {
  const executor = new RetryExecutor();
  let attempts = 0;
  const result = await executor.execute({
    run: async () => {
      attempts += 1;
      if (attempts < 2) {
        throw new Error("service unavailable");
      }
      return "ok";
    },
  });

  assert(result.value === "ok", "Retry executor should eventually succeed");
  assert(result.retriesUsed === 1, "Retry executor should record one retry");
}

async function verifyTimeoutHandling() {
  let timedOut = false;
  try {
    await runWithTimeoutGuard(
      async () =>
        await new Promise((resolve) => {
          setTimeout(resolve, 50);
        }),
      10
    );
  } catch (error) {
    timedOut = error instanceof TimeoutGuardError;
  }

  assert(timedOut, "Timeout guard should throw TimeoutGuardError");
}

function verifyContextSafety() {
  const manager = new ContextManager();
  const sanitized = manager.sanitizeAgentOutput({
    prompt: "secret prompt",
    content: "sensitive document text",
    score: 99,
  });
  assert(sanitized.prompt === "[redacted]", "Prompt must be redacted");
  assert(sanitized.content === "[redacted]", "Content must be redacted");
}

async function verifyRecoveryExecution() {
  const recovery = new RecoveryExecutor();
  const summary = await recovery.handleStepFailure({
    context: {
      requestId: "req-6",
      workflowId: "wf-6",
      workflowType: "compliance",
      actor: { uid: "staff-1", role: "staff" },
      metadata: {},
      dryRun: true,
    },
    state: {
      status: "running",
      steps: [],
      shared: {},
      errors: [],
      retryCount: 0,
      history: [],
    },
    stepId: "notification-agent",
    continueOnError: true,
    error: "draft failure",
    rollbacks: [],
  });

  assert(summary.continued === true, "Recovery should allow continuation when configured");
}

function verifyBootstrapValidation() {
  const result = bootstrapWorkflow({
    actor: { uid: "staff-1", role: "staff" },
    workflowType: "tender",
    contractorId: "contractor-1",
    payload: { contractorId: "contractor-1" },
    dryRun: true,
  });

  assert(result.ok === true, "Bootstrap should pass with flags enabled and valid actor");
}

function verifyApiRoutesExist() {
  const files = [
    "src/app/api/manus/workflow/route.ts",
    "src/app/api/manus/tender/route.ts",
    "src/app/api/manus/status/route.ts",
    "src/app/api/manus/admin/health/route.ts",
  ];

  for (const file of files) {
    assert(fs.existsSync(path.join(process.cwd(), file)), `Missing API route: ${file}`);
  }
}

async function main() {
  enableFlags();
  verifyFeatureFlagIntegrity();
  verifyBootstrapValidation();
  await verifyWorkflowExecution();
  verifyAgentChainingAndWorkflowDefinitions();
  await verifyToolExecution();
  verifyContractorIsolationAndRoleValidation();
  verifyFirestoreSafety();
  await verifyRetryHandling();
  await verifyTimeoutHandling();
  verifyContextSafety();
  await verifyRecoveryExecution();
  verifyApiRoutesExist();
  console.log("manusSanityCheck PASS");
}

main().catch((error) => {
  console.error("manusSanityCheck failed", error);
  process.exit(1);
});
