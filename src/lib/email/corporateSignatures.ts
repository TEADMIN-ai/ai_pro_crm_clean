import {
  getCorporateEmail,
  TORQUE_EMPIRE_COMPANY_PROFILE,
  type CorporateEmailKey,
} from "@/lib/corporate/companyProfile";

export type CorporateSignatureRole = "director" | "general" | "support" | "accounts" | "sales";

type SignatureProfile = {
  role: CorporateSignatureRole;
  label: string;
  title: string;
  emailKey: CorporateEmailKey;
};

const signatures: SignatureProfile[] = [
  { role: "director", label: "Director", title: "Director", emailKey: "director" },
  { role: "general", label: "General Enquiries", title: "General Enquiries", emailKey: "info" },
  { role: "support", label: "Support", title: "Support Desk", emailKey: "support" },
  { role: "accounts", label: "Accounts", title: "Accounts Department", emailKey: "accounts" },
  { role: "sales", label: "Sales", title: "Sales Department", emailKey: "sales" },
];

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getPublicLogoUrl(): string {
  const company = TORQUE_EMPIRE_COMPANY_PROFILE;
  return `${company.website}/corporate/logo/torque-empire-primary.png`;
}

function buildSignature(profile: SignatureProfile): string {
  const company = TORQUE_EMPIRE_COMPANY_PROFILE;
  const email = getCorporateEmail(profile.emailKey);
  const supportEmail = getCorporateEmail("support");
  const telephone = company.telephone;
  const telephoneHref = "tel:+27695024909";

  return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="620" style="width:100%;max-width:620px;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;font-family:Arial,Helvetica,sans-serif;color:#07111f;background:#ffffff;">
  <tr>
    <td width="136" valign="top" style="width:136px;padding:0 18px 0 0;vertical-align:top;">
      <a href="${escapeHtml(company.website)}" style="text-decoration:none;border:0;">
        <img src="${escapeHtml(getPublicLogoUrl())}" width="120" alt="${escapeHtml(company.tradingName)} corporate logo" style="display:block;width:120px;max-width:120px;height:auto;border:0;outline:none;text-decoration:none;-ms-interpolation-mode:bicubic;">
      </a>
    </td>
    <td valign="top" style="padding:0 0 0 18px;border-left:3px solid #0b2f57;vertical-align:top;">
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="width:100%;border-collapse:collapse;mso-table-lspace:0pt;mso-table-rspace:0pt;">
        <tr>
          <td style="padding:0;font-family:Arial,Helvetica,sans-serif;font-size:16px;line-height:22px;font-weight:700;color:#07111f;">${escapeHtml(company.companyName)}</td>
        </tr>
        <tr>
          <td style="padding:2px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:19px;font-weight:700;color:#0b2f57;">${escapeHtml(profile.title)}</td>
        </tr>
        <tr>
          <td style="padding:7px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#475569;">${escapeHtml(company.tagline)}</td>
        </tr>
        <tr>
          <td style="padding:10px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:13px;line-height:21px;color:#263445;">
            <a href="mailto:${escapeHtml(email)}" style="color:#0b2f57;text-decoration:none;">${escapeHtml(email)}</a><br>
            <a href="${escapeHtml(company.website)}" style="color:#0b2f57;text-decoration:none;">${escapeHtml(company.website)}</a><br>
            <span style="color:#475569;">Office:</span> <a href="${telephoneHref}" style="color:#0b2f57;text-decoration:none;">${escapeHtml(telephone)}</a>
          </td>
        </tr>
        <tr>
          <td style="padding:8px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:18px;color:#475569;">
            Support: <a href="mailto:${escapeHtml(supportEmail)}" style="color:#0b2f57;text-decoration:none;">${escapeHtml(supportEmail)}</a>
          </td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td colspan="2" style="padding:14px 0 0 0;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:15px;color:#64748b;">
      ${escapeHtml(`Confidentiality notice: ${company.disclaimer}`)}
    </td>
  </tr>
</table>`;
}

function buildTextSignature(profile: SignatureProfile): string {
  const company = TORQUE_EMPIRE_COMPANY_PROFILE;
  const email = getCorporateEmail(profile.emailKey);
  const supportEmail = getCorporateEmail("support");

  return [
    company.companyName,
    profile.title,
    company.tagline,
    "",
    `Email: ${email}`,
    `Website: ${company.website}`,
    `Office: ${company.telephone}`,
    `Support: ${supportEmail}`,
    "",
    `Confidentiality notice: ${company.disclaimer}`,
  ].join("\n");
}

export const TORQUE_EMPIRE_EMAIL_SIGNATURES = Object.fromEntries(
  signatures.map((signature) => [signature.role, buildSignature(signature)]),
) as Record<CorporateSignatureRole, string>;

export const TORQUE_EMPIRE_TEXT_SIGNATURES = Object.fromEntries(
  signatures.map((signature) => [signature.role, buildTextSignature(signature)]),
) as Record<CorporateSignatureRole, string>;

export const TORQUE_EMPIRE_EMAIL_SIGNATURE_SUMMARY = signatures.map((signature) => ({
  role: signature.role,
  label: signature.label,
  email: getCorporateEmail(signature.emailKey),
}));

export function getCorporateEmailSignature(role: CorporateSignatureRole): string {
  return TORQUE_EMPIRE_EMAIL_SIGNATURES[role];
}

export function getCorporateTextSignature(role: CorporateSignatureRole): string {
  return TORQUE_EMPIRE_TEXT_SIGNATURES[role];
}
