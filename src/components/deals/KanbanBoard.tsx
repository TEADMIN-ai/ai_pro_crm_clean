import { DealStage } from "@/types/deal";

// Update the Kanban board stages
const dealStages: DealStage[] = [
  "lead",
  "tender",  // Added tender stage
  "submitted", // Added submitted stage
  "proposal",
  "negotiation",
  "won",
  "lost",
];

// Now you can safely use dealStages for rendering or filtering deals