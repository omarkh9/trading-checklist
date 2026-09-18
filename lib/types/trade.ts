export type Direction = "Long" | "Short";
export type Outcome = "Win" | "Loss" | "Breakeven";

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
  notes: string;
  beforeChart: string | null;
  afterChart: string | null;
  createdAt: string;
};

export type TradeFormData = Omit<Trade, "id" | "createdAt">;

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
  notes: "",
  beforeChart: null,
  afterChart: null,
});
