import { getCorporateEmail } from "@/lib/corporate/companyProfile";

export function buildInvoiceEmail(sale) {
  return {
    to: sale.buyerEmail || getCorporateEmail("info"),
    subject: `Invoice for ${sale.vehicle}`,
    body: `
Hello ${sale.buyer},

Please find your invoice attached.

Vehicle: ${sale.vehicle}
Price: $${sale.price}

Regards,
Torque Empire TEOS
`
  };
}

export function buildTenderEmail(tender) {
  return {
    to: tender.clientEmail || getCorporateEmail("info"),
    subject: `Tender: ${tender.title}`,
    body: `
Hello,

Attached is the tender document.

Tender: ${tender.title}
Value: $${tender.value}

Regards,
Torque Empire TEOS
`
  };
}
