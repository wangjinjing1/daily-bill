export type User = {
  id: number;
  username: string;
  role: "SUPER_ADMIN" | "USER";
  status?: "ENABLED" | "DISABLED";
};

export type BillType = {
  id: number;
  userId: number;
  name: string;
  sortOrder: number;
  enabled: boolean;
};

export type BillEntry = {
  id: number;
  userId: number;
  billTypeId: number;
  occurredOn: string;
  amount: string;
  note: string | null;
  billType?: BillType;
};

