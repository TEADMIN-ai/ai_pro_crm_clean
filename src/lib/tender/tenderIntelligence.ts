// src/lib/tender/tenderIntelligence.ts

export type TenderRequirement = {
  id: string;
  label: string;
  mandatory: boolean;
};

export type TenderDocument = {
  id: string;
  name: string;
};

export type TenderInput = {
  tenderId: string;
  requirements: TenderRequirement[];
  uploadedDocuments: TenderDocument[];
};

