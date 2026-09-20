export const MAX_TRADING_ACCOUNTS = 10;
export const DEFAULT_ACCOUNT_NAME = "Main";
export const DEFAULT_STARTING_BALANCE = 10_000;

export type TradingAccount = {
  id: string;
  name: string;
  startingBalance: number;
  createdAt: string;
};

export type AccountSettings = {
  startingBalance: number;
};

export const defaultAccountSettings = (): AccountSettings => ({
  startingBalance: DEFAULT_STARTING_BALANCE,
});

export function normalizeAccountName(name: string) {
  return name.trim().replace(/\s+/g, " ").slice(0, 48);
}

export function nextAccountName(existing: TradingAccount[]) {
  const taken = new Set(existing.map((account) => account.name.toLowerCase()));
  if (!taken.has(DEFAULT_ACCOUNT_NAME.toLowerCase())) {
    return DEFAULT_ACCOUNT_NAME;
  }
  for (let index = 2; index <= MAX_TRADING_ACCOUNTS + 1; index += 1) {
    const candidate = `Account ${index}`;
    if (!taken.has(candidate.toLowerCase())) return candidate;
  }
  return `Account ${existing.length + 1}`;
}
