"use client";

import { useState } from "react";
import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

type Step =
  | "name"
  | "contact"
  | "vehicle"
  | "budget"
  | "finance"
  | "timeline"
  | "done";

export default function CarSalesAssistantPage() {
  const [messages, setMessages] = useState<
    { role: "bot" | "user"; text: string }[]
  >([{ role: "bot", text: "Hi 👋 What is your full name?" }]);

  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("name");
  const [loading, setLoading] = useState(false);

  const [lead, setLead] = useState({
    name: "",
    contactMethod: "",
    vehicle: "",
    budget: "",
    finance: "",
    timeline: "",
  });

  const send = async () => {
    if (!input.trim() || loading) return;

    const userText = input.trim();
    setMessages((m) => [...m, { role: "user", text: userText }]);
    setInput("");

    switch (step) {
      case "name":
        setLead((l) => ({ ...l, name: userText }));
        setMessages((m) => [
          ...m,
          { role: "bot", text: "How can we contact you? (email or phone)" },
        ]);
        setStep("contact");
        break;

      case "contact":
        setLead((l) => ({ ...l, contactMethod: userText }));
        setMessages((m) => [
          ...m,
          {
            role: "bot",
            text: "Which vehicle are you interested in? (make & model)",
          },
        ]);
        setStep("vehicle");
        break;

      case "vehicle":
        setLead((l) => ({ ...l, vehicle: userText }));
        setMessages((m) => [
          ...m,
          { role: "bot", text: "Do you have a budget range in mind?" },
        ]);
        setStep("budget");
        break;

      case "budget":
        setLead((l) => ({ ...l, budget: userText }));
        setMessages((m) => [
          ...m,
          { role: "bot", text: "Will you require finance? (yes / no)" },
        ]);
        setStep("finance");
        break;

      case "finance":
        setLead((l) => ({ ...l, finance: userText }));
        setMessages((m) => [
          ...m,
          { role: "bot", text: "When are you looking to buy?" },
        ]);
        setStep("timeline");
        break;

      case "timeline":
        setLead((l) => ({ ...l, timeline: userText }));
        setMessages((m) => [
          ...m,
          { role: "bot", text: "Creating your enquiry…" },
        ]);
        setLoading(true);

        try {
          await addDoc(collection(db, "deals"), {
            title: `${lead.vehicle} enquiry`,
            status: "new",
            assignedTo: null,
            companyId: "torque-empire",

            // 🔹 CRM-required fields
            sla: null,
            source: "car_sales_bot",

            // 🔹 Lead details
            customerName: lead.name,
            contactMethod: lead.contactMethod,
            vehicle: lead.vehicle,
            budget: lead.budget,
            financeRequired: lead.finance,
            purchaseTimeline: lead.timeline,

            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });

          setMessages((m) => [
            ...m,
            {
              role: "bot",
              text:
                "✅ Your enquiry has been submitted. A sales consultant will contact you shortly.",
            },
          ]);
          setStep("done");
        } catch (err) {
          console.error("❌ Deal creation failed:", err);
          setMessages((m) => [
            ...m,
            {
              role: "bot",
              text:
                "❌ Something went wrong while creating your enquiry. Please try again later.",
            },
          ]);
        } finally {
          setLoading(false);
        }
        break;
    }
  };

  return (
    <main style={{ padding: 32, maxWidth: 600, margin: "0 auto" }}>
      <h1>Car Sales Assistant</h1>

      <div
        style={{
          border: "1px solid #ddd",
          padding: 16,
          minHeight: 300,
          marginBottom: 12,
          overflowY: "auto",
        }}
      >
        {messages.map((m, i) => (
          <div key={i} style={{ marginBottom: 8 }}>
            <strong>{m.role === "bot" ? "Bot" : "You"}:</strong> {m.text}
          </div>
        ))}
      </div>

      {step !== "done" && (
        <div>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send()}
            placeholder="Type your reply…"
            style={{ width: "80%", padding: 8 }}
          />
          <button onClick={send} style={{ padding: 8, marginLeft: 8 }}>
            Send
          </button>
        </div>
      )}
    </main>
  );
}