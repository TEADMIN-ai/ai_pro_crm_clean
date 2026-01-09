import { createDealFromBot } from "./carSalesBot";

export type BotStep =
  | "ask_name"
  | "ask_contact"
  | "ask_vehicle"
  | "ask_budget"
  | "ask_finance"
  | "ask_timeframe"
  | "complete";

export type BotSession = {
  step: BotStep;
  data: {
    name?: string;
    email?: string;
    phone?: string;
    make?: string;
    model?: string;
    budgetMin?: number;
    budgetMax?: number;
    financeRequired?: boolean;
    timeframe?: "immediate" | "30_days" | "60_days" | "unsure";
  };
};

export function getBotPrompt(step: BotStep): string {
  switch (step) {
    case "ask_name":
      return "Hi 👋 What is your full name?";
    case "ask_contact":
      return "How can we contact you? (email or phone)";
    case "ask_vehicle":
      return "Which vehicle are you interested in? (make & model)";
    case "ask_budget":
      return "Do you have a budget range in mind?";
    case "ask_finance":
      return "Will you require finance? (yes / no)";
    case "ask_timeframe":
      return "When are you looking to buy?";
    default:
      return "Thank you! One moment while I create your enquiry.";
  }
}

export function handleBotResponse(
  session: BotSession,
  userInput: string
): BotSession {
  const input = userInput.trim();

  switch (session.step) {
    case "ask_name":
      return {
        step: "ask_contact",
        data: { ...session.data, name: input },
      };

    case "ask_contact":
      return {
        step: "ask_vehicle",
        data: {
          ...session.data,
          email: input.includes("@") ? input : undefined,
          phone: !input.includes("@") ? input : undefined,
        },
      };

    case "ask_vehicle": {
      const parts = input.split(" ");
      return {
        step: "ask_budget",
        data: {
          ...session.data,
          make: parts[0],
          model: parts.slice(1).join(" "),
        },
      };
    }

    case "ask_budget": {
      const numbers = input.match(/\d+/g);
      return {
        step: "ask_finance",
        data: {
          ...session.data,
          budgetMin: numbers ? Number(numbers[0]) : undefined,
          budgetMax: numbers && numbers[1] ? Number(numbers[1]) : undefined,
        },
      };
    }

    case "ask_finance":
      return {
        step: "ask_timeframe",
        data: {
          ...session.data,
          financeRequired: input.toLowerCase().startsWith("y"),
        },
      };

    case "ask_timeframe":
      return {
        step: "complete",
        data: {
          ...session.data,
          timeframe:
            input.includes("30")
              ? "30_days"
              : input.includes("60")
              ? "60_days"
              : input.includes("now")
              ? "immediate"
              : "unsure",
        },
      };

    default:
      return session;
  }
}

export async function finalizeBotSession(
  session: BotSession,
  companyId: string
) {
  if (!session.data.name) {
    throw new Error("Incomplete bot session");
  }

  return createDealFromBot(
    {
      name: session.data.name,
      email: session.data.email,
      phone: session.data.phone,
      make: session.data.make,
      model: session.data.model,
      budgetMin: session.data.budgetMin,
      budgetMax: session.data.budgetMax,
      financeRequired: !!session.data.financeRequired,
      timeframe: session.data.timeframe,
    },
    companyId
  );
}