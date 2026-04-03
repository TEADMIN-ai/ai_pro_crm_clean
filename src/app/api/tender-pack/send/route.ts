import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";

console.log("RESEND KEY:", process.env.RESEND_API_KEY);

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(req: NextRequest) {
  try {
    const { email, pdfBase64 } = await req.json();

    if (!email || !pdfBase64) {
      return NextResponse.json(
        { error: "Missing email or PDF" },
        { status: 400 }
      );
    }

    const response = await resend.emails.send({
      from: "Torque Empire <admin@torqueempire.net>",
      to: [email],
      subject: "Your Tender Pack – Torque Empire",
      html: `<p>Your tender pack is attached.</p>`,
      attachments: [
        {
          filename: "tender-pack.pdf",
          content: pdfBase64,
        },
      ],
    });

    console.log("RESEND RESPONSE:", response);

    return NextResponse.json({
      success: true,
      response,
    });
  } catch (error) {
    console.error("RESEND ERROR:", error);

    return NextResponse.json(
      { error: "Failed to send email" },
      { status: 500 }
    );
  }
}