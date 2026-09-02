import crypto from "node:crypto";
import { Resend } from "resend";

import { getFirebaseAdmin } from "@/lib/firebase/admin";
import { getRoarCarsNotificationConfig } from "@/lib/vehicle-finance/config/notificationRecipients";
import type { VehicleFinanceApplication, VehicleFinanceCustomer } from "@/types/vehicleFinance";

export type VehicleFinanceApplicationNotificationActor = {
  actorId?: string;
  actorRole?: string;
  actorName?: string;
};

export type VehicleFinanceApplicationNotificationResult = {
  sent: boolean;
  skipped: boolean;
  skipReason: string | null;
  attempts: number;
  resendResponseId: string | null;
  recipients: string[];
  replyTo: string | null;
  subject: string;
  dashboardLink: string;
  error: string | null;
  queuedForRetry: boolean;
};

type NotificationCustomer = Pick<VehicleFinanceCustomer, "customerId" | "firstName" | "lastName" | "phone" | "email"> | null;

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function formatSubmissionTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleString("en-ZA", { dateStyle: "medium", timeStyle: "short" });
}

function buildCustomerName(customer: NotificationCustomer, application: VehicleFinanceApplication): string {
  const fullName = [customer?.firstName, customer?.lastName].filter(Boolean).join(" ").trim();
  return fullName || application.customerId || "Unavailable";
}

function buildDashboardLink(applicationId: string): string {
  const baseUrl = getRoarCarsNotificationConfig().dashboardBaseUrl.replace(/\/$/, "");
  return `${baseUrl}/dashboard/vehicle-finance/applications/${encodeURIComponent(applicationId)}`;
}

function buildSubject(): string {
  return "New Vehicle Finance Application";
}

function buildHtml(args: {
  application: VehicleFinanceApplication;
  customer: NotificationCustomer;
  dashboardLink: string;
  submissionTime: string;
}) {
  const customerName = escapeHtml(buildCustomerName(args.customer, args.application));
  const phoneNumber = escapeHtml(args.customer?.phone?.trim() || "Unavailable");
  const emailAddress = escapeHtml(args.customer?.email?.trim() || "Unavailable");
  const vehicle = escapeHtml(args.application.vehicleTitle?.trim() || args.application.vehicleId.trim() || "Unavailable");
  const applicationReference = escapeHtml(args.application.applicationId);
  const dealerName = escapeHtml(args.application.dealerName.trim());
  const submissionTime = escapeHtml(formatSubmissionTime(args.submissionTime));
  const dashboardLink = escapeHtml(args.dashboardLink);

  return (
    '<div style="margin:0;padding:0;background:#eef3f8;font-family:Arial,Helvetica,sans-serif;color:#0f172a;">' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#eef3f8;padding:24px 12px;">' +
    "<tr><td align=\"center\">" +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:720px;background:#ffffff;border:1px solid #d7e0e8;border-radius:10px;overflow:hidden;">' +
    '<tr><td style="background:#0f2747;padding:26px 32px;border-bottom:4px solid #1d7ff2;">' +
    '<div style="font-size:12px;font-weight:700;letter-spacing:1.8px;color:#9ec5ff;text-transform:uppercase;">Torque Empire TEOS</div>' +
    '<h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#ffffff;">New Vehicle Finance Application</h1>' +
    '<p style="margin:8px 0 0;font-size:14px;line-height:1.6;color:#d9e7f7;">Torque Empire Car Division finance notification</p>' +
    "</td></tr>" +
    '<tr><td style="padding:28px 32px;">' +
    '<p style="margin:0 0 18px;font-size:16px;line-height:1.7;color:#0f172a;">A new vehicle finance application has been submitted and stored successfully.</p>' +
    '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;font-size:14px;line-height:1.7;">' +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Applicant Name</td><td style="padding:8px 0;color:#0f172a;">${customerName}</td></tr>` +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Phone Number</td><td style="padding:8px 0;color:#0f172a;">${phoneNumber}</td></tr>` +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Email Address</td><td style="padding:8px 0;color:#0f172a;">${emailAddress}</td></tr>` +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Vehicle</td><td style="padding:8px 0;color:#0f172a;">${vehicle}</td></tr>` +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Application Reference</td><td style="padding:8px 0;color:#0f172a;">${applicationReference}</td></tr>` +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Submission Time</td><td style="padding:8px 0;color:#0f172a;">${submissionTime}</td></tr>` +
    `<tr><td style="padding:8px 0;width:38%;color:#334155;font-weight:700;">Dealer</td><td style="padding:8px 0;color:#0f172a;">${dealerName}</td></tr>` +
    "</table>" +
    '<div style="margin:24px 0 0;padding:18px 20px;background:#f7fbff;border:1px solid #d8e6f5;border-radius:8px;">' +
    '<p style="margin:0 0 10px;font-size:14px;font-weight:700;color:#0f172a;">Dashboard link</p>' +
    `<p style="margin:0;word-break:break-all;font-size:13px;line-height:1.6;color:#1d4ed8;"><a href="${dashboardLink}" style="color:#1d4ed8;text-decoration:none;">${dashboardLink}</a></p>` +
    "</div></td></tr>" +
    '<tr><td style="padding:18px 32px;background:#0f172a;color:#cbd5e1;font-size:12px;line-height:1.6;"><strong style="color:#ffffff;">Torque Empire TEOS (Pty) Ltd</strong><br />Vehicle finance notifications generated from the production workflow.</td></tr>' +
    "</table></td></tr></table></div>"
  );
}

