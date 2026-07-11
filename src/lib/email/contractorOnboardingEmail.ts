import { Resend } from "resend";
import { getCorporateFromAddress } from "@/lib/corporate/companyProfile";

type SendContractorOnboardingEmailInput = {
  contractorId: string;
  email: string;
  contactPerson: string;
  companyName: string;
  onboardingLink: string;
};

export type ContractorOnboardingEmailResult = {
  emailSent: boolean;
  resendResponseId: string | null;
  error: string | null;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getResendFromAddress(): string {
  return process.env.RESEND_FROM_EMAIL || getCorporateFromAddress("support");
}

function buildOnboardingHtml(input: SendContractorOnboardingEmailInput): string {
  const contactPerson = escapeHtml(input.contactPerson);
  const companyName = escapeHtml(input.companyName);
  const onboardingLink = escapeHtml(input.onboardingLink);

  return `
    <div style="margin:0;padding:0;background:#f4f6f8;font-family:Arial,Helvetica,sans-serif;color:#111827;">
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:#f4f6f8;padding:28px 12px;">
        <tr>
          <td align="center">
            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:640px;background:#ffffff;border:1px solid #dbe3ea;">
              <tr>
                <td style="background:#0f172a;padding:28px 32px;border-left:8px solid #d89a18;">
                  <div style="font-size:13px;font-weight:700;letter-spacing:1.6px;color:#f5b335;text-transform:uppercase;">Torque Empire TEOS</div>
                  <h1 style="margin:10px 0 0;font-size:26px;line-height:1.25;color:#ffffff;">Contractor Onboarding</h1>
                </td>
              </tr>
              <tr>
                <td style="padding:30px 32px;">
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">Dear ${contactPerson},</p>
                  <p style="margin:0 0 16px;font-size:16px;line-height:1.6;">
                    Welcome to Torque Empire TEOS. Your contractor profile for <strong>${companyName}</strong> has been created.
                  </p>
                  <p style="margin:0 0 22px;font-size:16px;line-height:1.6;">
                    Use the secure onboarding link below to create your password and access the contractor portal.
                    Once signed in, upload your compliance documents so your profile can be reviewed for tender readiness.
                  </p>
                  <p style="margin:0 0 26px;">
                    <a href="${onboardingLink}" style="display:inline-block;background:#0f7a3a;color:#ffffff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:6px;">
                      Create Password & Start Onboarding
                    </a>
                  </p>
                  <div style="background:#f8fafc;border:1px solid #dbe3ea;padding:16px 18px;margin:0 0 22px;">
                    <p style="margin:0 0 8px;font-size:14px;font-weight:700;color:#0f172a;">Next steps</p>
                    <ol style="margin:0;padding-left:20px;font-size:14px;line-height:1.7;color:#334155;">
                      <li>Create your secure password.</li>
                      <li>Log in to the contractor portal.</li>
                      <li>Upload CIPC, B-BBEE, tax clearance, COIDA, and bank confirmation documents.</li>
                      <li>Monitor your readiness status before tender submission.</li>
                    </ol>
                  </div>
                  <p style="margin:0 0 10px;font-size:13px;line-height:1.6;color:#475569;">
                    If the button does not open, copy and paste this secure link into your browser:
                  </p>
                  <p style="margin:0;word-break:break-all;font-size:12px;line-height:1.6;color:#0f766e;">${onboardingLink}</p>
                </td>
              </tr>
              <tr>
                <td style="padding:20px 32px;background:#0f172a;color:#cbd5e1;font-size:12px;line-height:1.6;">
                  <strong style="color:#ffffff;">Torque Empire TEOS PTY LTD</strong><br />
                  Four Divisions. One Vision. Total Excellence.
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </div>
  `;
}

export async function sendContractorOnboardingEmail(
  input: SendContractorOnboardingEmailInput,
): Promise<ContractorOnboardingEmailResult> {
  const resendKey = process.env.RESEND_API_KEY;

  console.info("EMAIL_SEND_START", {
    contractorUid: input.contractorId,
    recipientEmail: input.email,
  });

  if (!resendKey) {
    const error = "RESEND_API_KEY is not configured";
    console.error("EMAIL_SEND_FAILURE", {
      contractorUid: input.contractorId,
      recipientEmail: input.email,
      resendResponseId: null,
      error,
    });
    return {
      emailSent: false,
      resendResponseId: null,
      error,
    };
  }

  try {
    const resend = new Resend(resendKey);
    const response = await resend.emails.send({
      from: getResendFromAddress(),
      to: [input.email],
      subject: `Welcome to Torque Empire TEOS, ${input.companyName}`,
      html: buildOnboardingHtml(input),
    });

    const responseId = response.data?.id ?? null;

    if (response.error) {
      const error = response.error.message || response.error.name || "Resend email send failed";
      console.error("EMAIL_SEND_FAILURE", {
        contractorUid: input.contractorId,
        recipientEmail: input.email,
        resendResponseId: responseId,
        error,
      });
      return {
        emailSent: false,
        resendResponseId: responseId,
        error,
      };
    }

    console.info("EMAIL_SEND_SUCCESS", {
      contractorUid: input.contractorId,
      recipientEmail: input.email,
      resendResponseId: responseId,
    });

    return {
      emailSent: true,
      resendResponseId: responseId,
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown Resend email error";
    console.error("EMAIL_SEND_FAILURE", {
      contractorUid: input.contractorId,
      recipientEmail: input.email,
      resendResponseId: null,
      error: message,
    });

    return {
      emailSent: false,
      resendResponseId: null,
      error: message,
    };
  }
}
