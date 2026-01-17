import { Timestamp } from 'firebase/firestore';

export type DealStage =
  | 'lead'
  | 'tender'
  | 'proposal'
  | 'negotiation'
  | 'won'
  | 'lost'
  | 'closed';

export interface Deal {
  id: string;
  title: string;
  clientName: string;
  description?: string;

  value?: number;
  currency?: string;

  stage: DealStage;

  ownerId: string;
  createdBy: string;

  isArchived: boolean;

  createdAt: Timestamp;
  updatedAt: Timestamp;
}
