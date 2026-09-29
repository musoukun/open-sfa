import type { ContractType, DealStage, DealStatus, Movement } from "@server/deals/rules";
import type { DealSource, Industry, LostReason } from "@server/config/sales";
import type { QuoteStatus } from "@server/quotes/rules";
import type { CooperationLevel, OverviewTextKey, RiskLevel } from "@server/overviews/rules";

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
  industry: Industry | "";
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
  stage: DealStage;
  stageChangedAt: string;
  expectedAmount: number | null;
  expectedCloseMonth: string | null;
  source: DealSource | "";
  lostReason: LostReason | null;
  lostNote: string;
  version: number;
  updatedAt: string;
  wonAt: string | null;
  customer: Customer;
  salesRep: Member;
  overview?: Pick<DealOverview, "cooperationLevel" | "riskLevel"> | null;
  quotes?: { status: string; subtotal: number }[];
};

export type DealContract = {
  contractType: ContractType;
  startDate: string;
  endDate: string;
  amount: number;
};

export type Meeting = {
  id: number;
  dealId: number;
  meetingDate: string;
  title: string;
  attendees: string;
  content: string;
  nextPreparations: string;
  authorName: string;
  version: number;
  updatedAt: string;
};

export type MeetingComment = { id: number; body: string; authorName: string; createdAt: string };
export type MeetingWithDeal = Meeting & { deal: Deal; comments?: MeetingComment[] };

export type GoogleMeetStatus = { enabled: boolean; accountId: string | null; canReadMeet: boolean };

export type ImportedTranscript = Pick<Meeting, "meetingDate" | "attendees" | "content">;

export type DealOverview = Record<OverviewTextKey, string> & {
  cooperationLevel: CooperationLevel | null;
  cooperationNote: string;
  riskLevel: RiskLevel | null;
  riskNote: string;
  version: number;
  updatedByName: string;
  updatedAt: string;
};

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

export type DealEvent = {
  id: number;
  kind: "created" | "stage" | "won" | "lost";
  fromStage: DealStage | null;
  toStage: DealStage | null;
  changedByName: string;
  createdAt: string;
};

export type SimilarDeal = {
  id: number;
  name: string;
  status: DealStatus;
  stage: DealStage;
  lostReason: LostReason | null;
  customer: { companyName: string };
  salesRep: { name: string };
};

export type DealDetail = Omit<Deal, "overview" | "quotes"> & {
  events: DealEvent[];
  similar: SimilarDeal[];
  contract: DealContract | null;
  quotes: Quote[];
  meetings: Meeting[];
  overview: DealOverview | null;
};
export type CustomerDetail = Customer & { deals: Deal[] };
export type QuoteWithDeal = Quote & { deal: Deal & { customer: Customer } };
export type QuoteDetail = QuoteWithDeal & { lines: QuoteLine[]; history: QuoteHistory[] };

export type Dashboard = {
  openDeals: number;
  submittedQuotes: { count: number; total: number };
  wonThisMonth: { count: number; amount: number };
  wonThisFiscalYear: { fiscalYear: number; count: number; amount: number };
  recentMovements: {
    days: number;
    items: {
      id: number;
      movement: Movement;
      fromStage: DealStage | null;
      toStage: DealStage | null;
      changedByName: string;
      createdAt: string;
      deal: { id: number; name: string; customer: { companyName: string } };
    }[];
  };
  pipeline: Pipeline;
  recentMeetings: (Meeting & { deal: { id: number; name: string } })[];
  recentDeals: Deal[];
};

type PipelineCell = { stage: DealStage; count: number; amount: number };

export type Pipeline = {
  currentMonth: string;
  stages: (PipelineCell & { unpriced: number })[];
  months: { key: string; label: string; stages: PipelineCell[] }[];
};
export type OutcomeRow = { key: string; total: number; open: number; won: number; lost: number; wonAmount: number; winRate: number | null };

export type Insights = {
  fiscalYear: number;
  byIndustry: OutcomeRow[];
  bySource: OutcomeRow[];
  lostByStage: { stage: DealStage; count: number }[];
  lostByReason: { reason: LostReason; count: number }[];
};