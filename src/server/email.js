export function buildInvoiceEmail(sale) {
  return {
    to: sale.buyerEmail || "client@email.com",
    subject: `Invoice for ${sale.vehicle}`,
    body: `
Hello ${sale.buyer},

Please find your invoice attached.

Vehicle: ${sale.vehicle}
Price: $${sale.price}

Regards,
Torque Empire
`
  };
}

export function buildTenderEmail(tender) {
  return {
    to: tender.clientEmail || "client@email.com",
    subject: `Tender: ${tender.title}`,
    body: `
Hello,

Attached is the tender document.

Tender: ${tender.title}
Value: $${tender.value}

Regards,
Torque Empire
`
  };
}
