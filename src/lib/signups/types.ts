export type DispensaryStatus = "pending" | "approved" | "rejected";

export type DispensaryRecord = {
  id: string;
  dispensaryName: string;
  address: string;
  contactName: string;
  phone: string;
  ocmLicense: string;
  email: string;
  passwordHash: string;
  passwordSalt: string;
  age21AckAt: string;
  status: DispensaryStatus;
  createdAt: string;
  updatedAt: string;
  lastActiveAt?: string;
  closedAt?: string | null;
};

export type OrderLineRecord = {
  skuId: string;
  format: string;
  qty: number;
};

export type OrderRequestRecord = {
  id: string;
  dispensaryAccountId: string;
  lines: OrderLineRecord[];
  promisedOn: string;
  notes: string;
  createdAt: string;
};

export type HausUpdateRecord = {
  email: string;
  consentAt: string;
  source: string;
  confirmedAt: string | null;
};

export type HausSignupRecord = {
  id: string;
  email: string;
  age21Ack: boolean;
  age21AckAt: string;
  requestedDispensary: string;
  createdAt: string;
};

export type SignupLedger = {
  dispensaries: Array<{
    id: string;
    dispensaryName: string;
    email: string;
    ocmLicense: string;
    status: DispensaryStatus;
    createdAt: string;
  }>;
  orders: Array<{
    id: string;
    dispensaryAccountId: string;
    promisedOn: string;
    lineCount: number;
    createdAt: string;
  }>;
  haus: Array<{
    id: string;
    email: string;
    age21Ack: boolean;
    age21AckAt: string;
    requestedDispensary: string;
  }>;
  updates: HausUpdateRecord[];
  source: "memory" | "supabase";
  unavailable?: boolean;
  updatesUnavailable?: boolean;
};

export type HausSessionView = {
  email: string;
  signup: HausSignupRecord | null;
};
