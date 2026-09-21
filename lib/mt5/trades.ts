type JsonRecord = Record<string, unknown>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asList(value: unknown): unknown[] {
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") {
    const record = value as JsonRecord;
    if (Array.isArray(record.trades)) return record.trades;
    if (Array.isArray(record.deals)) return record.deals;
    if (Array.isArray(record.positions)) return record.positions;
  }
  return [];
}

function pickString(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return "";
}

function pickNumber(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value.trim());
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

function pickTime(record: JsonRecord, keys: string[]) {
  const raw = pickString(record, keys);
  if (!raw) return "";
  const asNumber = Number(raw);
  if (Number.isFinite(asNumber) && asNumber > 1_000_000_000) {
    const millis = asNumber < 1_000_000_000_000 ? asNumber * 1000 : asNumber;
    return new Date(millis).toISOString();
  }
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString();
}

function directionFromDeal(record: JsonRecord): "Long" | "Short" | null {
  const raw = pickString(record, ["direction", "type", "side", "orderType", "dealType"]);
  const normalized = raw.toLowerCase();
  if (
    normalized === "buy" ||
    normalized === "long" ||
    normalized === "0" ||
    normalized === "deal_type_buy"
  ) {
    return "Long";
  }
  if (
    normalized === "sell" ||
    normalized === "short" ||
    normalized === "1" ||
    normalized === "deal_type_sell"
  ) {
    return "Short";
  }

  const numeric = pickNumber(record, ["type", "dealType", "action"]);
  if (numeric === 0) return "Long";
  if (numeric === 1) return "Short";
  return null;
}

function outcomeFromProfit(profit: number): "Win" | "Loss" | "Breakeven" {
  if (profit > 0) return "Win";
  if (profit < 0) return "Loss";
  return "Breakeven";
}

export type Mt5IngestTrade = {
  ticket: string;
  pair: string;
  direction: "Long" | "Short";
  entryPrice: string;
  stopLoss: string;
  takeProfit: string;
  pnlDollars: number;
  outcome: "Win" | "Loss" | "Breakeven";
  lotSize: string;
  accountBalanceAtEntry: number;
  createdAt: string;
  notes: string;
};

export function parseMt5ClosedTrades(
  body: unknown,
  accountBalance: number | null
): Mt5IngestTrade[] {
  const record = asRecord(body);
  const nested = asRecord(record.data);
  const rows = [
    ...asList(record.trades),
    ...asList(record.deals),
    ...asList(record.closedTrades),
    ...asList(nested.trades),
    ...asList(nested.deals),
  ];

  const seen = new Set<string>();
  const trades: Mt5IngestTrade[] = [];

  for (const row of rows) {
    const item = asRecord(row);
    const ticket = pickString(item, [
      "ticket",
      "dealId",
      "deal",
      "positionId",
      "order",
      "id",
    ]);
    const pair = pickString(item, ["symbol", "pair", "instrument"]).toUpperCase();
    const direction = directionFromDeal(item);
    const profit = pickNumber(item, [
      "profit",
      "pnl",
      "pnlDollars",
      "netProfit",
    ]);
    const commission = pickNumber(item, ["commission"]) ?? 0;
    const swap = pickNumber(item, ["swap"]) ?? 0;
    const entry = pickString(item, [
      "openPrice",
      "priceOpen",
      "entryPrice",
      "price",
    ]);
    if (!ticket || !pair || !direction || !entry) continue;

    const pnlDollars = (profit ?? 0) + commission + swap;
    const createdAt =
      pickTime(item, [
        "closeTime",
        "time",
        "closedAt",
        "dealTime",
        "createdAt",
      ]) || new Date().toISOString();

    if (seen.has(ticket)) continue;
    seen.add(ticket);

    trades.push({
      ticket,
      pair,
      direction,
      entryPrice: entry,
      stopLoss: pickString(item, ["sl", "stopLoss", "stop_loss"]),
      takeProfit: pickString(item, ["tp", "takeProfit", "take_profit"]),
      pnlDollars,
      outcome: outcomeFromProfit(pnlDollars),
      lotSize: pickString(item, ["volume", "lots", "lotSize"]) || "",
      accountBalanceAtEntry:
        pickNumber(item, ["balance", "accountBalance"]) ??
        accountBalance ??
        0,
      createdAt,
      notes: `MT5 #${ticket}`,
    });
  }

  return trades;
}

export function extractMt5TradeList(body: unknown) {
  const record = asRecord(body);
  return [
    ...asList(record.trades),
    ...asList(record.deals),
    ...asList(record.closedTrades),
  ];
}
