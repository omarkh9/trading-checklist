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

function asFiniteNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
}

function pickNumber(record: JsonRecord, keys: string[]) {
  const entries = Object.entries(record);
  for (const key of keys) {
    const match = entries.find(
      ([name]) => name.toLowerCase() === key.toLowerCase()
    );
    const parsed = asFiniteNumber(match ? match[1] : record[key]);
    if (parsed != null) return parsed;
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

const BALANCE_KEYS = [
  "balance",
  "accountBalance",
  "account_balance",
  "mt5Balance",
  "mt5_balance",
];
const EQUITY_KEYS = [
  "equity",
  "accountEquity",
  "account_equity",
  "mt5Equity",
  "mt5_equity",
];

export function readMt5AccountMetrics(body: unknown) {
  const record = asRecord(body);
  const layers = [
    record,
    asRecord(record.data),
    asRecord(record.account),
    asRecord(record.accountInformation),
    asRecord(record.account_information),
    asRecord(record.info),
    asRecord(record.snapshot),
    asRecord(Array.isArray(record.results) ? record.results[0] : null),
  ];
  let balance: number | null = null;
  let equity: number | null = null;
  for (const layer of layers) {
    balance ??= pickNumber(layer, BALANCE_KEYS);
    equity ??= pickNumber(layer, EQUITY_KEYS);
  }
  if (balance == null && equity != null) balance = equity;
  if (equity == null && balance != null) equity = balance;
  return { balance, equity };
}

export function parseMt5ClosedTrades(
  body: unknown,
  accountBalance: number | null
): Mt5IngestTrade[] {
  const rows = extractMt5TradeList(body);

  const seen = new Set<string>();
  const trades: Mt5IngestTrade[] = [];

  for (const row of rows) {
    const item = asRecord(row);
    const entryType = pickString(item, [
      "entryType",
      "entry",
      "dealEntry",
    ]).toLowerCase();
    if (
      entryType === "in" ||
      entryType === "deal_entry_in" ||
      entryType === "entry_in"
    ) {
      continue;
    }

    const dealKind = pickString(item, ["type", "dealType", "action"]).toLowerCase();
    if (
      /balance|credit|charge|correction|bonus|commission|dividend/.test(dealKind)
    ) {
      continue;
    }
    const dealCode = pickNumber(item, ["type", "dealType", "action"]);
    if (dealCode != null && dealCode >= 2) continue;

    const ticket = pickString(item, [
      "positionId",
      "position",
      "ticket",
      "dealId",
      "deal",
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
      "closePrice",
      "priceClose",
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
  const nested = asRecord(record.data);
  const account = asRecord(record.account);
  return [
    ...asList(record.trades),
    ...asList(record.deals),
    ...asList(record.closedTrades),
    ...asList(record.history),
    ...asList(record.historyDeals),
    ...asList(record.items),
    ...asList(record.result),
    ...asList(nested.trades),
    ...asList(nested.deals),
    ...asList(nested.closedTrades),
    ...asList(nested.history),
    ...asList(account.trades),
    ...asList(account.deals),
  ];
}
