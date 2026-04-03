import { PDFDocument, StandardFonts } from "pdf-lib";

type SimpleDeal = {
  id?: string;
  title?: string;
  status?: string;
  contractorId?: string;
};

type SimpleContractor = {
  id?: string;
  name?: string;
  companyName?: string;
  email?: string;
  phone?: string;
  registrationNumber?: string;
};

function getString(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback;
}

export async function generateSimplePack(deal: SimpleDeal, contractor: SimpleContractor) {
  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([595, 842]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let y = 790;

  const drawLine = (label: string, value: string, isHeading = false) => {
    page.drawText(isHeading ? label : `${label}: ${value}`, {
      x: 50,
      y,
      size: isHeading ? 20 : 12,
      font: isHeading ? boldFont : font,
    });
    y -= isHeading ? 28 : 20;
  };

  drawLine("Torque Empire Tender Pack", "", true);
  y -= 8;

  drawLine("Deal", getString(deal.title, "Untitled Deal"));
  drawLine("Deal ID", getString(deal.id, "Unknown"));
  drawLine("Status", getString(deal.status, "Unknown"));
  drawLine("Contractor", getString(contractor.name, getString(contractor.companyName, "Unknown Contractor")));
  drawLine("Company", getString(contractor.companyName, getString(contractor.name, "Unknown Company")));
  drawLine("Contractor ID", getString(contractor.id, getString(deal.contractorId, "Unknown")));
  drawLine("Registration Number", getString(contractor.registrationNumber, "Not provided"));
  drawLine("Email", getString(contractor.email, "Not provided"));
  drawLine("Phone", getString(contractor.phone, "Not provided"));

  y -= 12;
  drawLine("Generated from live deal and contractor records", "", true);

  return pdfDoc.save();
}