function buildText(args: {
  application: VehicleFinanceApplication;
  customer: NotificationCustomer;
  dashboardLink: string;
  submissionTime: string;
}) {
  const customerName = buildCustomerName(args.customer, args.application);
  const phoneNumber = args.customer?.phone?.trim() || "Unavailable";
  const emailAddress = args.customer?.email?.trim() || "Unavailable";
  const vehicle = args.application.vehicleTitle?.trim() || args.application.vehicleId.trim() || "Unavailable";
  const dealerName = args.application.dealerName.trim();

  return [
    "New Vehicle Finance Application",
    "",
    `Applicant Name: ${customerName}`,
    `Phone Number: ${phoneNumber}`,
    `Email Address: ${emailAddress}`,
    `Vehicle: ${vehicle}`,
    `Application Reference: ${args.application.applicationId}`,
    `Submission Time: ${formatSubmissionTime(args.submissionTime)}`,
    `Dealer: ${dealerName}`,
    `Dashboard Link: ${args.dashboardLink}`,
  ].join("\n");
}

async function recordNotificationEvent(args: {
  application: VehicleFinanceApplication;
  actor?: VehicleFinanceApplicationNotificationActor;
  recipients: string[];
  replyTo: string | null;
  subject: string;
  dashboardLink: string;
  attempts: number;
  resendResponseId: string | null;
  status: "success" | "failure" | "warning";
  error?: string | null;
  queueId?: string | null;
}) {
  try {
    await getFirebaseAdmin().collection("vehicleFinanceApplicationEvents").add({
      operation: args.status === "success" ? "Email Sent" : "Email Failed",
      applicationId: args.application.applicationId,
      userId: args.actor?.actorId ?? null,
      actorRole: args.actor?.actorRole ?? null,
      actorName: args.actor?.actorName ?? null,
      targetId: args.application.applicationId,
      status: args.status,
      timestamp: new Date().toISOString(),
      exception: args.error ? { message: args.error, name: "NotificationError", stack: null } : null,
      metadata: {
        recipients: args.recipients,
        replyTo: args.replyTo,
        subject: args.subject,
        dashboardLink: args.dashboardLink,
        attempts: args.attempts,
        resendResponseId: args.resendResponseId,
        queueId: args.queueId ?? null,
        applicationReference: args.application.applicationId,
        customerId: args.application.customerId,
      },
    });
  } catch (error) {
    console.error("[vehicle-finance] notification event log failed", {
      applicationId: args.application.applicationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function recordNotificationAudit(args: {
  application: VehicleFinanceApplication;
  actor?: VehicleFinanceApplicationNotificationActor;
  recipients: string[];
  replyTo: string | null;
  subject: string;
  dashboardLink: string;
  attempts: number;
  resendResponseId: string | null;
  error?: string | null;
}) {
  try {
    await getFirebaseAdmin().collection("auditLogs").add({
      eventType: "VEHICLE_FINANCE_APPLICATION_NOTIFICATION",
      actorId: args.actor?.actorId ?? null,
      actorRole: args.actor?.actorRole ?? null,
      actorName: args.actor?.actorName ?? null,
      contractorId: null,
      customerId: args.application.customerId,
      applicationId: args.application.applicationId,
      targetId: args.application.applicationId,
      previousValue: null,
      newValue: {
        status: args.error ? "failed" : "sent",
        recipients: args.recipients,
        replyTo: args.replyTo,
        subject: args.subject,
        dashboardLink: args.dashboardLink,
        attempts: args.attempts,
        resendResponseId: args.resendResponseId,
        error: args.error ?? null,
      },
      timestamp: new Date(),
      metadata: {
        module: "vehicle-finance",
        deliveryType: "application-notification",
      },
    });
  } catch (error) {
    console.error("[vehicle-finance] notification audit log failed", {
      applicationId: args.application.applicationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function queueRetry(args: {
  application: VehicleFinanceApplication;
  customer: NotificationCustomer;
  recipients: string[];
  replyTo: string | null;
  subject: string;
  dashboardLink: string;
  attempts: number;
  error: string;
}) {
  const queueId = crypto.randomUUID();

  try {
    await getFirebaseAdmin().collection("vehicleFinanceNotificationQueue").doc(queueId).set({
      queueId,
      applicationId: args.application.applicationId,
      customerId: args.application.customerId,
      customerEmail: args.customer?.email?.trim() || null,
      recipients: args.recipients,
      replyTo: args.replyTo,
      subject: args.subject,
      dashboardLink: args.dashboardLink,
      attempts: args.attempts,
      status: "queued",
      error: args.error,
      nextAttemptAt: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[vehicle-finance] notification retry queue write failed", {
      applicationId: args.application.applicationId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return queueId;
}

async function sendWithRetry(args: {
  application: VehicleFinanceApplication;
  customer: NotificationCustomer;
  recipients: string[];
  replyTo: string | null;
  subject: string;
  dashboardLink: string;
  text: string;
  html: string;
}) {
  const resendKey = process.env.RESEND_API_KEY?.trim();
  const attempts = 3;
  const fromAddress = getRoarCarsNotificationConfig().resendFromAddress;
  let lastError: string | null = null;
  let resendResponseId: string | null = null;

  console.info("[vehicle-finance] application notification start", {
    applicationId: args.application.applicationId,
    customerId: args.application.customerId,
    recipients: args.recipients,
    replyTo: args.replyTo,
    dashboardLink: args.dashboardLink,
    hasResendKey: Boolean(resendKey),
  });

  if (!resendKey) {
    lastError = "RESEND_API_KEY is not configured";
  } else {
    const resend = new Resend(resendKey);

    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      try {
        console.info("[vehicle-finance] application notification attempt", {
          applicationId: args.application.applicationId,
          attempt,
          recipients: args.recipients,
        });

        const response = await resend.emails.send({
          from: fromAddress,
          to: args.recipients,
          subject: args.subject,
          html: args.html,
          text: args.text,
          replyTo: args.replyTo || undefined,
        });

        resendResponseId = response.data?.id ?? null;

        if (!response.error) {
          console.info("[vehicle-finance] application notification success", {
            applicationId: args.application.applicationId,
            resendResponseId,
            attempt,
            recipients: args.recipients,
          });
          return {
            sent: true,
            skipped: false,
            skipReason: null,
            attempts: attempt,
            resendResponseId,
            recipients: args.recipients,
            replyTo: args.replyTo,
            subject: args.subject,
            dashboardLink: args.dashboardLink,
            error: null,
            queuedForRetry: false,
          } satisfies VehicleFinanceApplicationNotificationResult;
        }

        lastError = response.error.message || response.error.name || "Resend email send failed";
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);
      }

      if (attempt < attempts) {
        await new Promise((resolve) => setTimeout(resolve, attempt * 400));
      }
    }
  }

  const queueId = await queueRetry({
    application: args.application,
    customer: args.customer,
    recipients: args.recipients,
    replyTo: args.replyTo,
    subject: args.subject,
    dashboardLink: args.dashboardLink,
    attempts,
    error: lastError || "Unknown notification failure",
  });

  await recordNotificationEvent({
    application: args.application,
    recipients: args.recipients,
    replyTo: args.replyTo,
    subject: args.subject,
    dashboardLink: args.dashboardLink,
    attempts,
    resendResponseId,
    status: "failure",
    error: lastError,
    queueId,
  });

  await recordNotificationAudit({
    application: args.application,
    recipients: args.recipients,
    replyTo: args.replyTo,
    subject: args.subject,
    dashboardLink: args.dashboardLink,
    attempts,
    resendResponseId,
    error: lastError,
  });

  console.error("[vehicle-finance] application notification failed", {
    applicationId: args.application.applicationId,
    customerId: args.application.customerId,
    recipients: args.recipients,
    replyTo: args.replyTo,
    attempts,
    resendResponseId,
    error: lastError,
    queueId,
  });

  return {
    sent: false,
    skipped: false,
    skipReason: null,
    attempts,
    resendResponseId,
    recipients: args.recipients,
    replyTo: args.replyTo,
    subject: args.subject,
    dashboardLink: args.dashboardLink,
    error: lastError,
    queuedForRetry: true,
  } satisfies VehicleFinanceApplicationNotificationResult;
}

export async function sendVehicleFinanceApplicationNotification(input: {
  application: VehicleFinanceApplication;
  actor?: VehicleFinanceApplicationNotificationActor;
}): Promise<VehicleFinanceApplicationNotificationResult> {
  const config = getRoarCarsNotificationConfig();
  const recipients = [...config.financeApplications];
  const subject = buildSubject();
  const dashboardLink = buildDashboardLink(input.application.applicationId);
  const submissionTime = input.application.createdAt || new Date().toISOString();

  if (!recipients.length) {
    const error = "No finance application recipients configured";
    await recordNotificationEvent({
      application: input.application,
      actor: input.actor,
      recipients,
      replyTo: null,
      subject,
      dashboardLink,
      attempts: 0,
      resendResponseId: null,
      status: "failure",
      error,
    });
    await recordNotificationAudit({
      application: input.application,
      actor: input.actor,
      recipients,
      replyTo: null,
      subject,
      dashboardLink,
      attempts: 0,
      resendResponseId: null,
      error,
    });
    return {
      sent: false,
      skipped: false,
      skipReason: null,
      attempts: 0,
      resendResponseId: null,
      recipients,
      replyTo: null,
      subject,
      dashboardLink,
      error,
      queuedForRetry: false,
    };
  }

  const customerSnapshot = await getFirebaseAdmin().collection("vehicleFinanceCustomers").doc(input.application.customerId).get();
  const customer: NotificationCustomer = customerSnapshot.exists
    ? {
        customerId: customerSnapshot.id,
        firstName: asString((customerSnapshot.data() ?? {}).firstName),
        lastName: asString((customerSnapshot.data() ?? {}).lastName),
        phone: asString((customerSnapshot.data() ?? {}).phone),
        email: asString((customerSnapshot.data() ?? {}).email),
      }
    : null;

  if (!customerSnapshot.exists) {
    console.warn("[vehicle-finance] application notification customer missing", {
      applicationId: input.application.applicationId,
      customerId: input.application.customerId,
    });
  }

  const replyTo = customer?.email || null;
  const html = buildHtml({ application: input.application, customer, dashboardLink, submissionTime });
  const text = buildText({ application: input.application, customer, dashboardLink, submissionTime });

  const result = await sendWithRetry({
    application: input.application,
    customer,
    recipients,
    replyTo,
    subject,
    dashboardLink,
    text,
    html,
  });

  if (result.sent) {
    await recordNotificationEvent({
      application: input.application,
      actor: input.actor,
      recipients,
      replyTo,
      subject,
      dashboardLink,
      attempts: result.attempts,
      resendResponseId: result.resendResponseId,
      status: "success",
    });
    await recordNotificationAudit({
      application: input.application,
      actor: input.actor,
      recipients,
      replyTo,
      subject,
      dashboardLink,
      attempts: result.attempts,
      resendResponseId: result.resendResponseId,
    });
  }

  return result;
}
