import type { TradeEmotion } from "@/lib/types/emotion";

export type Direction = "Long" | "Short";
export type Outcome = "Win" | "Loss" | "Breakeven";
export type PnlMode = "dollar" | "percent";
export type RiskSizeMode = "fixed" | "percent";

export type Trade = {
  id: string;
  pair: string;
  higherTimeFrame: string | null;
  middleTimeFrame: string | null;
  lowerTimeFrame: string | null;
  entry: string | null;
  direction: Direction;
  entryPrice: string;
  exitPrice: string;
  stopLoss: string;
  takeProfit: string;
  outcome: Outcome;
  pnlMode: PnlMode;
  pnlInput: string;
  pnlDollars: number;
  riskSizeMode: RiskSizeMode;
  riskPercent: string;
  fixedLotSize: string;
  lotSize: string;
  accountBalanceAtEntry: number;
  accountId: string;
  strategy: string;
  notes: string;
  emotionBefore: TradeEmotion | null;
  emotionAfter: TradeEmotion | null;
  ruleScore: number | null;
  checkedRuleIds: string[];
  beforeChart: string | null;
  afterChart: string | null;
  createdAt: string;
};

export type TradeFormData = Omit<Trade, "id" | "createdAt"> & {
  createdAt?: string;
};

export const emptyTradeForm = (): TradeFormData => ({
  pair: "",
  higherTimeFrame: null,
  middleTimeFrame: null,
  lowerTimeFrame: null,
  entry: null,
  direction: "Long",
  entryPrice: "",
  exitPrice: "",
  stopLoss: "",
  takeProfit: "",
  outcome: "Win",
  pnlMode: "dollar",
  pnlInput: "",
  pnlDollars: 0,
  riskSizeMode: "percent",
  riskPercent: "1",
  fixedLotSize: "",
  lotSize: "",
  accountBalanceAtEntry: 0,
  accountId: "",
  strategy: "",
  notes: "",
  emotionBefore: null,
  emotionAfter: null,
  ruleScore: null,
  checkedRuleIds: [],
  beforeChart: null,
  afterChart: null,
});
