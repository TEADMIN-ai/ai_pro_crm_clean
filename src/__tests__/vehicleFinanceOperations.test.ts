import { buildVehicleFinanceDocumentChecklist, buildVehicleFinanceOperationalSummary, searchVehicleFinanceApplications } from "@/lib/vehicle-finance/operations/vehicleFinanceOperations";
import type { VehicleFinanceApplication, VehicleFinanceDocument } from "@/types/vehicleFinance";

describe("vehicle finance operations", () => {
  const application: VehicleFinanceApplication = {
    applicationId: "app-001",
    customerId: "cust-001",
    vehicleId: "veh-001",
    dealerName: "Roar Cars SA",
    dealValue: 450000,
    applicationStatus: "NEW",
    fraudScore: 0,
    verificationStatus: "PENDING",
    createdAt: "2026-07-05T08:00:00.000Z",
    updatedAt: "2026-07-05T09:00:00.000Z",
    workflowStageId: "consultant-assignment",
    workflowStageLabel: "Consultant Assignment",
    workflowProgressPercentage: 6,
    workflowNextRequiredAction: "Assign Consultant",
    workflowSnapshot: {
      assignedConsultantName: "Alex Taylor",
      nextRequiredAction: "Assign Consultant",
      stageLabel: "Consultant Assignment",
      status: "active",
    },
  } as VehicleFinanceApplication;

  const documents: VehicleFinanceDocument[] = [
    {
      documentId: "doc-1",
      applicationId: "app-001",
      documentType: "saIdDocument",
      filePath: "/tmp/doc-1.pdf",
      fileName: "id.pdf",
      extractedText: "South African ID",
      aiAnalysis: { documentIntegrityScore: 92, verificationStatus: "VERIFIED" },
      uploadedAt: "2026-07-05T08:10:00.000Z",
      directTextLength: 16,
      ocrTextLength: 0,
      extractedTextLength: 16,
      pageCount: 1,
      extractionSource: "PDF_TEXT",
    },
    {
      documentId: "doc-2",
      applicationId: "app-001",
      documentType: "driversLicense",
      filePath: "/tmp/doc-2.pdf",
      fileName: "license.pdf",
      extractedText: "Driver license",
      aiAnalysis: { documentIntegrityScore: 45, verificationStatus: "REVIEW" },
      uploadedAt: "2026-07-05T08:12:00.000Z",
      directTextLength: 14,
      ocrTextLength: 0,
      extractedTextLength: 14,
      pageCount: 1,
      extractionSource: "PDF_TEXT",
    },
  ];

  test("builds a document checklist with received and verified states", () => {
    const checklist = buildVehicleFinanceDocumentChecklist(documents);

    expect(checklist.receivedCount).toBe(2);
    expect(checklist.verifiedCount).toBe(1);
    expect(checklist.outstandingCount).toBeGreaterThan(0);
    expect(checklist.completionPercentage).toBeGreaterThan(0);
  });

  test("searches applications using customer and workflow fields", () => {
    const results = searchVehicleFinanceApplications({
      query: "alex",
      applications: [application],
      customers: [{ customerId: "cust-001", firstName: "Alex", lastName: "Taylor", phone: "0820000000", email: "alex@example.com" }],
      documents,
    });

    expect(results).toHaveLength(1);
    expect(results[0].applicationId).toBe("app-001");
  });

  test("summarizes the operational state of the application", () => {
    const summary = buildVehicleFinanceOperationalSummary({
      application,
      documents,
      tasks: [
        {
          taskId: "task-1",
          applicationId: "app-001",
          stageId: "consultant-assignment",
          title: "Assign Consultant",
          description: "Assign the consultant",
          assignedUser: null,
          assignedUserName: null,
          priority: "NORMAL",
          dueDate: "2026-07-05T12:00:00.000Z",
          status: "open",
          escalationRule: "",
          reminderRule: "",
          completionDate: null,
          auditTrail: [],
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z",
        },
      ],
      notifications: [
        {
          notificationId: "note-1",
          applicationId: "app-001",
          title: "New Application",
          message: "New application received",
          channel: "dashboard",
          audience: ["finance"],
          unread: true,
          priority: "HIGH",
          createdAt: "2026-07-05T08:00:00.000Z",
          updatedAt: "2026-07-05T08:00:00.000Z",
          readAt: null,
          actorId: null,
          actorName: null,
          actorRole: null,
          metadata: {},
        },
      ],
    });

    expect(summary.assignment.assignedConsultantName).toBe("Alex Taylor");
    expect(summary.checklist.receivedCount).toBe(2);
    expect(summary.tasks.totalCount).toBe(1);
    expect(summary.unreadNotifications).toBe(1);
  });
});
