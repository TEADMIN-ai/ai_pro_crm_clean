export type SBD1BbeeStatus = "YES" | "NO";

export type SBD1OverlayFieldName =
  | "companyName"
  | "companyAddressLine1"
  | "companyAddressLine2"
  | "contactNumberCode"
  | "contactNumberValue"
  | "email"
  | "vatNumber"
  | "bbbee"
  | "date";

export interface SBD1OverlayInput {
  companyName?: string | null;
  companyAddressLine1?: string | null;
  companyAddressLine2?: string | null;
  contactNumber?: string | null;
  email?: string | null;
  vatNumber?: string | null;
  bbbee?: string | null;
  generatedAt?: Date;
}

export interface SBD1ValidatedOverlayInput {
  companyName?: string;
  companyAddressLine1?: string;
  companyAddressLine2?: string;
  contactNumber?: string;
  email?: string;
  vatNumber?: string;
  bbbee?: string;
  generatedAt?: Date;
}

export interface SBD1OverlayTextInstruction {
  field: SBD1OverlayFieldName;
  text: string;
  x: number;
  y: number;
  size: number;
  maxWidth?: number;
  pageIndex?: number;
  mask?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SBD1OverlayMarkInstruction {
  field: Extract<SBD1OverlayFieldName, "bbbee">;
  mark: string;
  x: number;
  y: number;
  size: number;
  pageIndex?: number;
}

export interface SBD1OverlayFieldPlacement {
  x: number;
  y: number;
  maxWidth?: number;
  pageIndex?: number;
  mask?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface SBD1OverlayPlan {
  textInstructions: SBD1OverlayTextInstruction[];
  checkboxInstruction: SBD1OverlayMarkInstruction;
  dateInstruction: SBD1OverlayTextInstruction;
}

export interface SBD1OverlayDefaults {
  companyName: string;
  companyAddressLine1: string;
  companyAddressLine2: string;
  contactNumber: string;
  email: string;
  vatNumber: string;
}

export interface SBD1OverlayValidationResult {
  isValid: boolean;
  issues: string[];
  value: SBD1ValidatedOverlayInput;
}
