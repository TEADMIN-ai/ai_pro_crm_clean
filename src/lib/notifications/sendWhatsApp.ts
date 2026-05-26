export async function sendWhatsAppMessage(phone: string, message: string) {
  try {
    const res = await fetch("https://api.respond.io/v1/messages", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESPOND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phone,
        message,
      }),
    });

    const data = await res.json();

    console.log("WhatsApp sent:", data);
  } catch (err) {
    console.error("WhatsApp error:", err);
  }
}
