import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function POST(req: Request) {
  try {
    const { email, pdfBase64 } = (await req.json()) as {
      email?: string;
      pdfBase64?: string;
    };

    if (!email || !pdfBase64) {
      return NextResponse.json({ error: "Missing data" }, { status: 400 });
    }

    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
      },
    });

    await transporter
      .verify()
      .then(() => console.log("SMTP READY"))
      .catch((err) => console.error("SMTP ERROR:", err));

    const info = await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your Tender Pack  Torque Empire",
      text: "Attached is your generated tender pack.",
      attachments: [
        {
          filename: "tender-pack.pdf",
          content: Buffer.from(pdfBase64, "base64"),
        },
      ],
    });

    console.log("EMAIL RESPONSE:", {
      accepted: info.accepted,
      rejected: info.rejected,
      response: info.response,
      messageId: info.messageId,
    });

    return NextResponse.json({
      success: true,
      debug: {
        accepted: info.accepted,
        rejected: info.rejected,
        response: info.response,
      },
    });
  } catch (err) {
    console.error(err);
    return NextResponse.json({ error: "Email failed" }, { status: 500 });
  }
}
