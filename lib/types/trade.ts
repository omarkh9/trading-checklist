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
  beforeChart: null,
  afterChart: null,
});
