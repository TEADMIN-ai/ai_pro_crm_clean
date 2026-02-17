// src/lib/deals/types.ts

import { DealStatus } from "./status";

export type Deal = {
  id: string;
  title: string;
  reference?: string;
  client?: string;
  status: DealStatus;
  value?: number;
  createdAt?: any;
};

