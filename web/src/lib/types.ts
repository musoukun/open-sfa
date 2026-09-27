import type { ContractType, DealStatus } from "@server/deals/rules";
import type { QuoteStatus } from "@server/quotes/rules";

// API は日時を ISO 文字列で返す
export type Member = { id: number; name: string; email: string | null; isActive: boolean };

export type Customer = {
  id: number;
  companyName: string;
  department: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  memo: string | null;
  archivedAt: string | null;
  version: number;
  _count?: { deals: number };
};

export type Deal = {
  id: number;
  customerId: number;
  name: string;
  salesRepId: number;
  status: DealStatus;
  version: number;
  updatedAt: string;
  wonAt: string | null;
  customer: Customer;
  salesRep: Member;
};

export type DealContract = {
  contractType: ContractType;
  startDate: string;
  endDate: string;
  amount: number;
};

export type MeetingNote = { id: number; dealId: number; meetingDate: string; content: string; authorName: string };

export type Quote = {
  id: number;
  quoteNumber: string;
  dealId: number;
  title: string;
  status: QuoteStatus;
  validUntil: string | null;
  taxRate: number;
  subtotal: number;
  tax: number;
  total: number;
  version: number;
  createdAt: string;
};

export type QuoteLine = {
  description: string;
  quantity: number;
  unit: string;
  unitPrice: number;
  amount: number;
  assigneeId: number | null;
  assignee?: Member | null;
};

export type QuoteHistory = { id: number; fromStatus: QuoteStatus | null; toStatus: QuoteStatus; changedByName: string; changedAt: string };

export type DealDetail = Deal & { contract: DealContract | null; quotes: Quote[]; notes: MeetingNote[] };
export type CustomerDetail = Customer & { deals: Deal[] };
export type QuoteWithDeal = Quote & { deal: Deal & { customer: Customer } };
export type QuoteDetail = QuoteWithDeal & { lines: QuoteLine[]; history: QuoteHistory[] };

export type Dashboard = {
  openDeals: number;
  submittedQuotes: { count: number; total: number };
  wonThisMonth: number;
  recentNotes: (MeetingNote & { deal: { id: number; name: string } })[];
  recentDeals: Deal[];
};
